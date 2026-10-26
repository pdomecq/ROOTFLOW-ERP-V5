// Supabase Edge Function: portal-cliente (V82 + V83)
// 1) Backend del área de cliente (src/AreaCliente.jsx). El cliente entra con el enlace
//    https://…/area-cliente?t=<clientes.portal_token> y esta función, con la service role,
//    le devuelve SOLO sus datos. El navegador del cliente nunca lee las tablas directamente.
// 2) V83: PDF de facturas y albaranes, y envío automático de facturas por email (Resend)
//    con el PDF adjunto y el enlace al área de cliente.
//
// Despliegue:  supabase functions deploy portal-cliente --no-verify-jwt
//              (o desde el panel: Edge Functions → portal-cliente → pegar este archivo, "Verify JWT" desactivado)
// Secrets:     RESEND_API_KEY      (obligatorio para enviar emails)
//              FROM_EMAIL          (opcional, por defecto "RootFlow Hydroponics <info@rootflow.es>"; el dominio tiene que estar verificado en Resend)
//              PORTAL_URL          (opcional, por defecto https://www.rootflow.es/area-cliente)
//              SLACK_WEBHOOK_URL   (opcional; si no está, usa notificaciones_config.slack_webhook_url)
//              SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
//
// Acciones (POST JSON):
//   Cliente (con token):
//     { token, accion: 'datos' }
//     { token, accion: 'solicitar', pedido_recurrente_id, items, fecha_desde, mensaje, contacto_nombre }
//     { token, accion: 'cancelar_solicitud', solicitud_id }
//     { token, accion: 'pdf', tipo: 'factura' | 'albaran', id }                → { filename, base64 }
//   ERP (usuario con sesión @rootflow.es; el ERP lo llama con supabase.functions.invoke):
//     { accion: 'admin_estado_envios' }                                         → configuración y qué se enviaría ahora
//     { accion: 'admin_enviar_pendientes' }                                     → envía ya lo que toca (aunque el automático esté apagado)
//     { accion: 'admin_enviar_factura', factura_id, para: ['a@b.es'] }          → envía una factura concreta
//     { accion: 'admin_pdf', tipo, id }
//   Programado (pg_cron, SQL V83) o el propio ERP cada 30 min:
//     { accion: 'cron_enviar_facturas' }   → solo hace algo si el envío automático está activado en el ERP

import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_SOLICITUDES_PENDIENTES = 5;
const MAX_CANTIDAD = 1000;
const MAX_ENVIOS_POR_EJECUCION = 30;
const MAX_INTENTOS_ENVIO = 3;
const DOMINIO_ERP = "@rootflow.es";

// Copia de src/empresa.js (la función se despliega sola y no puede importar el front).
// Si cambias un dato de la empresa, cámbialo en los dos sitios.
const EMPRESA = {
  nombre: "ROOTFLOW HYDROPONICS SL",
  direccion: "C. Nueva, 16, P6",
  cp: "28231",
  ciudad: "Las Rozas de Madrid, Madrid",
  telefono: "+34 638 161 990",
  email: "info@rootflow.es",
  web: "www.rootflow.es",
  cif: "B27535137",
  iban: "ES58 0182 4015 6002 0261 4010",
  banco: "BBVA",
  swift: "BBVAESMMXXX",
};
const LOGO_URL = "https://www.rootflow.es/lovable-uploads/70262e87-198c-4788-b2e9-7b89bef45202.png";
const env = (k: string) => (typeof Deno !== "undefined" ? Deno.env.get(k) : undefined) || "";
const PORTAL_URL = () => env("PORTAL_URL") || "https://www.rootflow.es/area-cliente";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Petición no válida" }, 400);
  }

  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const accion = String(body?.accion || "datos");

  try {
    // ---------- Programado: solo envía si el automático está activado ----------
    if (accion === "cron_enviar_facturas") {
      const r = await ejecutarEnvios(supabase, { forzar: false, origen: "automatico" });
      return json({ ok: true, enviadas: r.enviadas.length, errores: r.errores.length, activo: r.activo });
    }

    // ---------- ERP ----------
    if (accion.startsWith("admin_")) {
      const usuario = await usuarioERP(req, supabase);
      if (!usuario) return json({ error: "Solo para usuarios del ERP" }, 401);
      if (accion === "admin_estado_envios") return json(await estadoEnvios(supabase));
      if (accion === "admin_enviar_pendientes") return json(await ejecutarEnvios(supabase, { forzar: true, origen: usuario }));
      if (accion === "admin_enviar_factura") return json(await enviarFacturaManual(supabase, body, usuario));
      if (accion === "admin_pdf") return json(await generarPdf(supabase, body.tipo, body.id, null));
      return json({ error: "Acción no válida" }, 400);
    }

    // ---------- Cliente con token ----------
    const token = String(body?.token || "").trim();
    if (token.length < 20 || token.length > 100 || !/^[A-Za-z0-9_-]+$/.test(token)) {
      return json({ error: "Enlace no válido" }, 401);
    }
    const { data: cliente, error: errCli } = await supabase
      .from("clientes")
      .select("id, nombre, contacto, email, telefono, direccion, codigo_postal, ciudad, cif, recargo_equivalencia, sepa_activo, plazo_pago_dias, portal_activo, activo")
      .eq("portal_token", token)
      .maybeSingle();
    if (errCli) {
      // 42703: columna portal_token sin crear (SQL V82 sin ejecutar)
      if (errCli.code === "42703") return json({ error: "El área de cliente todavía no está activada." }, 503);
      return json({ error: "Error al cargar los datos" }, 500);
    }
    if (!cliente || cliente.portal_activo === false) {
      return json({ error: "Este enlace no es válido o ha caducado. Pídenos uno nuevo en info@rootflow.es." }, 401);
    }

    if (accion === "datos") return json(await cargarDatos(supabase, cliente));
    if (accion === "solicitar") return await crearSolicitud(supabase, cliente, body);
    if (accion === "cancelar_solicitud") return await cancelarSolicitud(supabase, cliente, body);
    if (accion === "pdf") {
      const r = await generarPdf(supabase, body.tipo, body.id, cliente.id);
      return r.error ? json(r, 404) : json(r);
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    console.error("portal-cliente", accion, e);
    return json({ error: "Error inesperado: " + ((e as any)?.message || e) }, 500);
  }
});

// Usuario del ERP: sesión de Supabase con email confirmado @rootflow.es
async function usuarioERP(req: Request, supabase: any): Promise<string | null> {
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await supabase.auth.getUser(jwt);
  const u = data?.user;
  if (error || !u?.email || !u.email.toLowerCase().endsWith(DOMINIO_ERP) || !u.email_confirmed_at) return null;
  return u.email;
}

