// Supabase Edge Function: stripe (V92)
// Cobro automático de facturas con Stripe (tarjeta o adeudo SEPA). Las facturas las sigue haciendo el
// ERP (numeración correlativa propia); Stripe solo cobra:
//  1) Domiciliación: el cliente abre un enlace de Stripe Checkout (modo "setup") desde su área de cliente
//     o desde el email que le manda el ERP, da su tarjeta o su IBAN (mandato SEPA) y queda guardado en
//     `clientes` (stripe_customer_id, stripe_payment_method_id…).
//  2) Cobro: cada día (pg_cron, SQL V92) se cobran las facturas de clientes domiciliados que vencen
//     (o al emitirse, según el ajuste stripe_cobro_momento), solo las de su mes de domiciliación en adelante.
//  3) Webhook de Stripe: pago correcto → factura pagada + asiento COB-<id> (5721 Stripe / 430 Clientes,
//     y la comisión 626 / 5721); pago fallido → aviso en Slack y la factura vuelve a los recordatorios;
//     transferencia de Stripe al banco (payout.paid) → asiento STR-<id> (572 / 5721).
//
// Despliegue:  supabase functions deploy stripe --no-verify-jwt
// Secrets:     STRIPE_SECRET_KEY      sk_test_… (pruebas) o sk_live_… (real) — Stripe → Developers → API keys
//              STRIPE_WEBHOOK_SECRET  whsec_… del endpoint https://<proyecto>.supabase.co/functions/v1/stripe
//              RESEND_API_KEY / FROM_EMAIL (ya están, para mandar el enlace de domiciliación)
//
// Acciones (POST JSON):
//   Stripe:   webhook (cabecera Stripe-Signature)
//   Cliente:  { token, accion: 'domiciliar' }                      → { url } de Stripe Checkout
//   ERP:      { accion: 'admin_estado' }
//             { accion: 'admin_enlace', cliente_id, enviar }      → { url } y, si enviar, email al cliente
//             { accion: 'admin_cobrar', factura_id }              → cobra ya una factura
//             { accion: 'admin_quitar', cliente_id }              → deja de cobrar por Stripe a ese cliente
//   Programado: { accion: 'cron_cobros' }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";
const DOMINIO_ERP = "@rootflow.es";
const PORTAL_URL = () => env("PORTAL_URL") || "https://www.rootflow.es/area-cliente";
const ESTADOS_PENDIENTE = ["pendiente", "vencida"];
const MAX_COBROS_POR_EJECUCION = 40;
const r2 = (x: any) => Math.round((parseFloat(x) || 0) * 100) / 100;
const hoyMadrid = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
const esEmail = (x: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x);
const emailsCliente = (c: any) => String(c?.email_facturacion || c?.email || "").split(/[,;\s]+/).map((x) => x.trim()).filter(esEmail);
const eur = (n: any) => `${r2(n).toFixed(2).replace(".", ",")} €`;
const esc = (t: any) => String(t ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[ch]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const firma = req.headers.get("Stripe-Signature");
  const raw = await req.text();
  try {
    if (firma) return await webhook(supabase, raw, firma);
    let body: any;
    try { body = JSON.parse(raw || "{}"); } catch { return json({ error: "Petición no válida" }, 400); }
    const accion = String(body?.accion || "");
    if (accion === "cron_cobros") return json({ ok: true, ...(await cobrarPendientes(supabase, "automatico")) });
    if (accion === "domiciliar") return json(await domiciliarDesdePortal(supabase, body));
    if (!accion.startsWith("admin_")) return json({ error: "Acción no válida" }, 400);
    const usuario = await usuarioERP(req, supabase);
    if (!usuario) return json({ error: "Solo para usuarios del ERP" }, 401);
    if (accion === "admin_estado") return json(await estado(supabase));
    if (accion === "admin_enlace") return json(await enlaceAdmin(supabase, body, usuario));
    if (accion === "admin_cobrar") return json(await cobrarManual(supabase, body, usuario));
    if (accion === "admin_quitar") return json(await quitar(supabase, body, usuario));
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    console.error("stripe", e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});

async function usuarioERP(req: Request, supabase: any) {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await supabase.auth.getUser(jwt);
  const u = data?.user;
  if (error || !u?.email || !u.email.toLowerCase().endsWith(DOMINIO_ERP) || !u.email_confirmed_at) return null;
  return u.email;
}

// ==================== API DE STRIPE ====================
// Parámetros en form-urlencoded con objetos y listas anidados (a[b]=c, a[0]=x)
function form(params: any, prefijo = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    const clave = prefijo ? `${prefijo}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? form(x, `${clave}[${i}]`, out) : out.append(`${clave}[${i}]`, String(x))));
    else if (typeof v === "object") form(v, clave, out);
    else out.append(clave, String(v));
  }
  return out;
}
async function st(metodo: string, ruta: string, params: any = null, idempotencia = "") {
  const key = env("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Falta el secret STRIPE_SECRET_KEY en Supabase (Edge Functions → Secrets)");
  const q = metodo === "GET" && params ? `?${form(params)}` : "";
  const res = await fetch(`https://api.stripe.com/v1${ruta}${q}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencia ? { "Idempotency-Key": idempotencia } : {}),
    },
    body: metodo === "GET" ? undefined : form(params || {}).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    const e: any = new Error(data?.error?.message || `Stripe ${res.status}`);
    e.stripe = data?.error;
    throw e;
  }
  return data;
}
const modo = () => (env("STRIPE_SECRET_KEY").startsWith("sk_live") ? "real" : env("STRIPE_SECRET_KEY") ? "pruebas" : null);

