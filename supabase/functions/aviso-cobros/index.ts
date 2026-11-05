// Supabase Edge Function: aviso-cobros (V106)
// Email INTERNO (a Peri) CUANDO VENCE una factura sin cobrar: qué factura ha vencido y, de ese cliente, cuánto
// debe en total y en qué facturas. Se mira cada mañana pero solo se envía si hay alguna factura que acaba de
// vencer y de la que aún no se había avisado (facturas.aviso_interno_at). No escribe al cliente (eso son los
// recordatorios de portal-cliente).
//
// Despliegue:  supabase functions deploy aviso-cobros --no-verify-jwt
// Secrets:     RESEND_API_KEY (ya está), FROM_EMAIL (opcional)
// Destinatario: ajustes_sistema.aviso_cobros_email (varios separados por comas); por defecto p.domecq@rootflow.es
//
// Acciones (POST JSON):
//   { accion: 'cron' }   → pg_cron diario (SQL V106): solo avisa de las vencidas sin avisar.
//   { accion: 'ahora' }  → desde el ERP (usuario @rootflow.es con sesión): resumen de TODO lo vencido, ya.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const env = (k: string) => Deno.env.get(k) || "";
const DESTINO_POR_DEFECTO = "p.domecq@rootflow.es";
const ERP_URL = "https://rootflow-erp.vercel.app";