// ==================== DATOS ====================
const describirCon = (prodById: Map<any, any>, varById: Map<any, any>) => (productoId: any, nombreGuardado?: string) => {
  const p: any = prodById.get(Number(productoId));
  return {
    producto_id: Number(productoId) || null,
    producto: nombreGuardado || p?.nombre || "Producto",
    variedad: p?.variedad_id ? varById.get(p.variedad_id) || null : null,
    formato_gramos: p?.formato_gramos || null,
    unidad: p?.unidad || "ud",
  };
};

const mapAlbaran = (a: any, describir: any) => ({
  id: a.id,
  fecha: a.fecha_entrega_real || a.fecha_emision,
  fecha_emision: a.fecha_emision,
  estado: a.estado,
  valorado: !!a.valorado,
  numero_factura: a.numero_factura,
  direccion_entrega: a.direccion_entrega || null,
  coste_envio: Number(a.coste_envio) || 0,
  total: Number(a.total) || 0,
  lineas: (Array.isArray(a.items_json) ? a.items_json : []).map((it: any) => {
    const cantidad = Number(it.cantidad) || 0;
    const precio = Number(it.precio_unitario) || 0;
    return { ...describir(it.producto_id, it.producto_nombre), unidad: it.producto_unidad || describir(it.producto_id).unidad, cantidad, precio_unitario: precio, subtotal: Number(it.subtotal) || +(cantidad * precio).toFixed(2) };
  }),
});

const mapFactura = (f: any, grupos: any[]) => ({
  id: f.id,
  fecha: f.fecha,
  fecha_vencimiento: f.fecha_vencimiento,
  estado: f.estado,
  concepto: f.concepto,
  tipo: f.tipo,
  pedido_id: f.pedido_id,
  albaranes_ids: Array.isArray(f.albaranes_ids) ? f.albaranes_ids.map(String) : [],
  periodo_desde: f.periodo_desde,
  periodo_hasta: f.periodo_hasta,
  subtotal: Number(f.subtotal) || 0,
  descuento_aplicado: Number(f.descuento_aplicado) || 0,
  portes_importe: Number(f.portes_importe) || 0,
  base_imponible: Number(f.base_imponible) || 0,
  iva_porcentaje: Number(f.iva_porcentaje) || 4,
  iva: Number(f.iva) || 0,
  recargo_equivalencia: !!f.recargo_equivalencia,
  re_porcentaje: Number(f.re_porcentaje) || 0.5,
  re_importe: Number(f.re_importe) || 0,
  total: Number(f.total) || 0,
  metodo_cobro: f.metodo_cobro,
  plazo_pago_dias: f.plazo_pago_dias,
  fecha_cobro: f.fecha_cobro,
  enviada_at: f.enviada_at || null,
  grupos,
});

async function catalogo(supabase: any) {
  const [productosR, variedadesR] = await Promise.all([
    supabase.from("productos").select("id, nombre, categoria, unidad, formato_gramos, variedad_id, activo").order("nombre"),
    supabase.from("variedades").select("id, nombre"),
  ]);
  const productos = productosR.data || [];
  const prodById = new Map(productos.map((p: any) => [p.id, p]));
  const varById = new Map((variedadesR.data || []).map((v: any) => [v.id, v.nombre]));
  return { productos, describir: describirCon(prodById, varById) };
}

async function cargarDatos(supabase: any, cliente: any) {
  const cid = cliente.id;
  const { productos, describir } = await catalogo(supabase);

  const [facturasR, pedidosR, albaranesR, recurrentesR, solicitudesR] = await Promise.all([
    supabase.from("facturas").select("*").eq("cliente_id", cid).order("fecha", { ascending: false }),
    supabase.from("pedidos").select("id, fecha, fecha_entrega, estado, total, concepto, horario_entrega").eq("cliente_id", cid).order("fecha", { ascending: false }).limit(500),
    supabase.from("albaranes").select("id, fecha_emision, fecha_entrega_real, estado, valorado, items_json, coste_envio, numero_factura, total, direccion_entrega").eq("cliente_id", cid).order("fecha_emision", { ascending: false }).limit(500),
    supabase.from("pedidos_recurrentes").select("id, nombre, frecuencia, dia_semana, activo, proxima_ejecucion, notas").eq("cliente_id", cid),
    supabase.from("solicitudes_cliente").select("id, pedido_recurrente_id, items_json, fecha_desde, mensaje, estado, respuesta, respondida_at, created_at").eq("cliente_id", cid).order("created_at", { ascending: false }),
  ]);

  const pedidos = pedidosR.data || [];
  const pedidoIds = pedidos.map((p: any) => p.id);
  let pedidoItems: any[] = [];
  if (pedidoIds.length) {
    const { data } = await supabase.from("pedido_items").select("pedido_id, producto_id, cantidad, precio_unitario, subtotal").in("pedido_id", pedidoIds);
    pedidoItems = data || [];
  }
  const lineasPedido = (pid: number) =>
    pedidoItems.filter((i) => i.pedido_id === pid).map((i) => ({
      ...describir(i.producto_id),
      cantidad: Number(i.cantidad) || 0,
      precio_unitario: Number(i.precio_unitario) || 0,
      subtotal: Number(i.subtotal) || 0,
    }));

  const albaranes = (albaranesR.data || []).map((a: any) => mapAlbaran(a, describir));
  const albById = new Map(albaranes.map((a: any) => [String(a.id), a]));

  // Facturas: importes tal como se emitieron + líneas (de los albaranes si es agrupada, del pedido si no)
  const facturas = (facturasR.data || [])
    .filter((f: any) => f.estado !== "cancelada")
    .map((f: any) => {
      const albIds: string[] = Array.isArray(f.albaranes_ids) ? f.albaranes_ids.map(String) : [];
      const grupos = albIds.length
        ? albIds.map((id) => albById.get(id)).filter(Boolean).map((a: any) => ({ titulo: `Albarán ${a.id}`, fecha: a.fecha, lineas: a.lineas }))
        : f.pedido_id ? [{ titulo: `Pedido #${f.pedido_id}`, fecha: pedidos.find((p: any) => p.id === f.pedido_id)?.fecha_entrega || null, lineas: lineasPedido(f.pedido_id) }] : [];
      return mapFactura(f, grupos);
    });

  const recurrentes = recurrentesR.data || [];
  let recItems: any[] = [];
  if (recurrentes.length) {
    const { data } = await supabase.from("pedidos_recurrentes_items").select("pedido_recurrente_id, producto_id, cantidad").in("pedido_recurrente_id", recurrentes.map((r: any) => r.id));
    recItems = data || [];
  }

  return {
    cliente: {
      nombre: cliente.nombre,
      contacto: cliente.contacto,
      email: cliente.email,
      direccion: cliente.direccion,
      codigo_postal: cliente.codigo_postal,
      ciudad: cliente.ciudad,
      cif: cliente.cif,
      sepa_activo: !!cliente.sepa_activo,
      plazo_pago_dias: cliente.plazo_pago_dias || 30,
    },
    facturas,
    pedidos: pedidos.map((p: any) => ({ ...p, total: Number(p.total) || 0, lineas: lineasPedido(p.id) })),
    albaranes,
    recurrentes: recurrentes.map((r: any) => ({
      ...r,
      lineas: recItems.filter((i) => i.pedido_recurrente_id === r.id).map((i) => ({ ...describir(i.producto_id), cantidad: Number(i.cantidad) || 0 })),
    })),
    solicitudes: solicitudesR.error ? [] : solicitudesR.data || [],
    catalogo: productos.filter((p: any) => p.activo !== false).map((p: any) => describir(p.id)),
  };
}