// ==================== DOMICILIACIÓN ====================
async function clientePorToken(supabase: any, token: string) {
  const t = String(token || "").trim();
  if (t.length < 20 || t.length > 100 || !/^[A-Za-z0-9_-]+$/.test(t)) return null;
  const { data } = await supabase.from("clientes").select("*").eq("portal_token", t).maybeSingle();
  return data && data.portal_activo !== false ? data : null;
}

async function asegurarCustomer(supabase: any, c: any) {
  if (c.stripe_customer_id) return c.stripe_customer_id;
  const cus = await st("POST", "/customers", {
    name: c.nombre, email: emailsCliente(c)[0], phone: c.telefono || undefined, preferred_locales: ["es"],
    address: c.direccion ? { line1: c.direccion, postal_code: c.codigo_postal || undefined, city: c.ciudad || undefined, country: "ES" } : undefined,
    metadata: { cliente_id: String(c.id), cif: c.cif || "" },
  }, `customer-cliente-${c.id}`);
  await supabase.from("clientes").update({ stripe_customer_id: cus.id }).eq("id", c.id);
  return cus.id;
}

async function crearEnlace(supabase: any, c: any) {
  const customer = await asegurarCustomer(supabase, c);
  const vuelta = c.portal_token ? `${PORTAL_URL()}?t=${encodeURIComponent(c.portal_token)}` : "https://www.rootflow.es";
  const s = await st("POST", "/checkout/sessions", {
    mode: "setup",
    currency: "eur",
    customer,
    locale: "es",
    payment_method_types: ["sepa_debit", "card"],
    billing_address_collection: "required",
    success_url: `${vuelta}${vuelta.includes("?") ? "&" : "?"}domiciliacion=ok`,
    cancel_url: `${vuelta}${vuelta.includes("?") ? "&" : "?"}domiciliacion=cancelada`,
    metadata: { cliente_id: String(c.id) },
    setup_intent_data: { metadata: { cliente_id: String(c.id) }, description: `Domiciliación de pagos a RootFlow Hydroponics (${c.nombre})` },
  });
  return s.url;
}

async function domiciliarDesdePortal(supabase: any, body: any) {
  const c = await clientePorToken(supabase, body.token);
  if (!c) return { error: "Este enlace no es válido o ha caducado" };
  return { url: await crearEnlace(supabase, c) };
}