const eur = (n: any) => {
  const v = Number(n) || 0;
  const [e, d] = Math.abs(v).toFixed(2).split(".");
  return `${v < 0 ? "-" : ""}${e.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${d} €`;
};
const fechaES = (d: any) => { const [y, m, dd] = String(d || "").slice(0, 10).split("-"); return y ? `${dd}/${m}/${y}` : "—"; };
const dias = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86400000);
const esc = (t: any) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[c]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let body: any = {};
  try { body = await req.json(); } catch { /* vacío */ }
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const accion = String(body?.accion || "cron");

  try {
    if (accion === "ahora") {
      const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data } = await supabase.auth.getUser(jwt);
      const email = data?.user?.email?.toLowerCase() || "";
      if (!email.endsWith("@rootflow.es")) return json({ error: "Solo para usuarios del ERP" }, 401);
    }
    const ajustes = async (clave: string) => (await supabase.from("ajustes_sistema").select("valor").eq("clave", clave).maybeSingle()).data?.valor || "";

    const hoy = new Date().toISOString().slice(0, 10);
    const en7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    const { data: facturas, error } = await supabase.from("facturas")
      .select("id, cliente_id, fecha, fecha_vencimiento, total, estado, tipo, enviada_at, recordatorios_enviados, stripe_estado, aviso_interno_at")
      .in("estado", ["pendiente", "vencida"]).order("fecha_vencimiento");
    if (error) throw error;
    const vivas = (facturas || []).filter((f: any) => f.tipo !== "anulada" && f.tipo !== "rectificativa" && !/^R-/.test(f.id) && (Number(f.total) || 0) > 0);
    const vencidas = vivas.filter((f: any) => f.fecha_vencimiento && f.fecha_vencimiento < hoy);
    const proximas = vivas.filter((f: any) => f.fecha_vencimiento && f.fecha_vencimiento >= hoy && f.fecha_vencimiento <= en7);
    // Las que acaban de vencer y aún no se han avisado (en el cron solo se manda si hay alguna)
    const nuevas = vencidas.filter((f: any) => !f.aviso_interno_at);
    if (accion === "cron" && !nuevas.length) return json({ ok: true, omitido: "ninguna factura nueva vencida" });
    const idsNuevas = new Set(nuevas.map((f: any) => f.id));
    // En el aviso automático solo salen los clientes con alguna factura recién vencida (con todo lo que deben)
    const clientesAviso = new Set((accion === "cron" ? nuevas : vencidas).map((f: any) => f.cliente_id));

    const ids = [...new Set(vivas.map((f: any) => f.cliente_id))];
    const { data: clientes } = ids.length ? await supabase.from("clientes").select("id, nombre, contacto, telefono, stripe_activo").in("id", ids) : { data: [] };
    const cli = (id: number) => (clientes || []).find((c: any) => c.id === id);
    const porCliente = (lista: any[]) => {
      const m = new Map<number, any[]>();
      lista.forEach((f) => m.set(f.cliente_id, [...(m.get(f.cliente_id) || []), f]));
      return [...m.entries()].map(([id, fs]) => ({ c: cli(id), fs, total: fs.reduce((t, f) => t + (Number(f.total) || 0), 0) })).sort((a, b) => b.total - a.total);
    };
    const grupos = porCliente(vencidas.filter((f: any) => clientesAviso.has(f.cliente_id)));
    const totalVencido = grupos.reduce((t, g) => t + g.total, 0);
    const nFacturas = grupos.reduce((t, g) => t + g.fs.length, 0);
    let bancoHasta = "";
    try { bancoHasta = JSON.parse(await ajustes("banco_al_dia") || "null")?.hasta || ""; } catch { /* sin dato */ }

    const filas = grupos.map((g) => {
      const masVieja = g.fs[0];
      const nota = g.c?.stripe_activo ? " · domiciliado en Stripe" : "";
      const det = g.fs.map((f: any) => `${idsNuevas.has(f.id) ? "🆕 " : ""}${esc(f.id)} (${eur(f.total)}, venció el ${fechaES(f.fecha_vencimiento)}${f.recordatorios_enviados ? `, ${f.recordatorios_enviados} recordatorio${f.recordatorios_enviados > 1 ? "s" : ""}` : ""}${f.stripe_estado === "failed" ? ", cobro Stripe fallido" : ""})`).join("<br>");
      return `<tr><td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top"><strong>${esc(g.c?.nombre || "Cliente " + masVieja.cliente_id)}</strong>${g.c?.contacto ? `<br><span style="color:#888;font-size:12px">${esc(g.c.contacto)}${g.c?.telefono ? " · " + esc(g.c.telefono) : ""}</span>` : ""}${nota ? `<br><span style="color:#635BFF;font-size:12px">${nota.slice(3)}</span>` : ""}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top;font-size:13px;color:#444">${det}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;vertical-align:top;text-align:right;white-space:nowrap"><strong>${eur(g.total)}</strong><br><span style="color:#DC2626;font-size:12px">hace ${dias(hoy, masVieja.fecha_vencimiento)} días</span></td></tr>`;
    }).join("");
    const prox = porCliente(proximas).map((g) => `<li>${esc(g.c?.nombre || "")}: ${g.fs.map((f: any) => `${esc(f.id)} ${eur(f.total)} (vence ${fechaES(f.fecha_vencimiento)})`).join(", ")}</li>`).join("");
    const unCliente = grupos.length === 1 ? grupos[0] : null;
    const asunto = !grupos.length ? "💶 Cobros: no hay facturas vencidas"
      : accion === "cron" && unCliente
      ? `💶 Ha vencido ${[...idsNuevas].join(", ")}: ${unCliente.c?.nombre || "cliente"} debe ${eur(unCliente.total)} (${unCliente.fs.length} factura${unCliente.fs.length > 1 ? "s" : ""})`
      : `💶 Falta por cobrar ${eur(totalVencido)} de ${grupos.length} cliente${grupos.length > 1 ? "s" : ""} (${nFacturas} factura${nFacturas > 1 ? "s" : ""} vencida${nFacturas > 1 ? "s" : ""})`;
    const html = `<!DOCTYPE html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif"><div style="max-width:680px;margin:0 auto;background:#fff;padding:24px">
      <p style="font-size:20px;font-weight:800;margin:0 0 4px">Root<span style="color:#F97316">Flow</span> · Cobros pendientes</p>
      <p style="color:#666;margin:0 0 16px">${fechaES(hoy)}${bancoHasta ? ` · banco cargado hasta el ${fechaES(bancoHasta)}${dias(hoy, bancoHasta) > 3 ? " ⚠️ (sube el extracto: alguna puede estar ya pagada)" : ""}` : ""}</p>
      ${grupos.length ? `<p style="font-size:15px">${accion === "cron" ? `Ha vencido sin cobrar ${[...idsNuevas].map(esc).join(", ")} (🆕). ` : ""}Falta por cobrar <strong>${eur(totalVencido)}</strong> en <strong>${nFacturas}</strong> factura${nFacturas > 1 ? "s" : ""} vencida${nFacturas > 1 ? "s" : ""}:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px"><tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Cliente</th><th style="padding:8px;text-align:left">Facturas</th><th style="padding:8px;text-align:right">Debe</th></tr>${filas}</table>` : `<p>No hay ninguna factura vencida. 🎉</p>`}
      ${prox ? `<p style="margin-top:20px;font-weight:700">Vencen en los próximos 7 días</p><ul style="font-size:13px;color:#444">${prox}</ul>` : ""}
      <p style="margin-top:20px"><a href="${ERP_URL}" style="background:#047857;color:#fff;text-decoration:none;font-weight:700;padding:10px 16px;border-radius:8px;display:inline-block">Abrir el ERP</a></p>
      <p style="font-size:12px;color:#888;margin-top:16px">A los clientes les salen solos los recordatorios a los 1, 7 y 15 días de vencer (Facturación → 🏦 Banco y cobros). Este email es solo para ti.</p>
    </div></body></html>`;

    const para = (await ajustes("aviso_cobros_email") || DESTINO_POR_DEFECTO).split(/[,;\s]+/).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
    const key = env("RESEND_API_KEY");
    if (!key) return json({ error: "Falta el secret RESEND_API_KEY" }, 500);
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env("FROM_EMAIL") || "RootFlow Hydroponics <info@rootflow.es>", to: para, subject: asunto, html }),
    });
    const res: any = await r.json().catch(() => ({}));
    await supabase.from("email_log").insert({ destinatarios: para.join(", "), asunto, alerta_id: "aviso_cobros", estado: r.ok ? "enviado" : "error", respuesta: r.ok ? JSON.stringify({ id: res?.id }) : JSON.stringify(res) });
    if (!r.ok) return json({ error: `Resend ${r.status}: ${res?.message || "error"}` }, 500);
    // Marca como avisadas las recién vencidas (no se vuelve a avisar de ellas)
    if (idsNuevas.size) await supabase.from("facturas").update({ aviso_interno_at: new Date().toISOString() }).in("id", [...idsNuevas]);
    return json({ ok: true, para, avisadas: [...idsNuevas], clientes: grupos.length, total: totalVencido });
  } catch (e) {
    console.error("aviso-cobros", e);
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});