// Una factura completa con sus líneas (para el PDF y el email)
async function cargarFactura(supabase: any, facturaId: string) {
  const { data: f } = await supabase.from("facturas").select("*").eq("id", facturaId).maybeSingle();
  if (!f) return null;
  const { describir } = await catalogo(supabase);
  const { data: cliente } = await supabase.from("clientes").select("*").eq("id", f.cliente_id).maybeSingle();
  const albIds: string[] = Array.isArray(f.albaranes_ids) ? f.albaranes_ids.map(String) : [];
  let grupos: any[] = [];
  if (albIds.length) {
    const { data: albs } = await supabase.from("albaranes").select("*").in("id", albIds);
    grupos = albIds.map((id) => (albs || []).find((a: any) => String(a.id) === id)).filter(Boolean)
      .map((a: any) => mapAlbaran(a, describir)).map((a: any) => ({ titulo: `Albarán ${a.id}`, fecha: a.fecha, lineas: a.lineas }));
  } else if (f.pedido_id) {
    const [{ data: its }, { data: ped }] = await Promise.all([
      supabase.from("pedido_items").select("producto_id, cantidad, precio_unitario, subtotal").eq("pedido_id", f.pedido_id),
      supabase.from("pedidos").select("fecha_entrega").eq("id", f.pedido_id).maybeSingle(),
    ]);
    grupos = [{
      titulo: `Pedido #${f.pedido_id}`, fecha: ped?.fecha_entrega || null,
      lineas: (its || []).map((i: any) => ({ ...describir(i.producto_id), cantidad: Number(i.cantidad) || 0, precio_unitario: Number(i.precio_unitario) || 0, subtotal: Number(i.subtotal) || 0 })),
    }];
  }
  return { factura: mapFactura(f, grupos), cliente };
}

// ==================== PDF ====================
async function generarPdf(supabase: any, tipo: string, id: any, clienteIdObligatorio: number | null) {
  if (tipo === "factura") {
    const r = await cargarFactura(supabase, String(id));
    if (!r || r.factura.estado === "cancelada" || (clienteIdObligatorio && r.cliente?.id !== clienteIdObligatorio)) return { error: "Factura no encontrada" };
    return { filename: `Factura-${r.factura.id}.pdf`, base64: bytesABase64(await pdfFactura(r.factura, r.cliente)) };
  }
  if (tipo === "albaran") {
    const { data: a } = await supabase.from("albaranes").select("*").eq("id", String(id)).maybeSingle();
    if (!a || (clienteIdObligatorio && a.cliente_id !== clienteIdObligatorio)) return { error: "Albarán no encontrado" };
    const { describir } = await catalogo(supabase);
    const { data: cliente } = await supabase.from("clientes").select("*").eq("id", a.cliente_id).maybeSingle();
    return { filename: `Albaran-${a.id}.pdf`, base64: bytesABase64(await pdfAlbaran(mapAlbaran(a, describir), cliente, a)) };
  }
  return { error: "Tipo no válido" };
}

export function bytesABase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// Las fuentes estándar de PDF solo saben escribir Latin-1 (+ €, comillas tipográficas…): quitamos el resto (emojis, etc.)
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export const pdfTexto = (t: any) =>
  Array.from(String(t ?? "")).map((ch) => {
    const c = ch.charCodeAt(0);
    if (ch === "\t" || ch === "\n" || ch === "\r") return " ";
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WINANSI_EXTRA.includes(ch)) return ch;
    return "";
  }).join("");

const eur = (n: any) => {
  const v = Number(n) || 0;
  const [ent, dec] = Math.abs(v).toFixed(2).split(".");
  return `${v < 0 ? "-" : ""}${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec} €`;
};
const fechaES = (d: any) => {
  if (!d) return "—";
  const s = String(d).slice(0, 10);
  const [y, m, dd] = s.split("-");
  return y && m && dd ? `${dd}/${m}/${y}` : s;
};
const nombreLinea = (l: any) => [l.producto, l.formato_gramos ? `${l.formato_gramos} g` : null].filter(Boolean).join(" · ");

let logoCache: Uint8Array | null | undefined;
async function logoBytes() {
  if (logoCache !== undefined) return logoCache;
  try {
    const r = await fetch(LOGO_URL);
    logoCache = r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch {
    logoCache = null;
  }
  return logoCache;
}

// Mini maquetador A4 con salto de página automático
async function nuevoDocumento() {
  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const negrita = await doc.embedFont(StandardFonts.HelveticaBold);
  let logo: any = null;
  const lb = await logoBytes();
  if (lb) { try { logo = await doc.embedPng(lb); } catch { logo = null; } }
  const W = 595.28, H = 841.89, M = 42;
  const ctx: any = { doc, fuente, negrita, logo, W, H, M, page: null, y: 0 };
  ctx.nuevaPagina = () => { ctx.page = doc.addPage([W, H]); ctx.y = H - M; return ctx.page; };
  ctx.texto = (t: any, x: number, y: number, o: any = {}) => {
    const f = o.bold ? negrita : fuente, size = o.size || 9;
    let s = pdfTexto(t);
    if (o.maxW) while (s.length > 1 && f.widthOfTextAtSize(s, size) > o.maxW) s = s.slice(0, -2) + "…";
    const w = f.widthOfTextAtSize(s, size);
    const xx = o.align === "right" ? x - w : o.align === "center" ? x - w / 2 : x;
    ctx.page.drawText(s, { x: xx, y, size, font: f, color: o.color || rgb(0.13, 0.13, 0.13) });
    return w;
  };
  // Parte un texto en líneas que caben en maxW
  ctx.partir = (t: any, maxW: number, size = 9, bold = false) => {
    const f = bold ? negrita : fuente;
    const palabras = pdfTexto(t).split(/\s+/).filter(Boolean);
    const lineas: string[] = [];
    let actual = "";
    for (const p of palabras) {
      const prueba = actual ? actual + " " + p : p;
      if (f.widthOfTextAtSize(prueba, size) > maxW && actual) { lineas.push(actual); actual = p; } else actual = prueba;
    }
    if (actual) lineas.push(actual);
    return lineas;
  };
  ctx.rect = (x: number, y: number, w: number, h: number, color: any) => ctx.page.drawRectangle({ x, y, width: w, height: h, color });
  ctx.linea = (x1: number, y1: number, x2: number, y2: number, color = rgb(0.85, 0.85, 0.85), grosor = 0.6) =>
    ctx.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: grosor, color });
  ctx.necesita = (alto: number, alSaltar?: () => void) => {
    if (ctx.y - alto < M + 30) { ctx.nuevaPagina(); if (alSaltar) alSaltar(); }
  };
  return ctx;
}

