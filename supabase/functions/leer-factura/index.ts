// Supabase Edge Function: leer-factura (V85)
// Bandeja de facturas de proveedor (tabla facturas_recibidas). Para cada factura nueva:
//   1. si llegó en base64 (revisión del correo), sube el archivo al bucket facturas-gastos
//   2. extrae los datos con Claude (proveedor, CIF, nº, fecha, base, IVA, retención IRPF, total, categoría)
//   3. busca el proveedor en la tabla proveedores y avisa si parece duplicada
//   4. la deja en estado 'pendiente' para que alguien la revise y la registre como gasto en el ERP
// El gasto (y su asiento) lo crea siempre el ERP al pulsar "Registrar": aquí no se toca la contabilidad.
//
// Despliegue:  supabase functions deploy leer-factura --no-verify-jwt
// Secrets:     ANTHROPIC_API_KEY (obligatorio para leer las facturas con IA)
//
// Acciones (POST JSON):
//   { accion: 'procesar', id }            → procesa una factura (usuario del ERP)
//   { accion: 'procesar_pendientes' }     → procesa las que estén en estado 'nueva' (sin login: solo
//                                           trabaja con filas que ya están en la tabla, que solo pueden
//                                           crear usuarios del ERP o la revisión del correo)
//   { accion: 'importar', token, email_message_id, email_de, email_asunto, email_fecha,
//     archivo_nombre, archivo_mime, archivo_base64 }
//                                         → la usa la revisión diaria del correo: mete una factura en la
//                                           bandeja y la lee. Sin archivo_base64 deja un aviso para subirla
//                                           a mano. El token está en la tabla config_privada (clave
//                                           'token_importar_facturas'), que solo puede leer el servidor.

import { createClient } from "npm:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BUCKET = "facturas-gastos";
const DOMINIO_ERP = "@rootflow.es";
const MAX_POR_RONDA = 10;
const MODELO = "claude-opus-5-5";
const MIME_PDF = "application/pdf";
const MIMES_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Claves de categoriasGasto del ERP (src/App.jsx). Si añades una categoría allí, añádela aquí.
const CATEGORIAS = [
  "semillas", "sustratos", "embalajes", "alquiler", "reparaciones", "asesoria", "transporte", "seguros", "banco",
  "publicidad", "energia", "servicios", "tributos", "nominas", "seguridad_social", "software", "formacion", "otros",
  "capex_equipos", "capex_mobiliario", "capex_maquinaria", "capex_instalaciones", "capex_vehiculos", "capex_otros",
];

const num = { anyOf: [{ type: "number" }, { type: "null" }] };
const txt = { anyOf: [{ type: "string" }, { type: "null" }] };
const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["es_factura", "proveedor_nombre", "proveedor_cif", "numero_factura", "fecha", "concepto", "base_imponible",
    "iva_importe", "iva_tipo", "retencion_pct", "retencion_importe", "total_a_pagar", "moneda", "categoria", "notas"],
  properties: {
    es_factura: { type: "boolean" },
    proveedor_nombre: txt,
    proveedor_cif: txt,
    numero_factura: txt,
    fecha: txt,
    concepto: txt,
    base_imponible: num,
    iva_importe: num,
    iva_tipo: { type: "string", enum: ["general", "reducido", "superreducido", "exento", "mixto"] },
    retencion_pct: num,
    retencion_importe: num,
    total_a_pagar: num,
    moneda: txt,
    categoria: { type: "string", enum: CATEGORIAS },
    notas: txt,
  },
};