async function enlaceAdmin(supabase: any, body: any, usuario: string) {
  const { data: c } = await supabase.from("clientes").select("*").eq("id", Number(body.cliente_id)).maybeSingle();
  if (!c) throw new Error("Cliente no encontrado");
  const url = await crearEnlace(supabase, c);
  if (!body.enviar) return { ok: true, url };
  const para = emailsCliente(c);
  if (!para.length) throw new Error("El cliente no tiene email");
  const html = `<!DOCTYPE html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f5f5f5;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;background:#fff;padding:28px;">
    <p style="font-size:22px;font-weight:800;">Root<span style="color:#F97316;">Flow</span></p>
    <p style="font-size:15px;">Hola ${esc(c.contacto || c.nombre)},</p>
    <p style="font-size:15px;">Para que no tengas que estar pendiente de las transferencias, a partir de ahora podemos cobrarte cada factura automáticamente el día de su vencimiento, con tarjeta o con adeudo en tu cuenta (SEPA).</p>
    <p style="font-size:15px;">Solo tienes que hacerlo una vez, en la página segura de Stripe, nuestra plataforma de pagos:</p>
    <p style="margin:22px 0;"><a href="${url}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">Domiciliar mis pagos</a></p>
    <p style="font-size:13px;color:#555;">Seguirás recibiendo cada factura por email antes del cobro y las tienes todas en tu área de cliente. Puedes cancelar la domiciliación cuando quieras escribiéndonos. El enlace caduca en 24 horas: si se te pasa, pídenos otro o hazlo desde tu área de cliente.</p>
    <p style="font-size:14px;margin-top:20px;">Gracias 🌱<br>RootFlow Hydroponics · info@rootflow.es</p>
  </div></body></html>`;
  const key = env("RESEND_API_KEY");
  if (!key) throw new Error("Falta el secret RESEND_API_KEY");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env("FROM_EMAIL") || "RootFlow Hydroponics <info@rootflow.es>", to: para, reply_to: "info@rootflow.es", subject: "Domicilia tus pagos a RootFlow (1 minuto)", html }),
  });
  const r = await res.json().catch(() => ({}));
  await supabase.from("email_log").insert({ destinatarios: para.join(", "), asunto: "Domiciliación Stripe", alerta_id: `stripe_enlace:${c.id}`, estado: res.ok ? "enviado" : "error", respuesta: res.ok ? JSON.stringify({ id: r?.id, por: usuario }) : JSON.stringify(r).slice(0, 500) });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${r?.message || "error"}`);
  return { ok: true, url, enviado_a: para };
}

async function quitar(supabase: any, body: any, usuario: string) {
  const { data: c } = await supabase.from("clientes").select("*").eq("id", Number(body.cliente_id)).maybeSingle();
  if (!c) throw new Error("Cliente no encontrado");
  if (c.stripe_payment_method_id) { try { await st("POST", `/payment_methods/${c.stripe_payment_method_id}/detach`); } catch (e) { console.warn("detach", e); } }
  await supabase.from("clientes").update({ stripe_activo: false, stripe_payment_method_id: null, stripe_mandate_id: null, stripe_metodo: null, stripe_metodo_detalle: null }).eq("id", c.id);
  await slack(supabase, `💳 ${usuario} ha quitado la domiciliación de Stripe de *${c.nombre}*: vuelve a pagar por transferencia.`);
  return { ok: true };
}

const detalleMetodo = (pm: any) => pm?.type === "card"
  ? `${(pm.card?.brand || "Tarjeta").replace(/^./, (x: string) => x.toUpperCase())} ···${pm.card?.last4 || ""}`
  : pm?.type === "sepa_debit" ? `IBAN ${pm.sepa_debit?.country || ""}···${pm.sepa_debit?.last4 || ""}` : pm?.type || "";

async function domiciliacionCompletada(supabase: any, sesion: any) {
  if (sesion.mode !== "setup" || !sesion.setup_intent) return "no es una domiciliación";
  const si = await st("GET", `/setup_intents/${sesion.setup_intent}`, { expand: ["payment_method"] });
  const pm = si.payment_method;
  const clienteId = Number(sesion.metadata?.cliente_id || si.metadata?.cliente_id);
  if (!clienteId || !pm?.id) return "sin cliente o sin método de pago";
  const { data: c } = await supabase.from("clientes").select("*").eq("id", clienteId).maybeSingle();
  if (!c) return "cliente no encontrado";
  await st("POST", `/customers/${sesion.customer}`, { invoice_settings: { default_payment_method: pm.id } });
  const anterior = c.stripe_payment_method_id;
  const { error } = await supabase.from("clientes").update({
    stripe_customer_id: sesion.customer, stripe_payment_method_id: pm.id, stripe_metodo: pm.type,
    stripe_metodo_detalle: detalleMetodo(pm), stripe_mandate_id: si.mandate || null, stripe_activo: true,
    stripe_domiciliado_at: c.stripe_activo && c.stripe_domiciliado_at ? c.stripe_domiciliado_at : new Date().toISOString(),
  }).eq("id", clienteId);
  if (error) throw new Error(error.message);
  if (anterior && anterior !== pm.id) { try { await st("POST", `/payment_methods/${anterior}/detach`); } catch { /* ya no existía */ } }
  await slack(supabase, `💳 *${c.nombre}* ha domiciliado sus pagos con Stripe (${detalleMetodo(pm)}). Sus facturas se cobrarán solas.`);
  return "domiciliado";
}

// ==================== COBROS ====================
async function leerMomento(supabase: any) {
  const { data } = await supabase.from("ajustes_sistema").select("valor").eq("clave", "stripe_cobro_momento").maybeSingle();
  return data?.valor === "emision" ? "emision" : "vencimiento";
}

// Facturas que toca cobrar ya por Stripe
export function facturasACobrar(facturas: any[], clientes: any[], hoy: string, momento: string) {
  const porId = new Map(clientes.map((c) => [c.id, c]));
  return facturas.filter((f) => {
    const c: any = porId.get(f.cliente_id);
    if (!c?.stripe_activo || !c.stripe_payment_method_id || !c.stripe_customer_id) return false;
    if (!ESTADOS_PENDIENTE.includes(f.estado) || f.tipo === "anulada" || f.tipo === "rectificativa" || /^R-/.test(String(f.id)) || r2(f.total) <= 0) return false;
    if (f.stripe_estado) return false; // en curso, cobrada o fallida (los fallidos se reintentan a mano)
    const desde = String(c.stripe_domiciliado_at || "").slice(0, 7) + "-01"; // desde el mes en que domicilió
    if (String(f.fecha) < desde) return false;
    return momento === "emision" ? String(f.fecha) <= hoy : String(f.fecha_vencimiento || f.fecha) <= hoy;
  });
}

async function cobrarPendientes(supabase: any, origen: string) {
  if (!env("STRIPE_SECRET_KEY")) return { cobrados: 0, motivo: "sin STRIPE_SECRET_KEY" };
  const [{ data: facturas, error }, { data: clientes }] = await Promise.all([
    supabase.from("facturas").select("*").in("estado", ESTADOS_PENDIENTE).is("stripe_estado", null),
    supabase.from("clientes").select("*").eq("stripe_activo", true),
  ]);
  if (error) throw new Error(error.message);
  const lista = facturasACobrar(facturas || [], clientes || [], hoyMadrid(), await leerMomento(supabase)).slice(0, MAX_COBROS_POR_EJECUCION);
  const res = { cobrados: [] as string[], en_curso: [] as string[], fallidos: [] as string[] };
  for (const f of lista) {
    const c = (clientes || []).find((x: any) => x.id === f.cliente_id);
    const r = await cobrarFactura(supabase, f, c, origen);
    if (r.estado === "succeeded") res.cobrados.push(f.id);
    else if (r.estado === "processing") res.en_curso.push(f.id);
    else res.fallidos.push(`${f.id} (${c?.nombre}): ${r.error || r.estado}`);
  }
  if (res.fallidos.length) await slack(supabase, `❌ *Cobros con Stripe que han fallado:*\n${res.fallidos.map((x) => `• ${x}`).join("\n")}\nSe reintentan desde Facturación → 🏦 Banco y cobros. La factura vuelve a los recordatorios de pago.`);
  return { cobrados: res.cobrados.length, en_curso: res.en_curso.length, fallidos: res.fallidos };
}

async function cobrarManual(supabase: any, body: any, usuario: string) {
  const { data: f } = await supabase.from("facturas").select("*").eq("id", String(body.factura_id)).maybeSingle();
  if (!f) throw new Error("Factura no encontrada");
  if (!ESTADOS_PENDIENTE.includes(f.estado)) throw new Error(`La factura está ${f.estado}`);
  if (["processing", "succeeded"].includes(f.stripe_estado)) throw new Error(`Ya hay un cobro de Stripe ${f.stripe_estado === "processing" ? "en curso" : "correcto"} para esta factura`);
  const { data: c } = await supabase.from("clientes").select("*").eq("id", f.cliente_id).maybeSingle();
  if (!c?.stripe_activo || !c.stripe_payment_method_id) throw new Error("El cliente no tiene el pago domiciliado en Stripe");
  return await cobrarFactura(supabase, f, c, usuario);
}

async function cobrarFactura(supabase: any, f: any, c: any, origen: string) {
  const intento = (Number(f.stripe_intentos) || 0) + 1;
  // Reclamar la factura: dos ejecuciones a la vez no la cobran dos veces
  const q = supabase.from("facturas").update({ stripe_estado: "processing", stripe_intentos: intento, stripe_error: null }).eq("id", f.id);
  const { data: claim } = await (f.stripe_estado ? q.eq("stripe_estado", f.stripe_estado) : q.is("stripe_estado", null)).select("id");
  if (!claim?.length) return { estado: "omitida", error: "otro proceso la está cobrando" };
  try {
    const pi = await st("POST", "/payment_intents", {
      amount: Math.round(r2(f.total) * 100),
      currency: "eur",
      customer: c.stripe_customer_id,
      payment_method: c.stripe_payment_method_id,
      payment_method_types: [c.stripe_metodo || "card"],
      mandate: c.stripe_metodo === "sepa_debit" && c.stripe_mandate_id ? c.stripe_mandate_id : undefined,
      off_session: true,
      confirm: true,
      description: `Factura ${f.id} · RootFlow Hydroponics`,
      metadata: { factura_id: f.id, cliente_id: String(c.id), origen },
    }, `cobro-${f.id}-${intento}`);
    await supabase.from("facturas").update({ stripe_payment_intent_id: pi.id, stripe_estado: pi.status === "succeeded" ? "processing" : pi.status === "processing" ? "processing" : "failed", stripe_error: ["succeeded", "processing"].includes(pi.status) ? null : `Estado ${pi.status}` }).eq("id", f.id);
    if (pi.status === "succeeded") await pagoCorrecto(supabase, pi.id);
    return { estado: pi.status, payment_intent: pi.id };
  } catch (e) {
    const err: any = (e as any)?.stripe || {};
    const msg = traducirError(err) || String((e as any)?.message || e);
    await supabase.from("facturas").update({ stripe_estado: "failed", stripe_error: msg.slice(0, 500), stripe_payment_intent_id: err.payment_intent?.id || null }).eq("id", f.id);
    return { estado: "failed", error: msg };
  }
}

const traducirError = (err: any) => ({
  card_declined: "Tarjeta rechazada por el banco",
  expired_card: "Tarjeta caducada",
  insufficient_funds: "Fondos insuficientes",
  authentication_required: "El banco pide que el cliente autorice el pago (3D Secure): mándale el enlace de domiciliación otra vez",
  incorrect_cvc: "CVC incorrecto",
} as any)[err?.decline_code || err?.code] || err?.message || "";

// Pago confirmado: factura pagada + asiento (5721 Stripe / 430) + comisión (626 / 5721). Idempotente.
async function pagoCorrecto(supabase: any, piId: string) {
  const pi = await st("GET", `/payment_intents/${piId}`, { expand: ["latest_charge.balance_transaction"] });
  const facturaId = pi.metadata?.factura_id;
  if (!facturaId) return "sin factura";
  const { data: f } = await supabase.from("facturas").select("*").eq("id", facturaId).maybeSingle();
  if (!f) return "factura no encontrada";
  const bt = pi.latest_charge?.balance_transaction;
  const comision = bt?.fee != null ? r2(bt.fee / 100) : null;
  const fecha = pi.latest_charge?.created ? new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(pi.latest_charge.created * 1000)) : hoyMadrid();
  const cobrado = r2(pi.amount_received / 100);
  if (f.estado === "pagada" && f.stripe_estado === "succeeded") return "ya estaba";
  const { error } = await supabase.from("facturas").update({ estado: "pagada", fecha_cobro: fecha, metodo_cobro: "stripe", stripe_estado: "succeeded", stripe_error: null, stripe_payment_intent_id: pi.id, stripe_comision: comision }).eq("id", f.id);
  if (error) throw new Error(error.message);
  const { data: c } = await supabase.from("clientes").select("nombre").eq("id", f.cliente_id).maybeSingle();
  const lineas = [
    { cuenta: "5721", concepto: "Stripe (cobro pendiente de liquidar)", debe: cobrado, haber: 0 },
    { cuenta: "430", concepto: "Clientes", debe: 0, haber: cobrado },
    ...(comision ? [
      { cuenta: "626", concepto: "Comisión Stripe", debe: comision, haber: 0 },
      { cuenta: "5721", concepto: "Stripe (comisión)", debe: 0, haber: comision },
    ] : []),
  ];
  await guardarAsiento(supabase, `COB-${f.id}`, fecha, `Cobro Factura ${f.id}${c?.nombre ? " - " + c.nombre : ""} (Stripe)`, lineas);
  if (Math.abs(cobrado - r2(f.total)) > 0.01) await slack(supabase, `⚠️ Stripe ha cobrado ${eur(cobrado)} por la factura ${f.id}, que es de ${eur(f.total)}. Revísalo.`);
  return "pagada";
}

async function pagoFallido(supabase: any, pi: any) {
  const facturaId = pi.metadata?.factura_id;
  if (!facturaId) return "sin factura";
  const msg = traducirError(pi.last_payment_error) || pi.last_payment_error?.message || "Pago rechazado";
  const { data: f } = await supabase.from("facturas").select("id, estado, total, cliente_id").eq("id", facturaId).maybeSingle();
  if (!f) return "factura no encontrada";
  await supabase.from("facturas").update({ stripe_estado: "failed", stripe_error: msg.slice(0, 500) }).eq("id", f.id);
  const { data: c } = await supabase.from("clientes").select("nombre").eq("id", f.cliente_id).maybeSingle();
  await slack(supabase, `❌ *Cobro con Stripe fallido*: factura ${f.id} de ${c?.nombre || "—"} (${eur(f.total)}): ${msg}. Reintenta desde Facturación → 🏦 Banco y cobros; mientras, entra en los recordatorios de pago.`);
  return "fallido";
}

async function guardarAsiento(supabase: any, referencia: string, fecha: string, concepto: string, lineas: any[]) {
  const { data: existentes } = await supabase.from("asientos_contables").select("id").eq("referencia", referencia);
  let id = existentes?.[0]?.id;
  if (id) {
    await supabase.from("asientos_contables").update({ concepto, fecha }).eq("id", id);
    await supabase.from("asiento_lineas").delete().eq("asiento_id", id);
  } else {
    const { data: ult } = await supabase.from("asientos_contables").select("numero").like("numero", "A%").order("created_at", { ascending: false }).limit(300);
    const max = Math.max(0, ...(ult || []).map((r: any) => parseInt(String(r.numero).replace(/\D/g, ""), 10) || 0));
    const { data: nuevo, error } = await supabase.from("asientos_contables").insert({ fecha, numero: `A${max + 1}`, concepto, referencia }).select().single();
    if (error) throw new Error(`asiento ${referencia}: ${error.message}`);
    id = nuevo.id;
  }
  const { error: e2 } = await supabase.from("asiento_lineas").insert(lineas.map((l) => ({ ...l, asiento_id: id })));
  if (e2) throw new Error(`asiento ${referencia}: ${e2.message}`);
}

// ==================== WEBHOOK ====================
async function firmaValida(raw: string, cabecera: string) {
  const secreto = env("STRIPE_WEBHOOK_SECRET");
  if (!secreto) return false;
  const partes = Object.fromEntries(cabecera.split(",").map((p) => p.split("=")).filter((p) => p.length === 2)) as any;
  const t = Number(partes.t);
  const firmas = cabecera.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !firmas.length || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(`${t}.${raw}`)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  return firmas.some((f) => f.length === hex.length && [...f].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

async function webhook(supabase: any, raw: string, cabecera: string) {
  if (!(await firmaValida(raw, cabecera))) return json({ error: "Firma no válida" }, 400);
  const ev = JSON.parse(raw);
  const { data: ya } = await supabase.from("stripe_eventos").select("id, resultado").eq("id", ev.id).maybeSingle();
  if (ya && !String(ya.resultado || "").startsWith("error")) return json({ ok: true, repetido: true });
  let resultado = "ignorado";
  try {
    const o = ev.data?.object || {};
    if (ev.type === "checkout.session.completed") resultado = await domiciliacionCompletada(supabase, o);
    else if (ev.type === "payment_intent.succeeded") resultado = await pagoCorrecto(supabase, o.id);
    else if (ev.type === "payment_intent.processing") {
      if (o.metadata?.factura_id) await supabase.from("facturas").update({ stripe_estado: "processing", stripe_payment_intent_id: o.id }).eq("id", o.metadata.factura_id).neq("estado", "pagada");
      resultado = "en curso";
    } else if (ev.type === "payment_intent.payment_failed") resultado = await pagoFallido(supabase, o);
    else if (ev.type === "payout.paid") {
      const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date((o.arrival_date || o.created) * 1000));
      const imp = r2(o.amount / 100);
      await guardarAsiento(supabase, `STR-${o.id}`, fecha, "Transferencia de Stripe al banco", [
        { cuenta: "572", concepto: "Bancos c/c", debe: imp, haber: 0 },
        { cuenta: "5721", concepto: "Stripe", debe: 0, haber: imp },
      ]);
      resultado = "asiento de la transferencia";
    } else if (ev.type === "charge.dispute.created" || ev.type === "charge.refunded") {
      await slack(supabase, `⚠️ Stripe: ${ev.type === "charge.refunded" ? "devolución" : "el cliente ha reclamado (disputa)"} de ${eur((o.amount_refunded || o.amount || 0) / 100)}${o.metadata?.factura_id ? ` (factura ${o.metadata.factura_id})` : ""}. Revísalo en el panel de Stripe y en la factura.`);
      resultado = "avisado";
    } else if (ev.type === "mandate.updated" && o.status === "inactive") {
      const { data: cs } = await supabase.from("clientes").select("id, nombre").eq("stripe_mandate_id", o.id);
      for (const c of cs || []) {
        await supabase.from("clientes").update({ stripe_activo: false }).eq("id", c.id);
        await slack(supabase, `💳 El mandato SEPA de *${c.nombre}* ya no está activo: sus facturas vuelven a transferencia. Mándale otro enlace de domiciliación.`);
      }
      resultado = "mandato inactivo";
    }
  } catch (e) {
    resultado = "error: " + String((e as any)?.message || e).slice(0, 300);
    await supabase.from("stripe_eventos").upsert({ id: ev.id, tipo: ev.type, resultado });
    return json({ error: resultado }, 500); // Stripe lo reintenta
  }
  await supabase.from("stripe_eventos").upsert({ id: ev.id, tipo: ev.type, resultado });
  return json({ ok: true, resultado });
}

// ==================== ESTADO PARA EL ERP ====================
async function estado(supabase: any) {
  const { data: clientes } = await supabase.from("clientes").select("id, nombre, stripe_activo, stripe_metodo_detalle, stripe_domiciliado_at").eq("stripe_activo", true);
  const { data: facturas } = await supabase.from("facturas").select("id, cliente_id, total, estado, fecha_vencimiento, stripe_estado, stripe_error, stripe_comision").not("stripe_estado", "is", null).order("fecha", { ascending: false }).limit(50);
  const { data: eventos } = await supabase.from("stripe_eventos").select("id, created_at, tipo, resultado").order("created_at", { ascending: false }).limit(10);
  return {
    configurado: !!env("STRIPE_SECRET_KEY"), modo: modo(), webhook: !!env("STRIPE_WEBHOOK_SECRET"),
    momento: await leerMomento(supabase), clientes: clientes || [], facturas: facturas || [], eventos: eventos || [],
  };
}

async function slack(supabase: any, text: string) {
  try {
    let webhookUrl = env("SLACK_WEBHOOK_URL");
    if (!webhookUrl) {
      const { data } = await supabase.from("notificaciones_config").select("slack_webhook_url").limit(1).maybeSingle();
      webhookUrl = data?.slack_webhook_url || "";
    }
    if (webhookUrl) await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  } catch (e) {
    console.warn("Slack no enviado", e);
  }
}