const VERDE = rgb(0.016, 0.47, 0.34);
const NARANJA = rgb(0.976, 0.451, 0.086);
const GRIS = rgb(0.45, 0.45, 0.45);
const FONDO = rgb(0.965, 0.965, 0.965);
const BLANCO = rgb(1, 1, 1);

function cabecera(ctx: any, titulo: string, numero: string, datos: string[]) {
  const { M, W } = ctx;
  if (ctx.logo) ctx.page.drawImage(ctx.logo, { x: M, y: ctx.y - 40, width: 40, height: 40 });
  const xMarca = ctx.logo ? M + 48 : M;
  const wRoot = ctx.texto("Root", xMarca, ctx.y - 20, { bold: true, size: 18 });
  ctx.texto("Flow", xMarca + wRoot, ctx.y - 20, { bold: true, size: 18, color: NARANJA });
  ctx.texto("HYDROPONICS", xMarca, ctx.y - 33, { size: 7.5, color: GRIS });
  ctx.texto(titulo, W - M, ctx.y - 18, { bold: true, size: 20, color: VERDE, align: "right" });
  ctx.texto(numero, W - M, ctx.y - 32, { bold: true, size: 11, align: "right" });
  datos.forEach((d, i) => ctx.texto(d, W - M, ctx.y - 45 - i * 11, { size: 8.5, color: GRIS, align: "right" }));
  ctx.y -= 52 + Math.max(0, datos.length - 1) * 11;
}

function cajasPartes(ctx: any, cliente: any, direccionEntrega?: string | null) {
  const { M, W } = ctx;
  const ancho = (W - 2 * M - 12) / 2;
  const emisor = [EMPRESA.nombre, EMPRESA.direccion, `${EMPRESA.cp} ${EMPRESA.ciudad}`, `CIF: ${EMPRESA.cif}`, `${EMPRESA.telefono} · ${EMPRESA.email}`];
  const cli = [
    cliente?.nombre || "Cliente",
    direccionEntrega || cliente?.direccion || "",
    [cliente?.codigo_postal, cliente?.ciudad].filter(Boolean).join(" "),
    `CIF: ${cliente?.cif || "—"}`,
    cliente?.email || "",
  ].filter(Boolean);
  const alto = 20 + Math.max(emisor.length, cli.length) * 11;
  const y0 = ctx.y - 8;
  [[emisor, "EMISOR"], [cli, "CLIENTE"]].forEach(([lineas, et]: any, i) => {
    const x = M + i * (ancho + 12);
    ctx.rect(x, y0 - alto, ancho, alto, FONDO);
    ctx.texto(et, x + 10, y0 - 13, { bold: true, size: 7, color: GRIS });
    lineas.forEach((l: string, k: number) => ctx.texto(l, x + 10, y0 - 25 - k * 11, { size: 8.5, bold: k === 0, maxW: ancho - 20 }));
  });
  ctx.y = y0 - alto - 14;
}

// Tabla de líneas. columnas: [{ titulo, x, align, w }]
function tablaLineas(ctx: any, grupos: any[], conPrecios: boolean) {
  const { M, W } = ctx;
  const cols = conPrecios
    ? [{ t: "Descripción", x: M + 8 }, { t: "Cant.", x: W - M - 190, a: "right" }, { t: "Precio", x: W - M - 100, a: "right" }, { t: "Importe", x: W - M - 8, a: "right" }]
    : [{ t: "Descripción", x: M + 8 }, { t: "Cantidad", x: W - M - 60, a: "right" }, { t: "Ud.", x: W - M - 8, a: "right" }];
  const encabezado = () => {
    ctx.rect(M, ctx.y - 18, W - 2 * M, 18, VERDE);
    cols.forEach((c: any) => ctx.texto(c.t.toUpperCase(), c.x, ctx.y - 12.5, { bold: true, size: 7.5, color: BLANCO, align: c.a }));
    ctx.y -= 18;
  };
  encabezado();
  const anchoDesc = (conPrecios ? W - M - 190 - 40 : W - M - 60 - 40) - (M + 8);
  for (const g of grupos) {
    if (grupos.length > 1) {
      ctx.necesita(36, encabezado);
      ctx.rect(M, ctx.y - 15, W - 2 * M, 15, FONDO);
      ctx.texto(`${g.titulo}${g.fecha ? " · " + fechaES(g.fecha) : ""}`, M + 8, ctx.y - 10.5, { bold: true, size: 7.5, color: GRIS });
      ctx.y -= 15;
    }
    if (!g.lineas.length) {
      ctx.necesita(18, encabezado);
      ctx.texto("(sin líneas)", M + 8, ctx.y - 12, { size: 8.5, color: GRIS });
      ctx.y -= 18;
    }
    for (const l of g.lineas) {
      ctx.necesita(18, encabezado);
      ctx.texto(nombreLinea(l) + (l.variedad ? `  (${l.variedad})` : ""), M + 8, ctx.y - 12, { size: 8.5, maxW: anchoDesc });
      if (conPrecios) {
        ctx.texto(String(l.cantidad), cols[1].x, ctx.y - 12, { size: 8.5, align: "right" });
        ctx.texto(eur(l.precio_unitario), cols[2].x, ctx.y - 12, { size: 8.5, align: "right" });
        ctx.texto(eur(l.subtotal), cols[3].x, ctx.y - 12, { size: 8.5, bold: true, align: "right" });
      } else {
        ctx.texto(String(l.cantidad), cols[1].x, ctx.y - 12, { size: 8.5, bold: true, align: "right" });
        ctx.texto(l.unidad || "ud", cols[2].x, ctx.y - 12, { size: 8.5, align: "right" });
      }
      ctx.linea(M, ctx.y - 17, W - M, ctx.y - 17);
      ctx.y -= 18;
    }
  }
  ctx.y -= 8;
}

function pie(ctx: any) {
  const paginas = ctx.doc.getPages();
  paginas.forEach((p: any, i: number) => {
    ctx.page = p;
    ctx.texto(`${EMPRESA.nombre} · CIF ${EMPRESA.cif} · ${EMPRESA.direccion}, ${EMPRESA.cp} ${EMPRESA.ciudad} · ${EMPRESA.telefono} · ${EMPRESA.email}`, ctx.W / 2, 24, { size: 6.8, color: GRIS, align: "center" });
    if (paginas.length > 1) ctx.texto(`Página ${i + 1} de ${paginas.length}`, ctx.W - ctx.M, 13, { size: 6.8, color: GRIS, align: "right" });
  });
}