const INSTRUCCIONES = `Eres el contable de ROOTFLOW HYDROPONICS SL (CIF B27535137), una empresa de microbrotes hidropónicos de Madrid. Te paso una factura o recibo de un proveedor que ha recibido la empresa. Extrae los datos tal como aparecen en el documento:

- proveedor_nombre y proveedor_cif: los del emisor, nunca los de Rootflow (B27535137).
- fecha: la fecha de la factura en formato AAAA-MM-DD.
- concepto: una descripción corta en español de qué se compra (p. ej. "Alquiler local noviembre 2026", "Suscripción Claude Pro octubre 2026").
- base_imponible: la suma de todas las bases (también las que no llevan IVA, como suplidos de luz o agua).
- iva_importe: la cuota total de IVA. iva_tipo: general (21 %), reducido (10 %), superreducido (4 %), exento (sin IVA o inversión del sujeto pasivo) o mixto (varios tipos).
- retencion_pct y retencion_importe: la retención de IRPF si la hay (habitual en alquileres, 19 %, y profesionales, 15 % o 7 %); 0 si no hay.
- total_a_pagar: el total del documento (base + IVA − retención).
- categoria: la que mejor encaje de la lista. alquiler = arrendamiento del local; energia = luz, agua o gas; software = suscripciones y programas; asesoria = gestoría, abogados, notarios; capex_* solo para equipos o instalaciones que duren más de un año.
- es_factura: false si no es una factura ni un recibo de compra (por ejemplo, un presupuesto, un aviso o un documento que no es de un proveedor).
- moneda: código ISO (EUR, USD…).
- notas: cualquier cosa rara (moneda extranjera, IVA de otro país, importes que no cuadran, si es un recibo sin datos fiscales). null si no hay nada.
Si un dato no aparece, usa null. No inventes importes.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Petición no válida" }, 400); }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    if (body?.accion === "procesar_pendientes") {
      const { data, error } = await supabase.from("facturas_recibidas").select("id").eq("estado", "nueva").order("id").limit(MAX_POR_RONDA);
      if (error) return json({ error: error.code === "42P01" ? "Falta ejecutar el SQL V85" : error.message }, 500);
      const resultados = [];
      for (const f of data || []) resultados.push(await procesar(supabase, f.id));
      return json({ ok: true, procesadas: resultados.length, resultados });
    }
    if (body?.accion === "importar") return json(await importar(supabase, body));
    if (body?.accion === "procesar") {
      if (!(await usuarioERP(req, supabase))) return json({ error: "Solo para usuarios del ERP" }, 401);
      return json(await procesar(supabase, Number(body.id)));
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    console.error("leer-factura", e);
    return json({ error: "Error inesperado: " + ((e as any)?.message || e) }, 500);
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

const MAX_BASE64 = 20 * 1024 * 1024; // ~15 MB de archivo

async function importar(supabase: any, b: any) {
  const { data: cfg, error: eCfg } = await supabase.from("config_privada").select("valor").eq("clave", "token_importar_facturas").maybeSingle();
  if (eCfg || !cfg?.valor || String(b?.token || "") !== cfg.valor) return { ok: false, error: "Token no válido" };
  const msgId = String(b.email_message_id || "").slice(0, 200) || null;
  const nombre = String(b.archivo_nombre || "factura.pdf").slice(0, 200);
  const base64 = b.archivo_base64 ? String(b.archivo_base64) : null;
  if (base64 && base64.length > MAX_BASE64) return { ok: false, error: "Archivo demasiado grande" };
  if (msgId) {
    const { data: ya } = await supabase.from("facturas_recibidas").select("id, estado").eq("email_message_id", msgId).eq("archivo_nombre", nombre).limit(1);
    if (ya?.length) return { ok: true, ya_importada: true, id: ya[0].id, estado: ya[0].estado };
  }
  const fila: any = {
    origen: "gmail",
    email_message_id: msgId,
    email_de: String(b.email_de || "").slice(0, 200) || null,
    email_asunto: String(b.email_asunto || "").slice(0, 300) || null,
    email_fecha: b.email_fecha || null,
    archivo_nombre: nombre,
    archivo_mime: b.archivo_mime || mimeDeNombre(nombre) || null,
    archivo_base64: base64,
    estado: base64 ? "nueva" : "pendiente",
    error: base64 ? null : "No se pudo traer el PDF del correo: ábrelo en Gmail y súbelo con \"Subir facturas\" (después descarta esta).",
    subido_por: "revisión diaria del correo",
  };
  const { data: nueva, error } = await supabase.from("facturas_recibidas").insert(fila).select("id").single();
  if (error) return { ok: false, error: error.message };
  if (!base64) return { ok: true, id: nueva.id, estado: "pendiente" };
  return await procesar(supabase, nueva.id);
}

async function guardar(supabase: any, id: number, cambios: any) {
  const { error } = await supabase.from("facturas_recibidas").update({ ...cambios, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

async function procesar(supabase: any, id: number) {
  const { data: f, error } = await supabase.from("facturas_recibidas").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!f) return { id, ok: false, error: "No existe" };
  try {
    // 1. Archivo: del base64 al bucket, o descargarlo para leerlo
    let bytes: Uint8Array | null = null;
    let mime = f.archivo_mime || mimeDeNombre(f.archivo_nombre);
    if (f.archivo_base64 && !f.archivo_url) {
      bytes = base64ABytes(f.archivo_base64);
      const ruta = `recibidas/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension(f.archivo_nombre, mime)}`;
      const { error: eUp } = await supabase.storage.from(BUCKET).upload(ruta, bytes, { contentType: mime, upsert: false });
      if (eUp) throw new Error("No se pudo guardar el archivo: " + eUp.message);
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
      await guardar(supabase, id, { archivo_url: pub.publicUrl, archivo_base64: null, archivo_mime: mime, archivo_sha256: await sha256(bytes) });
      f.archivo_url = pub.publicUrl;
    } else if (f.archivo_url) {
      const r = await fetch(f.archivo_url);
      if (!r.ok) throw new Error(`No se pudo descargar el archivo (${r.status})`);
      bytes = new Uint8Array(await r.arrayBuffer());
      mime = mime || r.headers.get("content-type") || "";
      if (!f.archivo_sha256) await guardar(supabase, id, { archivo_sha256: await sha256(bytes), archivo_mime: mime });
    } else {
      throw new Error("La factura no tiene archivo");
    }

    // 2. Duplicada: mismo archivo ya en la bandeja
    const hash = await sha256(bytes!);
    const { data: iguales } = await supabase.from("facturas_recibidas").select("id, estado, gasto_id").eq("archivo_sha256", hash).neq("id", id).neq("estado", "descartada").limit(1);
    if (iguales?.length) {
      await guardar(supabase, id, { estado: "duplicada", error: `Mismo archivo que la factura recibida #${iguales[0].id}` });
      return { id, ok: true, estado: "duplicada" };
    }

    // 3. Datos con IA (si no los trae ya)
    let datos = f.datos_json;
    if (!datos || !Object.keys(datos).length) {
      if (!Deno.env.get("ANTHROPIC_API_KEY")) {
        await guardar(supabase, id, { estado: "pendiente", error: "Sin lectura automática: falta el secret ANTHROPIC_API_KEY. Rellena los datos a mano." });
        return { id, ok: true, estado: "pendiente", sin_ia: true };
      }
      if (mime !== MIME_PDF && !MIMES_IMAGEN.includes(mime)) throw new Error(`Formato no soportado (${mime || "desconocido"}): sube un PDF o una foto JPG/PNG`);
      datos = await extraerConClaude(bytes!, mime);
    }

    // 4. Proveedor conocido y factura ya registrada
    const { data: provs } = await supabase.from("proveedores").select("*"); // sin columna cif: se busca también en las notas
    const prov = buscarProveedor(provs || [], datos);
    if (prov) datos = { ...datos, proveedor_id: prov.id, proveedor_erp: prov.nombre };
    let estado = "pendiente";
    let aviso: string | null = datos?.es_factura === false ? "No parece una factura: revisa antes de registrarla." : null;
    if (prov && datos?.numero_factura) {
      const { data: ya } = await supabase.from("gastos").select("id").eq("proveedor_id", prov.id).eq("numero_factura", datos.numero_factura).limit(1);
      if (ya?.length) { estado = "duplicada"; aviso = `Ya está registrada como gasto #${ya[0].id}`; }
    }
    await guardar(supabase, id, { datos_json: datos, estado, error: aviso });
    return { id, ok: true, estado };
  } catch (e) {
    const msg = String((e as any)?.message || e).slice(0, 500);
    await guardar(supabase, id, { estado: "error", error: msg });
    return { id, ok: false, error: msg };
  }
}

