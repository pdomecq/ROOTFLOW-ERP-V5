// Supabase Edge Function: banco (V91)
// Movimientos de la cuenta del BBVA y conciliación automática de cobros de facturas.
//  1) Enable Banking (PSD2, gratis para cuentas propias): el ERP conecta la cuenta una vez
//     (consentimiento de hasta 180 días) y la función se trae los movimientos dos veces al día.
//  2) Extracto en PDF (o Excel/CSV pasado a texto por el ERP): lo lee la API de Claude.
//  Los movimientos van a `movimientos_banco` sin duplicar, y `conciliacion.js` decide qué
//  factura cobra cada ingreso. Las que cuadran se marcan pagadas con su asiento 572/430
//  (referencia COB-<factura>), igual que registrarCobro() del ERP.
//
// Despliegue:  supabase functions deploy banco --no-verify-jwt   (index.ts + conciliacion.js)
// Secrets:     EB_APP_ID          id de la aplicación en Enable Banking (Control Panel → Applications)
//              EB_PRIVATE_KEY     clave privada .pem que descargas al crear la aplicación
//              ANTHROPIC_API_KEY  (ya está, la usa leer-factura) para leer extractos en PDF
//              SLACK_WEBHOOK_URL  opcional (si no, notificaciones_config.slack_webhook_url)
//
// Acciones (POST JSON):
//   Programado (pg_cron, SQL V91): { accion: 'cron_banco' } → sincroniza (si está conectado) y concilia
//   ERP (usuario @rootflow.es):
//     { accion: 'admin_estado' }
//     { accion: 'admin_conectar', redirect_url }            → { url } para autorizar en el BBVA
//     { accion: 'admin_callback', code, state }             → guarda la conexión
//     { accion: 'admin_sincronizar' }                       → trae movimientos y concilia
//     { accion: 'admin_importar', nombre, base64 | texto }  → lee el extracto, mete lo nuevo y concilia
//     { accion: 'admin_conciliar' }
//     { accion: 'admin_confirmar', movimiento_id, factura_ids }   → cobro confirmado a mano (aprende el pagador)
//     { accion: 'admin_marcar', movimiento_id, estado }           → 'ignorado' | 'otro' | 'pendiente'

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@1";
import { conciliar, movimientosNuevos, ESTADOS_PENDIENTE } from "./conciliacion.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";
const DOMINIO_ERP = "@rootflow.es";
const EB_API = "https://api.enablebanking.com";
const MODELO = "claude-opus-5-5";
const MAX_BASE64 = 20 * 1024 * 1024;
const hoyISO = () => new Date().toISOString().slice(0, 10);
const r2 = (x: any) => Math.round((parseFloat(x) || 0) * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Petición no válida" }, 400); }
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const accion = String(body?.accion || "");
  try {
    if (accion === "cron_banco") {
      const sync = await sincronizarSiConectado(supabase);
      const conc = await conciliarTodo(supabase, "automatico");
      await avisarCaducidad(supabase);
      return json({ ok: true, sync, conciliacion: resumen(conc) });
    }
    if (!accion.startsWith("admin_")) return json({ error: "Acción no válida" }, 400);
    const usuario = await usuarioERP(req, supabase);
    if (!usuario) return json({ error: "Solo para usuarios del ERP" }, 401);
    if (accion === "admin_estado") return json(await estado(supabase));
    if (accion === "admin_conectar") return json(await conectar(supabase, body));
    if (accion === "admin_callback") return json(await callback(supabase, body));
    if (accion === "admin_sincronizar") {
      const sync = await sincronizarSiConectado(supabase, true);
      return json({ ok: true, sync, conciliacion: resumen(await conciliarTodo(supabase, usuario)) });
    }
    if (accion === "admin_importar") return json(await importarExtracto(supabase, body, usuario));
    if (accion === "admin_conciliar") return json({ ok: true, conciliacion: resumen(await conciliarTodo(supabase, usuario)) });
    if (accion === "admin_confirmar") return json(await confirmar(supabase, body, usuario));
    if (accion === "admin_marcar") return json(await marcar(supabase, body, usuario));
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    console.error("banco", e);
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

// ==================== AJUSTES Y CONFIG PRIVADA ====================
async function leerPrivado(supabase: any, clave: string) {
  const { data } = await supabase.from("config_privada").select("valor").eq("clave", clave).maybeSingle();
  try { return data?.valor ? JSON.parse(data.valor) : null; } catch { return null; }
}
async function guardarPrivado(supabase: any, clave: string, valor: any) {
  const v = JSON.stringify(valor);
  const { data } = await supabase.from("config_privada").select("clave").eq("clave", clave).maybeSingle();
  const { error } = data
    ? await supabase.from("config_privada").update({ valor: v }).eq("clave", clave)
    : await supabase.from("config_privada").insert({ clave, valor: v });
  if (error) throw new Error("No se pudo guardar la configuración: " + error.message);
}
async function guardarAjuste(supabase: any, clave: string, valor: string, descripcion: string) {
  const { data } = await supabase.from("ajustes_sistema").select("id").eq("clave", clave).limit(1);
  if (data?.length) await supabase.from("ajustes_sistema").update({ valor, updated_at: new Date().toISOString() }).eq("id", data[0].id);
  else await supabase.from("ajustes_sistema").insert({ clave, valor, tipo: "text", descripcion });
}
// Fecha hasta la que el banco está al día: los recordatorios de pago no salen si es vieja
const marcarBancoAlDia = (supabase: any, hasta: string, origen: string) =>
  guardarAjuste(supabase, "banco_al_dia", JSON.stringify({ hasta, origen, at: new Date().toISOString() }), "V91: hasta qué fecha están cargados los movimientos del banco");

// ==================== ENABLE BANKING ====================
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlTexto = (t: string) => b64url(new TextEncoder().encode(t));
let claveCache: CryptoKey | null = null;
async function jwtEB() {
  const appId = env("EB_APP_ID");
  const pem = env("EB_PRIVATE_KEY").replace(/\\n/g, "\n");
  if (!appId || !pem) throw new Error("Faltan los secrets EB_APP_ID y EB_PRIVATE_KEY en Supabase (Edge Functions → Secrets)");
  if (!claveCache) {
    const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")), (c) => c.charCodeAt(0));
    claveCache = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  }
  const iat = Math.floor(Date.now() / 1000);
  const datos = `${b64urlTexto(JSON.stringify({ typ: "JWT", alg: "RS256", kid: appId }))}.${b64urlTexto(JSON.stringify({ iss: "enablebanking.com", aud: "api.enablebanking.com", iat, exp: iat + 3600 }))}`;
  const firma = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", claveCache, new TextEncoder().encode(datos)));
  return `${datos}.${b64url(firma)}`;
}
async function eb(path: string, init: any = {}) {
  const res = await fetch(`${EB_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await jwtEB()}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) throw new Error(`Enable Banking ${res.status}: ${data?.message || data?.error || JSON.stringify(data || {}).slice(0, 200)}`);
  return data;
}

async function conectar(supabase: any, body: any) {
  const redirect = String(body.redirect_url || "");
  if (!/^https:\/\//.test(redirect)) throw new Error("Falta la dirección de vuelta (redirect_url)");
  const state = crypto.randomUUID();
  const validoHasta = new Date(Date.now() + 179 * 86400000).toISOString();
  const r = await eb("/auth", {
    method: "POST",
    body: JSON.stringify({ access: { valid_until: validoHasta }, aspsp: { name: "BBVA", country: "ES" }, state, redirect_url: redirect, psu_type: "business" }),
  });
  await guardarPrivado(supabase, "banco_eb_state", { state, at: new Date().toISOString() });
  return { url: r.url };
}

async function callback(supabase: any, body: any) {
  const guardado = await leerPrivado(supabase, "banco_eb_state");
  if (!guardado?.state || guardado.state !== body.state) throw new Error("La autorización no corresponde a la última conexión: vuelve a pulsar Conectar");
  const s = await eb("/sessions", { method: "POST", body: JSON.stringify({ code: String(body.code || "") }) });
  const cuentas = (s.accounts || []).map((a: any) => ({ uid: a.uid, iban: a.account_id?.iban || "", nombre: a.name || a.product || "", tipo: a.cash_account_type || "" }));
  if (!cuentas.length) throw new Error("El banco no ha dado acceso a ninguna cuenta");
  await guardarPrivado(supabase, "banco_eb", { session_id: s.session_id, valid_until: s.access?.valid_until || null, cuentas, conectado_at: new Date().toISOString() });
  await guardarPrivado(supabase, "banco_eb_state", null);
  const sync = await sincronizarSiConectado(supabase, true);
  return { ok: true, cuentas: cuentas.map((c: any) => ({ iban: c.iban ? `…${c.iban.slice(-4)}` : "", nombre: c.nombre })), sync, conciliacion: resumen(await conciliarTodo(supabase, "automatico")) };
}

const mapTransaccion = (t: any) => {
  const credito = t.credit_debit_indicator === "CRDT";
  const imp = r2(t.transaction_amount?.amount) * (credito ? 1 : -1);
  const otra = credito ? t.debtor?.name : t.creditor?.name;
  const concepto = [...(t.remittance_information || []), t.bank_transaction_code?.description, t.note].filter(Boolean).join(" ").trim();
  return {
    fecha: t.booking_date || t.value_date || t.transaction_date,
    fecha_valor: t.value_date || null,
    importe: imp,
    saldo: t.balance_after_transaction?.amount != null ? r2(t.balance_after_transaction.amount) : null,
    concepto: concepto || otra || "",
    contraparte: otra || null,
    ref_externa: t.entry_reference || t.transaction_id || null,
  };
};

async function sincronizarSiConectado(supabase: any, avisarSiNo = false) {
  const cfg = await leerPrivado(supabase, "banco_eb");
  if (!cfg?.session_id) return avisarSiNo ? { conectado: false, mensaje: "La cuenta del BBVA no está conectada" } : { conectado: false };
  if (cfg.valid_until && cfg.valid_until < new Date().toISOString()) return { conectado: false, caducado: true, mensaje: "El permiso del BBVA ha caducado: vuelve a conectar la cuenta" };
  const desde = cfg.ultima_sync ? new Date(Date.parse(cfg.ultima_sync) - 7 * 86400000).toISOString().slice(0, 10) : new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  let insertados = 0;
  for (const c of cfg.cuentas || []) {
    const entrantes: any[] = [];
    let cont = "";
    for (let pag = 0; pag < 20; pag++) {
      const q = new URLSearchParams({ date_from: desde, ...(cont ? { continuation_key: cont } : {}) });
      const r = await eb(`/accounts/${c.uid}/transactions?${q}`);
      (r.transactions || []).filter((t: any) => !t.status || t.status === "BOOK").forEach((t: any) => entrantes.push(mapTransaccion(t)));
      cont = r.continuation_key || "";
      if (!cont) break;
    }
    insertados += await insertarMovimientos(supabase, entrantes.filter((m) => m.fecha && r2(m.importe) !== 0), "enable_banking");
  }
  cfg.ultima_sync = new Date().toISOString();
  await guardarPrivado(supabase, "banco_eb", cfg);
  await marcarBancoAlDia(supabase, hoyISO(), "enable_banking");
  return { conectado: true, insertados, desde };
}

async function avisarCaducidad(supabase: any) {
  const cfg = await leerPrivado(supabase, "banco_eb");
  if (!cfg?.valid_until) return;
  const quedan = Math.floor((Date.parse(cfg.valid_until) - Date.now()) / 86400000);
  if (quedan > 10 || cfg.aviso_caducidad === hoyISO()) return;
  await slack(supabase, quedan < 0
    ? "🏦 El permiso del BBVA en el ERP ha *caducado*: entra en Facturación → 🏦 Banco y cobros → Conectar BBVA."
    : `🏦 El permiso del BBVA en el ERP caduca en ${quedan} día(s): renuévalo en Facturación → 🏦 Banco y cobros → Conectar BBVA.`);
  cfg.aviso_caducidad = hoyISO();
  await guardarPrivado(supabase, "banco_eb", cfg);
}

// ==================== EXTRACTOS (PDF / EXCEL) ====================
const ESQUEMA_EXTRACTO = {
  type: "object",
  additionalProperties: false,
  required: ["es_extracto", "movimientos"],
  properties: {
    es_extracto: { type: "boolean" },
    movimientos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["fecha", "fecha_valor", "importe", "saldo", "concepto", "contraparte"],
        properties: {
          fecha: { type: "string", description: "Fecha contable AAAA-MM-DD" },
          fecha_valor: { type: ["string", "null"], description: "Fecha valor AAAA-MM-DD" },
          importe: { type: "number", description: "Positivo si es un ingreso, negativo si es un cargo" },
          saldo: { type: ["number", "null"] },
          concepto: { type: "string", description: "Todo el texto del movimiento, tal cual" },
          contraparte: { type: ["string", "null"], description: "Ordenante (ingreso) o beneficiario (cargo), si aparece" },
        },
      },
    },
  },
};
const INSTRUCCIONES_EXTRACTO = `Es un extracto de movimientos de una cuenta bancaria española (normalmente BBVA). Devuelve TODOS los movimientos, uno por fila, sin saltarte ninguno ni inventar: fecha contable y fecha valor en AAAA-MM-DD, importe con signo (ingresos positivos, cargos negativos; "1.234,56" = 1234.56), saldo después del movimiento si aparece, el concepto completo tal cual (incluido el texto de la transferencia, p. ej. números de factura) y la contraparte (en BBVA es lo que va después de "|" en "TRANSFERENCIAS | NOMBRE"). Si el documento no es un extracto bancario, es_extracto = false y movimientos vacío.`;

async function importarExtracto(supabase: any, body: any, usuario: string) {
  const client = new Anthropic({ apiKey: env("ANTHROPIC_API_KEY") });
  let contenido: any;
  if (body.base64) {
    const b64 = String(body.base64).replace(/^data:[^,]+,/, "");
    if (b64.length > MAX_BASE64) throw new Error("El archivo es demasiado grande (máximo ~15 MB)");
    contenido = { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } };
  } else if (body.texto) {
    contenido = { type: "text", text: `Extracto exportado (${String(body.nombre || "hoja de cálculo")}):\n\n${String(body.texto).slice(0, 400000)}` };
  } else throw new Error("Falta el extracto");
  const response: any = await client.beta.messages.create({
    model: MODELO,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA_EXTRACTO } },
    messages: [{ role: "user", content: [contenido, { type: "text", text: INSTRUCCIONES_EXTRACTO }] }],
  } as any);
  if (response.stop_reason === "max_tokens") throw new Error("El extracto es demasiado largo: súbelo por meses");
  const texto = (response.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  let datos: any;
  try { datos = JSON.parse(texto); } catch { throw new Error("La IA no ha podido leer el extracto"); }
  if (!datos.es_extracto) throw new Error("Esto no parece un extracto bancario");
  const fechaOk = (f: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(f || ""));
  const movs = (datos.movimientos || [])
    .filter((m: any) => fechaOk(m.fecha) && r2(m.importe) !== 0)
    .map((m: any) => ({ fecha: m.fecha, fecha_valor: fechaOk(m.fecha_valor) ? m.fecha_valor : null, importe: r2(m.importe), saldo: m.saldo == null ? null : r2(m.saldo), concepto: String(m.concepto || "").slice(0, 1000), contraparte: m.contraparte ? String(m.contraparte).slice(0, 200) : null, ref_externa: null }));
  if (!movs.length) throw new Error("No se ha encontrado ningún movimiento");
  const insertados = await insertarMovimientos(supabase, movs, "extracto");
  const hasta = movs.map((m: any) => m.fecha).sort().pop();
  const actual = await (async () => { const { data } = await supabase.from("ajustes_sistema").select("valor").eq("clave", "banco_al_dia").maybeSingle(); try { return JSON.parse(data?.valor || "null"); } catch { return null; } })();
  if (!actual?.hasta || hasta > actual.hasta) await marcarBancoAlDia(supabase, hasta, `extracto (${usuario})`);
  const desde = movs.map((m: any) => m.fecha).sort()[0];
  return { ok: true, leidos: movs.length, insertados, desde, hasta, conciliacion: resumen(await conciliarTodo(supabase, usuario)) };
}

// Mete los movimientos que no estén ya (por referencia del banco y, si no, por fecha + importe)
async function insertarMovimientos(supabase: any, entrantes: any[], origen: string) {
  if (!entrantes.length) return 0;
  const fechas = entrantes.map((m) => m.fecha).sort();
  const { data: existentes, error } = await supabase.from("movimientos_banco").select("id, fecha, importe, ref_externa, origen").gte("fecha", fechas[0]).lte("fecha", fechas[fechas.length - 1]);
  if (error) throw new Error(error.code === "42P01" ? "Falta ejecutar el SQL V91" : error.message);
  const refs = new Set((existentes || []).filter((e: any) => e.origen === origen && e.ref_externa).map((e: any) => e.ref_externa));
  const porRef = entrantes.filter((m) => !m.ref_externa || !refs.has(m.ref_externa));
  const refsEntrantes = new Set(entrantes.map((m) => m.ref_externa).filter(Boolean));
  const comparables = (existentes || []).filter((e: any) => !(e.origen === origen && e.ref_externa && refsEntrantes.has(e.ref_externa)));
  // Números de tarjeta completos que trae el extracto ("RECOBRO DEUDA … TARJETA 5478…"): solo los 4 últimos
  const enmascarar = (t: any) => (t == null ? t : String(t).replace(/\b\d{12,15}(\d{4})\b/g, "************$1"));
  const nuevos = movimientosNuevos(comparables, porRef).map((m: any) => ({ ...m, concepto: enmascarar(m.concepto), origen, estado: r2(m.importe) > 0 ? "pendiente" : "cargo" }));
  for (let i = 0; i < nuevos.length; i += 200) {
    const { error: e2 } = await supabase.from("movimientos_banco").insert(nuevos.slice(i, i + 200));
    if (e2) throw new Error("No se pudieron guardar los movimientos: " + e2.message);
  }
  return nuevos.length;
}

// ==================== CONCILIACIÓN ====================
const resumen = (r: any) => ({
  cobradas: r.cobradas, enlazadas: r.enlazadas, sugeridos: r.sugeridos, sin_casar: r.sin_casar, errores: r.errores,
});

async function conciliarTodo(supabase: any, quien: string) {
  const [{ data: movs, error: eM }, { data: facturas }, { data: clientes }, { data: alias }] = await Promise.all([
    supabase.from("movimientos_banco").select("id, fecha, fecha_valor, importe, concepto, contraparte, estado, factura_ids").gt("importe", 0),
    supabase.from("facturas").select("id, cliente_id, fecha, total, estado, tipo, fecha_cobro"),
    supabase.from("clientes").select("id, nombre, cif"),
    supabase.from("alias_banco_cliente").select("contraparte, cliente_id"),
  ]);
  if (eM) throw new Error(eM.code === "42P01" ? "Falta ejecutar el SQL V91" : eM.message);
  const decisiones = conciliar(movs || [], facturas || [], clientes || [], alias || []);
  const fPorId = new Map((facturas || []).map((f: any) => [f.id, f]));
  const cPorId = new Map((clientes || []).map((c: any) => [c.id, c]));
  const res = { cobradas: [] as string[], enlazadas: [] as string[], sugeridos: 0, sin_casar: 0, errores: [] as string[] };
  for (const d of decisiones) {
    const m = (movs || []).find((x: any) => x.id === d.movimiento_id);
    const cambios: any = { estado: d.decision, factura_ids: d.factura_ids.length ? d.factura_ids : null, cliente_id: d.cliente_id, motivo: d.motivo };
    try {
      if (d.decision === "auto") {
        for (const id of d.factura_ids) await cobrarFactura(supabase, fPorId.get(id), d.fecha_cobro, cPorId.get(fPorId.get(id)?.cliente_id));
        cambios.estado = "conciliado";
        res.cobradas.push(...d.factura_ids.map((id: string) => `${id} (${cPorId.get(fPorId.get(id)?.cliente_id)?.nombre || ""}, ${r2(fPorId.get(id)?.total)} €)`));
      } else if (d.decision === "ya_cobrada") {
        if (d.corregir_fecha) for (const id of d.factura_ids) await corregirFechaCobro(supabase, fPorId.get(id), d.fecha_cobro);
        res.enlazadas.push(...d.factura_ids);
      } else if (d.decision === "sugerido") res.sugeridos++;
      else if (d.decision === "sin_casar") res.sin_casar++;
      if (["conciliado", "ya_cobrada"].includes(cambios.estado)) { cambios.conciliado_por = quien; cambios.conciliado_at = new Date().toISOString(); }
      const igual = m && m.estado === cambios.estado && JSON.stringify(m.factura_ids || null) === JSON.stringify(cambios.factura_ids);
      if (!igual) await supabase.from("movimientos_banco").update(cambios).eq("id", d.movimiento_id);
    } catch (e) {
      res.errores.push(`Movimiento ${m?.fecha} ${r2(m?.importe)} €: ${(e as any)?.message || e}`);
    }
  }
  if (res.cobradas.length) await slack(supabase, `💶 *Cobros detectados en el banco* (marcados como cobrados en el ERP):\n${res.cobradas.map((x) => `• ${x}`).join("\n")}`);
  return res;
}

// Igual que registrarCobro() del ERP: factura pagada + asiento COB-<id> 572/430 (sin duplicarlo)
async function cobrarFactura(supabase: any, f: any, fecha: string, cliente: any) {
  if (!f) throw new Error("factura no encontrada");
  const { data: marcada, error } = await supabase.from("facturas").update({ estado: "pagada", fecha_cobro: fecha }).eq("id", f.id).in("estado", ESTADOS_PENDIENTE).select("id");
  if (error) throw new Error(`${f.id}: ${error.message}`);
  if (!marcada?.length) return; // otro proceso la cobró a la vez
  f.estado = "pagada"; f.fecha_cobro = fecha;
  await asientoCobro(supabase, f, fecha, cliente);
}

async function asientoCobro(supabase: any, f: any, fecha: string, cliente: any) {
  const referencia = `COB-${f.id}`;
  const concepto = `Cobro Factura ${f.id}${cliente?.nombre ? " - " + cliente.nombre : ""}`;
  const lineas = (asientoId: any) => [
    { asiento_id: asientoId, cuenta: "572", concepto: "Bancos c/c", debe: r2(f.total), haber: 0 },
    { asiento_id: asientoId, cuenta: "430", concepto: "Clientes", debe: 0, haber: r2(f.total) },
  ];
  const { data: existentes } = await supabase.from("asientos_contables").select("id").eq("referencia", referencia);
  if (existentes?.length) {
    await supabase.from("asientos_contables").update({ concepto, fecha }).eq("id", existentes[0].id);
    await supabase.from("asiento_lineas").delete().eq("asiento_id", existentes[0].id);
    const { error } = await supabase.from("asiento_lineas").insert(lineas(existentes[0].id));
    if (error) throw new Error(`asiento de ${f.id}: ${error.message}`);
    return;
  }
  const { data: ult } = await supabase.from("asientos_contables").select("numero").like("numero", "A%").order("created_at", { ascending: false }).limit(300);
  const max = Math.max(0, ...(ult || []).map((r: any) => parseInt(String(r.numero).replace(/\D/g, ""), 10) || 0));
  const { data: nuevo, error } = await supabase.from("asientos_contables").insert({ fecha, numero: `A${max + 1}`, concepto, referencia }).select().single();
  if (error) throw new Error(`asiento de ${f.id}: ${error.message}`);
  const { error: e2 } = await supabase.from("asiento_lineas").insert(lineas(nuevo.id));
  if (e2) throw new Error(`asiento de ${f.id}: ${e2.message}`);
}

async function corregirFechaCobro(supabase: any, f: any, fecha: string) {
  if (!f || f.estado !== "pagada" || String(f.fecha_cobro || "").slice(0, 10) === fecha) return;
  await supabase.from("facturas").update({ fecha_cobro: fecha }).eq("id", f.id);
  await supabase.from("asientos_contables").update({ fecha }).eq("referencia", `COB-${f.id}`);
  f.fecha_cobro = fecha;
}

async function confirmar(supabase: any, body: any, usuario: string) {
  const id = Number(body.movimiento_id);
  const ids = (Array.isArray(body.factura_ids) ? body.factura_ids : []).map(String);
  if (!id || !ids.length) throw new Error("Elige el movimiento y al menos una factura");
  const { data: m } = await supabase.from("movimientos_banco").select("*").eq("id", id).maybeSingle();
  if (!m) throw new Error("Movimiento no encontrado");
  if (r2(m.importe) <= 0) throw new Error("Solo se pueden casar ingresos con facturas");
  const { data: fs } = await supabase.from("facturas").select("id, cliente_id, fecha, total, estado, tipo, fecha_cobro").in("id", ids);
  if ((fs || []).length !== ids.length) throw new Error("Alguna factura no existe");
  const { data: cls } = await supabase.from("clientes").select("id, nombre").in("id", [...new Set((fs || []).map((f: any) => f.cliente_id))]);
  const fecha = String(m.fecha_valor || m.fecha).slice(0, 10);
  for (const f of fs || []) {
    const c = (cls || []).find((x: any) => x.id === f.cliente_id);
    if (ESTADOS_PENDIENTE.includes(f.estado)) await cobrarFactura(supabase, f, fecha, c);
    else if (f.estado === "pagada") await corregirFechaCobro(supabase, f, fecha);
    else throw new Error(`${f.id} está ${f.estado}`);
  }
  const clientesDistintos = [...new Set((fs || []).map((f: any) => f.cliente_id))];
  const contraparte = String(m.contraparte || "").trim();
  if (contraparte.length >= 4 && clientesDistintos.length === 1) {
    await supabase.from("alias_banco_cliente").insert({ contraparte, cliente_id: clientesDistintos[0] }); // si ya existe, el índice único lo impide (sin error que importe)
  }
  const suma = r2((fs || []).reduce((s: number, f: any) => s + r2(f.total), 0));
  await supabase.from("movimientos_banco").update({ estado: "conciliado", factura_ids: ids, cliente_id: clientesDistintos.length === 1 ? clientesDistintos[0] : null, motivo: `Confirmado a mano${Math.abs(suma - r2(m.importe)) > 0.01 ? ` (facturas ${suma} € ≠ ingreso ${r2(m.importe)} €)` : ""}`, conciliado_por: usuario, conciliado_at: new Date().toISOString() }).eq("id", id);
  return { ok: true, cobradas: ids };
}

async function marcar(supabase: any, body: any, usuario: string) {
  const est = String(body.estado || "");
  if (!["ignorado", "otro", "pendiente"].includes(est)) throw new Error("Estado no válido");
  const { error } = await supabase.from("movimientos_banco").update({ estado: est, factura_ids: null, motivo: est === "pendiente" ? null : `Marcado a mano (${usuario})`, conciliado_por: usuario, conciliado_at: new Date().toISOString() }).eq("id", Number(body.movimiento_id));
  if (error) throw new Error(error.message);
  if (est === "pendiente") await conciliarTodo(supabase, usuario);
  return { ok: true };
}

async function estado(supabase: any) {
  const cfg = await leerPrivado(supabase, "banco_eb");
  const { data: alDia } = await supabase.from("ajustes_sistema").select("valor").eq("clave", "banco_al_dia").maybeSingle();
  return {
    configurado: !!(env("EB_APP_ID") && env("EB_PRIVATE_KEY")),
    conectado: !!cfg?.session_id && (!cfg.valid_until || cfg.valid_until > new Date().toISOString()),
    valid_until: cfg?.valid_until || null,
    ultima_sync: cfg?.ultima_sync || null,
    cuentas: (cfg?.cuentas || []).map((c: any) => ({ iban: c.iban ? `…${c.iban.slice(-4)}` : "", nombre: c.nombre })),
    al_dia: (() => { try { return JSON.parse(alDia?.valor || "null"); } catch { return null; } })(),
    ia_configurada: !!env("ANTHROPIC_API_KEY"),
  };
}

async function slack(supabase: any, text: string) {
  try {
    let webhook = env("SLACK_WEBHOOK_URL");
    if (!webhook) {
      const { data } = await supabase.from("notificaciones_config").select("slack_webhook_url").limit(1).maybeSingle();
      webhook = data?.slack_webhook_url || "";
    }
    if (webhook) await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  } catch (e) {
    console.warn("Slack no enviado", e);
  }
}