export async function pdfFactura(f: any, cliente: any) {
  const ctx = await nuevoDocumento();
  const { M, W } = ctx;
  ctx.nuevaPagina();
  cabecera(ctx, "FACTURA", f.id, [`Fecha: ${fechaES(f.fecha)}`, `Vencimiento: ${fechaES(f.fecha_vencimiento)}`]);
  cajasPartes(ctx, cliente);
  if (f.concepto) {
    for (const l of ctx.partir(f.concepto, W - 2 * M, 8.5)) { ctx.texto(l, M, ctx.y - 10, { size: 8.5, color: GRIS }); ctx.y -= 11; }
    ctx.y -= 6;
  }
  tablaLineas(ctx, f.grupos || [], true);

  // Totales
  const filas: [string, string, boolean?][] = [["Subtotal", eur(f.subtotal)]];
  if (f.descuento_aplicado > 0) filas.push(["Descuento", "-" + eur(f.descuento_aplicado)]);
  if (f.portes_importe > 0) filas.push(["Portes (incluidos)", eur(f.portes_importe)]);
  filas.push(["Base imponible", eur(f.base_imponible)]);
  filas.push([`IVA (${f.iva_porcentaje}%)`, eur(f.iva)]);
  if (f.recargo_equivalencia) filas.push([`Recargo de equivalencia (${f.re_porcentaje}%)`, eur(f.re_importe)]);
  ctx.necesita(filas.length * 16 + 30);
  const xL = W - M - 220;
  filas.forEach(([l, v]) => {
    ctx.texto(l, xL, ctx.y - 11, { size: 9, color: GRIS });
    ctx.texto(v, W - M, ctx.y - 11, { size: 9, align: "right" });
    ctx.linea(xL, ctx.y - 16, W - M, ctx.y - 16);
    ctx.y -= 16;
  });
  ctx.linea(xL, ctx.y - 2, W - M, ctx.y - 2, VERDE, 1.5);
  ctx.texto("TOTAL", xL, ctx.y - 18, { bold: true, size: 13, color: VERDE });
  ctx.texto(eur(f.total), W - M, ctx.y - 18, { bold: true, size: 13, color: VERDE, align: "right" });
  ctx.y -= 34;

  // Pago
  const sepa = cliente?.sepa_activo && f.metodo_cobro === "sepa_b2b";
  const plazo = f.plazo_pago_dias || cliente?.plazo_pago_dias || 30;
  const pago: string[] = f.estado === "pagada"
    ? [`Factura pagada${f.fecha_cobro ? " el " + fechaES(f.fecha_cobro) : ""}. Gracias.`]
    : sepa
      ? [`Cobro por domiciliación SEPA B2B el ${fechaES(f.fecha_vencimiento)} en la cuenta del mandato firmado${cliente?.sepa_mandato_ref ? " (mandato " + cliente.sepa_mandato_ref + ")" : ""}.`]
      : [`Pago por transferencia · Titular: ${EMPRESA.nombre} · Banco: ${EMPRESA.banco}`, `IBAN: ${EMPRESA.iban} · BIC: ${EMPRESA.swift} · Concepto: ${f.id}`];
  const legal = ctx.partir(`Plazo de pago: ${plazo} días desde la fecha de factura (Ley 15/2010, productos perecederos). El impago en plazo devengará intereses de demora conforme al art. 7 de la Ley 3/2004, de 29 de diciembre.`, W - 2 * M - 20, 7.5);
  const alto = 18 + pago.length * 12 + legal.length * 9.5 + 8;
  ctx.necesita(alto + 10);
  ctx.rect(M, ctx.y - alto, W - 2 * M, alto, rgb(0.93, 0.98, 0.95));
  ctx.rect(M, ctx.y - alto, 3, alto, VERDE);
  ctx.texto(f.estado === "pagada" ? "PAGADA" : sepa ? "DOMICILIACIÓN SEPA" : "DATOS DE PAGO", M + 12, ctx.y - 13, { bold: true, size: 7.5, color: VERDE });
  pago.forEach((l, i) => ctx.texto(l, M + 12, ctx.y - 27 - i * 12, { size: 9, bold: i === 1 }));
  legal.forEach((l: string, i: number) => ctx.texto(l, M + 12, ctx.y - 27 - pago.length * 12 - 2 - i * 9.5, { size: 7.5, color: GRIS }));
  ctx.y -= alto + 10;

  pie(ctx);
  return await ctx.doc.save();
}

export async function pdfAlbaran(a: any, cliente: any, original: any) {
  const ctx = await nuevoDocumento();
  const { M, W } = ctx;
  ctx.nuevaPagina();
  const datos = [`Emisión: ${fechaES(a.fecha_emision)}`];
  if (original?.fecha_entrega_real) datos.push(`Entrega: ${fechaES(original.fecha_entrega_real)}`);
  if (a.numero_factura) datos.push(`Factura: ${a.numero_factura}`);
  cabecera(ctx, "ALBARÁN", a.id, datos);
  cajasPartes(ctx, cliente, a.direccion_entrega);
  tablaLineas(ctx, [{ titulo: "", lineas: a.lineas }], a.valorado);
  if (a.valorado) {
    ctx.necesita(60);
    const xL = W - M - 220;
    const filas: [string, string][] = [];
    if (a.coste_envio > 0) filas.push(["Portes", eur(a.coste_envio)]);
    if (Number(original?.base_imponible) > 0) filas.push(["Base imponible", eur(original.base_imponible)]);
    if (Number(original?.iva) > 0) filas.push([`IVA (${Number(original.iva_porcentaje) || 4}%)`, eur(original.iva)]);
    if (Number(original?.re_importe) > 0) filas.push(["Recargo de equivalencia", eur(original.re_importe)]);
    filas.push(["TOTAL", eur(a.total)]);
    filas.forEach(([l, v], i) => {
      const ultimo = i === filas.length - 1;
      ctx.texto(l, xL, ctx.y - 11, { size: ultimo ? 11 : 9, bold: ultimo, color: ultimo ? VERDE : GRIS });
      ctx.texto(v, W - M, ctx.y - 11, { size: ultimo ? 11 : 9, bold: ultimo, color: ultimo ? VERDE : undefined, align: "right" });
      ctx.y -= 16;
    });
  } else {
    ctx.texto("Albarán sin valorar: los importes constan en la factura.", M, ctx.y - 10, { size: 8.5, color: GRIS });
    ctx.y -= 20;
  }
  if (original?.notas) {
    ctx.necesita(30);
    for (const l of ctx.partir("Notas: " + original.notas, W - 2 * M, 8.5)) { ctx.texto(l, M, ctx.y - 10, { size: 8.5 }); ctx.y -= 11; }
  }
  pie(ctx);
  return await ctx.doc.save();
}