async function extraerConClaude(bytes: Uint8Array, mime: string) {
  const client = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  const data = bytesABase64(bytes);
  const adjunto = mime === MIME_PDF
    ? { type: "document", source: { type: "base64", media_type: MIME_PDF, data } }
    : { type: "image", source: { type: "base64", media_type: mime, data } };
  const response: any = await client.beta.messages.create({
    model: MODELO,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA } },
    messages: [{ role: "user", content: [adjunto, { type: "text", text: INSTRUCCIONES }] }],
  } as any);
  if (response.stop_reason === "refusal") throw new Error("La IA no ha podido leer este documento");
  if (response.stop_reason === "max_tokens") throw new Error("La respuesta de la IA se cortó");
  const texto = (response.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error("La IA no devolvió datos válidos");
  }
}

export function buscarProveedor(provs: any[], datos: any) {
  const limpiar = (t: any) => String(t || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cif = limpiar(datos?.proveedor_cif);
  if (cif) {
    const p = provs.find((x) => limpiar(x.cif) === cif || limpiar(x.notas).includes(cif));
    if (p) return p;
  }
  const nombre = limpiar(datos?.proveedor_nombre).replace(/(SL|SLU|SA|SLL|LIMITED|LTD|INC|SAS|BV)$/g, "");
  if (nombre.length < 4) return null;
  return provs.find((x) => {
    const n = limpiar(x.nombre).replace(/(SL|SLU|SA|SLL|LIMITED|LTD|INC|SAS|BV)$/g, "");
    return n.length >= 4 && (n.includes(nombre) || nombre.includes(n));
  }) || null;
}

const mimeDeNombre = (n: any) => {
  const e = String(n || "").toLowerCase().split(".").pop();
  return e === "pdf" ? MIME_PDF : e === "png" ? "image/png" : e === "webp" ? "image/webp" : e === "gif" ? "image/gif" : ["jpg", "jpeg"].includes(e || "") ? "image/jpeg" : "";
};
const extension = (n: any, mime: string) => String(n || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || (mime === MIME_PDF ? "pdf" : "jpg");

export function base64ABytes(b64: string) {
  const limpio = String(b64).replace(/^data:[^,]+,/, "").replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "");
  const bin = atob(limpio + "=".repeat((4 - (limpio.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
export function bytesABase64(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
async function sha256(bytes: Uint8Array) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(h).map((b) => b.toString(16).padStart(2, "0")).join("");
}