// ==================== ENVÍO DE FACTURAS ====================
async function leerConfig(supabase: any) {
  const { data } = await supabase.from("ajustes_sistema").select("clave, valor").like("clave", "facturas_envio_%");
  const m: Record<string, string> = {};
  (data || []).forEach((r: any) => { m[r.clave] = r.valor; });
  return {
    activo: m.facturas_envio_auto === "true",
    desde: /^\d{4}-\d{2}-\d{2}$/.test(m.facturas_envio_desde || "") ? m.facturas_envio_desde : null,
    copia: (m.facturas_envio_copia || "").split(/[,;\s]+/).filter(esEmail),
    ultima: (() => { try { return JSON.parse(m.facturas_envio_ultima || "null"); } catch { return null; } })(),
  };
}

async function guardarAjuste(supabase: any, clave: string, valor: string) {
  const { data } = await supabase.from("ajustes_sistema").select("id").eq("clave", clave).limit(1);
  if (data?.length) await supabase.from("ajustes_sistema").update({ valor, updated_at: new Date().toISOString() }).eq("id", data[0].id);
  else await supabase.from("ajustes_sistema").insert({ clave, valor, tipo: "json", descripcion: "V83: resultado del último envío automático de facturas" });
}

const esEmail = (x: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x);
export const destinatariosCliente = (c: any) =>
  String(c?.email_facturacion || c?.email || "").split(/[,;\s]+/).map((x) => x.trim()).filter(esEmail);

// Decide si una factura toca enviarse ya. Devuelve null si sí, o el motivo por el que no.
export function motivoNoEnviar(f: any, c: any, pedido: any, albaranesPedido: any[], cfg: { desde: string | null }) {
  if (!["pendiente", "vencida"].includes(f.estado)) return "no está pendiente";
  if (f.enviada_at) return "ya enviada";
  if ((Number(f.envio_intentos) || 0) >= MAX_INTENTOS_ENVIO) return `falló ${MAX_INTENTOS_ENVIO} veces: revisa el email del cliente`;
  if (!c) return "sin cliente";
  if (c.envio_facturas_auto === false) return "envío automático desactivado en la ficha del cliente";
  if (!destinatariosCliente(c).length) return "el cliente no tiene email";
  if (cfg.desde && String(f.fecha) < cfg.desde) return `anterior al ${fechaES(cfg.desde)} (fecha de inicio del envío automático)`;
  const agrupada = f.tipo === "agrupada" || (Array.isArray(f.albaranes_ids) && f.albaranes_ids.length > 0);
  if (!agrupada && f.pedido_id) {
    const entregado = pedido?.estado === "entregado" || albaranesPedido.some((a) => ["entregado", "facturado"].includes(a.estado));
    if (!entregado) return "esperando a que el pedido se entregue";
  }
  return null;
}

async function candidatos(supabase: any) {
  const cfg = await leerConfig(supabase);
  const { data: facturas, error } = await supabase.from("facturas").select("*").in("estado", ["pendiente", "vencida"]).is("enviada_at", null).order("fecha");
  if (error) throw error;
  const lista = facturas || [];
  const cliIds = [...new Set(lista.map((f: any) => f.cliente_id))];
  const pedIds = [...new Set(lista.map((f: any) => f.pedido_id).filter(Boolean))];
  const [{ data: clientes }, { data: pedidos }, { data: alPed }] = await Promise.all([
    cliIds.length ? supabase.from("clientes").select("*").in("id", cliIds) : { data: [] },
    pedIds.length ? supabase.from("pedidos").select("id, estado").in("id", pedIds) : { data: [] },
    pedIds.length ? supabase.from("albaran_pedidos").select("albaran_id, pedido_id").in("pedido_id", pedIds) : { data: [] },
  ]);
  const albIds = [...new Set((alPed || []).map((x: any) => x.albaran_id))];
  const { data: albs } = albIds.length ? await supabase.from("albaranes").select("id, estado").in("id", albIds) : { data: [] };
  const filas = lista.map((f: any) => {
    const c = (clientes || []).find((x: any) => x.id === f.cliente_id);
    const p = (pedidos || []).find((x: any) => x.id === f.pedido_id);
    const albsP = (alPed || []).filter((x: any) => x.pedido_id === f.pedido_id).map((x: any) => (albs || []).find((a: any) => a.id === x.albaran_id)).filter(Boolean);
    return { f, c, motivo: motivoNoEnviar(f, c, p, albsP, cfg) };
  });
  return { cfg, filas };
}

async function estadoEnvios(supabase: any) {
  const { cfg, filas } = await candidatos(supabase);
  return {
    activo: cfg.activo,
    desde: cfg.desde,
    copia: cfg.copia,
    ultima: cfg.ultima,
    resend_configurado: !!env("RESEND_API_KEY"),
    facturas: filas.map(({ f, c, motivo }: any) => ({
      id: f.id, fecha: f.fecha, total: Number(f.total) || 0, cliente: c?.nombre || "—",
      periodicidad: c?.periodicidad_facturacion || "por_pedido",
      para: destinatariosCliente(c), se_enviara: !motivo, motivo, error: f.envio_error || null,
    })),
  };
}

async function ejecutarEnvios(supabase: any, { forzar, origen }: { forzar: boolean; origen: string }) {
  const { cfg, filas } = await candidatos(supabase);
  const res = { activo: cfg.activo, enviadas: [] as any[], errores: [] as any[], omitidas: filas.filter((x: any) => x.motivo).length };
  if (!cfg.activo && !forzar) return res;
  for (const { f, c } of filas.filter((x: any) => !x.motivo).slice(0, MAX_ENVIOS_POR_EJECUCION)) {
    const para = destinatariosCliente(c);
    const r = await enviarFactura(supabase, f.id, para, cfg.copia, true);
    if (r.ok) res.enviadas.push({ id: f.id, cliente: c.nombre, para });
    else if (!r.omitida) res.errores.push({ id: f.id, cliente: c.nombre, error: r.error });
  }
  if (res.enviadas.length || res.errores.length || forzar) {
    await guardarAjuste(supabase, "facturas_envio_ultima", JSON.stringify({ fecha: new Date().toISOString(), origen, enviadas: res.enviadas.length, errores: res.errores }));
  }
  return res;
}

async function enviarFacturaManual(supabase: any, body: any, usuario: string) {
  const cfg = await leerConfig(supabase);
  const para = (Array.isArray(body.para) ? body.para : String(body.para || "").split(/[,;\s]+/)).map((x: string) => String(x).trim()).filter(esEmail);
  if (!para.length) return { ok: false, error: "Sin destinatarios válidos" };
  return await enviarFactura(supabase, String(body.factura_id), para, cfg.copia, false, usuario);
}

// Envía una factura. Si "reclamar" es true, marca la factura como enviada ANTES de enviar
// (solo si nadie lo ha hecho ya) para que dos ejecuciones a la vez no la manden dos veces.
async function enviarFactura(supabase: any, facturaId: string, para: string[], copia: string[], reclamar: boolean, usuario?: string) {
  const ahora = new Date().toISOString();
  if (reclamar) {
    const { data: claim, error } = await supabase.from("facturas").update({ enviada_at: ahora, enviada_a: para.join(", ") }).eq("id", facturaId).is("enviada_at", null).select("id");
    if (error) return { ok: false, error: error.message };
    if (!claim?.length) return { ok: false, omitida: true, error: "ya enviada" };
  }
  try {
    const r = await cargarFactura(supabase, facturaId);
    if (!r) throw new Error("Factura no encontrada");
    const { factura, cliente } = r;
    const token = await asegurarToken(supabase, cliente);
    const { data: pend } = await supabase.from("facturas").select("id, fecha, fecha_vencimiento, total, estado").eq("cliente_id", cliente.id).in("estado", ["pendiente", "vencida"]).order("fecha");
    const pdf = await pdfFactura(factura, cliente);
    const asunto = `Factura ${factura.id} · RootFlow Hydroponics`;
    const html = htmlEmailFactura(factura, cliente, token, pend || []);
    const envio = await enviarResend({ para, copia, asunto, html, adjuntos: [{ filename: `Factura-${factura.id}.pdf`, content: bytesABase64(pdf) }] });
    await supabase.from("email_log").insert({ destinatarios: para.join(", "), asunto, alerta_id: `factura:${factura.id}`, estado: envio.ok ? "enviado" : "error", respuesta: envio.ok ? JSON.stringify({ id: envio.id, por: usuario || "automatico" }) : envio.error });
    if (!envio.ok) throw new Error(envio.error);
    const marca: any = { enviada_at: ahora, enviada_a: para.join(", "), envio_error: null };
    let { error: e2 } = await supabase.from("facturas").update(marca).eq("id", facturaId);
    if (e2?.code === "42703") { delete marca.envio_error; await supabase.from("facturas").update(marca).eq("id", facturaId); }
    return { ok: true, id: envio.id, para };
  } catch (e) {
    const msg = String((e as any)?.message || e).slice(0, 500);
    if (reclamar) {
      // Liberar la factura para el siguiente intento y apuntar el error
      const { data: f } = await supabase.from("facturas").select("envio_intentos").eq("id", facturaId).maybeSingle();
      const { error: e3 } = await supabase.from("facturas").update({ enviada_at: null, enviada_a: null, envio_error: msg, envio_intentos: (Number(f?.envio_intentos) || 0) + 1 }).eq("id", facturaId);
      if (e3?.code === "42703") await supabase.from("facturas").update({ enviada_at: null, enviada_a: null }).eq("id", facturaId);
    }
    return { ok: false, error: msg };
  }
}

async function asegurarToken(supabase: any, cliente: any) {
  if (cliente.portal_token) return cliente.portal_token;
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const { error } = await supabase.from("clientes").update({ portal_token: token, portal_activo: true }).eq("id", cliente.id).is("portal_token", null);
  if (error) throw new Error("No se pudo crear el enlace del área de cliente: " + error.message);
  const { data } = await supabase.from("clientes").select("portal_token").eq("id", cliente.id).maybeSingle();
  return data?.portal_token || token;
}

async function enviarResend({ para, copia, asunto, html, adjuntos }: any) {
  const key = env("RESEND_API_KEY");
  if (!key) return { ok: false, error: "Falta el secret RESEND_API_KEY en Supabase (Edge Functions → Secrets)" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: env("FROM_EMAIL") || "RootFlow Hydroponics <info@rootflow.es>",
      to: para,
      ...(copia?.length ? { bcc: copia } : {}),
      reply_to: EMPRESA.email,
      subject: asunto,
      html,
      attachments: adjuntos,
    }),
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* sin cuerpo */ }
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${data?.message || data?.error || "error"}` };
  return { ok: true, id: data?.id };
}

const esc = (t: any) => String(t ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[ch]);
const urlPortal = (token: string, facturaId?: string) => `${PORTAL_URL()}?t=${encodeURIComponent(token)}${facturaId ? `&factura=${encodeURIComponent(facturaId)}` : ""}`;

export function htmlEmailFactura(f: any, c: any, token: string, pendientes: any[]) {
  const fila = (l: string, v: string, extra = "") => `<tr><td style="padding:6px 0;color:#555;${extra}">${l}</td><td style="padding:6px 0;text-align:right;${extra}">${v}</td></tr>`;
  const sepa = c?.sepa_activo && f.metodo_cobro === "sepa_b2b";
  const otras = pendientes.filter((p) => p.id !== f.id);
  const totalPend = pendientes.reduce((s, p) => s + (Number(p.total) || 0), 0);
  const hoy = new Date().toISOString().slice(0, 10);
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;padding:28px;">
    <div style="margin-bottom:20px;"><img src="${LOGO_URL}" alt="RootFlow" width="44" style="vertical-align:middle;"> <span style="font-size:22px;font-weight:800;vertical-align:middle;">Root<span style="color:#F97316;">Flow</span></span></div>
    <p style="font-size:15px;">Hola ${esc(c?.contacto || c?.nombre || "")},</p>
    <p style="font-size:15px;">Te enviamos la factura <strong>${esc(f.id)}</strong> del ${fechaES(f.fecha)}${f.periodo_desde ? ` (entregas del ${fechaES(f.periodo_desde)} al ${fechaES(f.periodo_hasta)})` : ""}. La tienes en PDF adjunta a este correo.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0;border-top:1px solid #eee;">
      ${fila("Base imponible", eur(f.base_imponible))}
      ${fila(`IVA (${f.iva_porcentaje}%)`, eur(f.iva))}
      ${f.recargo_equivalencia ? fila(`Recargo de equivalencia (${f.re_porcentaje}%)`, eur(f.re_importe)) : ""}
      ${fila("<strong>Total</strong>", `<strong>${eur(f.total)}</strong>`, "border-top:2px solid #333;font-size:16px;")}
      ${fila("Vencimiento", fechaES(f.fecha_vencimiento))}
    </table>
    <p style="font-size:14px;">${sepa
      ? `Se cobrará por domiciliación SEPA B2B el ${fechaES(f.fecha_vencimiento)} en la cuenta del mandato firmado.`
      : `Pago por transferencia a ${esc(EMPRESA.nombre)} (${esc(EMPRESA.banco)}) · IBAN <strong>${esc(EMPRESA.iban)}</strong> · Concepto: ${esc(f.id)}.`}</p>
    ${otras.length ? `
    <div style="margin:18px 0;padding:14px;border:1px solid #eee;border-radius:10px;">
      <p style="margin:0 0 8px;font-size:14px;"><strong>Tus facturas pendientes con nosotros</strong> (${eur(totalPend)} en total)</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${pendientes.map((p) => `<tr><td style="padding:4px 0;">${esc(p.id)}${p.id === f.id ? " <em>(esta)</em>" : ""}</td><td style="padding:4px 0;color:${p.estado === "vencida" || (p.fecha_vencimiento && p.fecha_vencimiento < hoy) ? "#DC2626" : "#555"};">vence ${fechaES(p.fecha_vencimiento)}</td><td style="padding:4px 0;text-align:right;"><a href="${urlPortal(token, p.id)}" style="color:#047857;">${eur(p.total)}</a></td></tr>`).join("")}
      </table>
    </div>` : ""}
    <p style="margin:20px 0;"><a href="${urlPortal(token, f.id)}" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px;">Ver la factura en mi área de cliente</a></p>
    <div style="margin-top:24px;padding:16px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;font-size:14px;color:#333;">
      <p style="margin:0 0 8px;"><strong>Tu área de cliente RootFlow</strong></p>
      <p style="margin:0 0 12px;">Ahí tienes todas tus facturas (anteriores y nuevas), tus albaranes en PDF, tus pedidos con sus variedades y cantidades, tu histórico y, si lo necesitas, puedes pedir una ampliación de tu pedido fijo.</p>
      <a href="${urlPortal(token)}" style="display:inline-block;background:#F97316;color:#fff;text-decoration:none;font-weight:700;padding:10px 18px;border-radius:8px;">Entrar en mi área de cliente</a>
      <p style="margin:10px 0 0;font-size:12px;color:#888;">Este enlace es personal: no lo compartas fuera de tu equipo.</p>
    </div>
    <p style="font-size:14px;margin-top:20px;">Gracias por confiar en RootFlow 🌱<br>Para cualquier duda, responde a este correo o llámanos al ${esc(EMPRESA.telefono)}.</p>
    <p style="margin-top:24px;font-size:12px;color:#888;">${esc(EMPRESA.nombre)} · CIF ${esc(EMPRESA.cif)} · ${esc(EMPRESA.direccion)}, ${esc(EMPRESA.cp)} ${esc(EMPRESA.ciudad)} · ${esc(EMPRESA.email)}</p>
  </div></body></html>`;
}

// ==================== SOLICITUD DE AMPLIACIÓN ====================
async function crearSolicitud(supabase: any, cliente: any, body: any) {
  const recId = body.pedido_recurrente_id ? Number(body.pedido_recurrente_id) : null;
  let recurrente: any = null;
  let actuales: any[] = [];
  if (recId) {
    const { data } = await supabase.from("pedidos_recurrentes").select("id, nombre, cliente_id").eq("id", recId).maybeSingle();
    if (!data || data.cliente_id !== cliente.id) return json({ error: "Ese pedido recurrente no es tuyo" }, 403);
    recurrente = data;
    const { data: its } = await supabase.from("pedidos_recurrentes_items").select("producto_id, cantidad").eq("pedido_recurrente_id", recId);
    actuales = its || [];
  }

  const { data: productos } = await supabase.from("productos").select("id, nombre, activo");
  const prodById = new Map((productos || []).map((p: any) => [p.id, p]));

  const vistos = new Set<number>();
  const items: any[] = [];
  for (const it of Array.isArray(body.items) ? body.items.slice(0, 100) : []) {
    const pid = Number(it?.producto_id);
    const cant = Math.floor(Number(it?.cantidad_solicitada));
    const prod: any = prodById.get(pid);
    if (!prod || vistos.has(pid) || !Number.isFinite(cant) || cant < 0 || cant > MAX_CANTIDAD) continue;
    vistos.add(pid);
    const actual = Number(actuales.find((a) => a.producto_id === pid)?.cantidad) || 0;
    if (cant === actual) continue; // sin cambio
    items.push({ producto_id: pid, producto_nombre: prod.nombre, cantidad_actual: actual, cantidad_solicitada: cant });
  }

  const mensaje = String(body.mensaje || "").trim().slice(0, 1500);
  if (!items.length && !mensaje) return json({ error: "No has cambiado ninguna cantidad ni escrito ningún mensaje." }, 400);

  const fechaDesde = /^\d{4}-\d{2}-\d{2}$/.test(String(body.fecha_desde || "")) ? body.fecha_desde : null;
  const contacto = String(body.contacto_nombre || "").trim().slice(0, 120) || null;

  const { count } = await supabase.from("solicitudes_cliente").select("id", { count: "exact", head: true }).eq("cliente_id", cliente.id).eq("estado", "pendiente");
  if ((count || 0) >= MAX_SOLICITUDES_PENDIENTES) {
    return json({ error: `Tienes ${count} solicitudes pendientes. Espera a que las revisemos o escríbenos a info@rootflow.es.` }, 429);
  }

  const { data: sol, error } = await supabase.from("solicitudes_cliente").insert({
    cliente_id: cliente.id,
    pedido_recurrente_id: recId,
    tipo: "ampliacion_recurrente",
    items_json: items,
    fecha_desde: fechaDesde,
    mensaje: mensaje || null,
    contacto_nombre: contacto,
    estado: "pendiente",
  }).select("id").single();
  if (error) {
    if (error.code === "42P01") return json({ error: "Las solicitudes todavía no están activadas." }, 503);
    throw error;
  }

  await avisarSlack(supabase, cliente, recurrente, items, mensaje, fechaDesde, contacto);
  return json({ ok: true, id: sol.id });
}

async function cancelarSolicitud(supabase: any, cliente: any, body: any) {
  const id = Number(body.solicitud_id);
  const { data, error } = await supabase.from("solicitudes_cliente")
    .update({ estado: "cancelada", updated_at: new Date().toISOString() })
    .eq("id", id).eq("cliente_id", cliente.id).eq("estado", "pendiente")
    .select("id");
  if (error) throw error;
  if (!data?.length) return json({ error: "Esa solicitud ya no se puede cancelar." }, 400);
  return json({ ok: true });
}

async function avisarSlack(supabase: any, cliente: any, recurrente: any, items: any[], mensaje: string, fechaDesde: string | null, contacto: string | null) {
  try {
    let webhook = env("SLACK_WEBHOOK_URL");
    if (!webhook) {
      const { data } = await supabase.from("notificaciones_config").select("slack_webhook_url").limit(1).maybeSingle();
      webhook = data?.slack_webhook_url || "";
    }
    if (!webhook) return;
    const lineas = items.map((i) => `• ${i.producto_nombre}: ${i.cantidad_actual} → *${i.cantidad_solicitada}*`).join("\n");
    const text = [
      `📩 *Solicitud de ampliación* de *${cliente.nombre}*${recurrente ? ` (recurrente "${recurrente.nombre}")` : " (nuevo pedido recurrente)"}`,
      lineas,
      fechaDesde ? `Desde: ${fechaDesde}` : "",
      contacto ? `Pide: ${contacto}` : "",
      mensaje ? `> ${mensaje.replace(/\n/g, "\n> ")}` : "",
      "Revísala en el ERP → Pedidos → Recurrentes. No se aplica sola.",
    ].filter(Boolean).join("\n");
    await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  } catch (e) {
    console.warn("Slack no enviado", e);
  }
}
