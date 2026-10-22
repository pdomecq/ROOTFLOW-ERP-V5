// =====================================================
// ROOTFLOW — Edge Function "siembra-diaria"
// =====================================================
// Envía cada día a las 9:00 (hora Madrid) la notificación a
// Guzmán (Slack + email) con los gramos a sembrar por variedad,
// calculados desde los pedidos abiertos.
//
// DESPLIEGUE (desde la carpeta del proyecto, con Supabase CLI):
//   1. Guarda este archivo en: supabase/functions/siembra-diaria/index.ts
//   2. supabase functions deploy siembra-diaria --no-verify-jwt
//   3. Secrets necesarios: RESEND_API_KEY (email) y SLACK_WEBHOOK_URL (Slack, el mismo
//      que ya usa send-slack). Si falta alguno: supabase secrets set RESEND_API_KEY=re_xxx
//
// PRUEBA MANUAL (sin esperar a las 9:00):
//   curl "https://deebnsbrvtmstakchxan.supabase.co/functions/v1/siembra-diaria?force=1"
// =====================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const ESTADOS_ACTIVOS = ["pendiente", "confirmado", "preparando"];
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Rootflow ERP <info@rootflow.es>";

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "1";

    // Hora local Madrid (gestiona DST automáticamente)
    const ahora = new Date();
    const horaMadrid = parseInt(
      new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", hour12: false }).format(ahora)
    );
    const hoyMadrid = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(ahora); // YYYY-MM-DD

    if (!force && horaMadrid !== 9) {
      return json({ skip: `Hora Madrid ${horaMadrid}h ≠ 9h` });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Config
    const { data: cfgRows } = await supabase.from("notificaciones_config").select("*").limit(1);
    const cfg = cfgRows?.[0] || {};
    if (!force && cfg.notif_siembra_pedidos === false) {
      return json({ skip: "notif_siembra_pedidos desactivado" });
    }
    const emailDestino = cfg.email_siembra || "g.greus@rootflow.es";

    // Dedup: 1 envío/día (compartido con la app)
    if (!force) {
      const { error: dupErr } = await supabase
        .from("siembra_notif_log")
        .insert({ fecha: hoyMadrid, origen: "cron" });
      if (dupErr) return json({ skip: "Ya enviado hoy", detail: dupErr.code });
    }

    // Datos
    const [{ data: pedidos }, { data: items }, { data: productos }, { data: variedades }] = await Promise.all([
      supabase.from("pedidos").select("id, cliente_id, fecha_entrega, estado").in("estado", ESTADOS_ACTIVOS).not("fecha_entrega", "is", null),
      supabase.from("pedido_items").select("pedido_id, producto_id, cantidad"),
      supabase.from("productos").select("id, nombre, variedad_id, formato_gramos"),
      supabase.from("variedades").select("id, nombre, dias_germinacion, dias_luz, gramos_produccion_por_tray"),
    ]);
    const { data: clientes } = await supabase.from("clientes").select("id, nombre");

    // Cálculo: fecha_siembra = fecha_entrega − (germinación + luz) == HOY
    const porVariedad = new Map<number, { nombre: string; gramos: number; gPorTray: number; detalles: string[] }>();

    for (const p of pedidos || []) {
      const itemsPedido = (items || []).filter((i) => i.pedido_id === p.id);
      for (const it of itemsPedido) {
        const prod = (productos || []).find((x) => x.id === it.producto_id);
        if (!prod?.variedad_id) continue;
        const v = (variedades || []).find((x) => x.id === prod.variedad_id);
        if (!v) continue;
        const ciclo = (v.dias_germinacion || 0) + (v.dias_luz || 0);
        if (ciclo <= 0) continue;

        const fechaSiembra = new Date(p.fecha_entrega + "T00:00:00");
        fechaSiembra.setDate(fechaSiembra.getDate() - ciclo);
        const fechaSiembraStr = fechaSiembra.toISOString().slice(0, 10);
        if (fechaSiembraStr !== hoyMadrid) continue;

        const gramos = (parseFloat(it.cantidad) || 0) * (parseFloat(prod.formato_gramos) || 0);
        if (gramos <= 0) continue;

        const cli = (clientes || []).find((c) => c.id === p.cliente_id);
        if (!porVariedad.has(v.id)) {
          porVariedad.set(v.id, { nombre: v.nombre, gramos: 0, gPorTray: parseFloat(v.gramos_produccion_por_tray) || 0, detalles: [] });
        }
        const entry = porVariedad.get(v.id)!;
        entry.gramos += gramos;
        entry.detalles.push(`${Math.round(gramos)}g → ${cli?.nombre || "Cliente"} (entrega ${fmtFecha(p.fecha_entrega)})`);
      }
    }

    const lista = [...porVariedad.values()].sort((a, b) => b.gramos - a.gramos);
    const totalGramos = lista.reduce((s, x) => s + x.gramos, 0);
    const fechaBonita = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long" }).format(ahora);

    // ---- Mensaje Slack ----
    let slackTxt: string;
    if (lista.length === 0) {
      slackTxt = `🌱 *Siembra de hoy — ${fechaBonita}*\n\nHoy no hay siembras programadas según los pedidos abiertos. ✅`;
    } else {
      slackTxt = `🌱 *Siembra de hoy — ${fechaBonita}*\n_Calculado desde los pedidos abiertos (entrega − ciclo de cultivo)_\n`;
      for (const v of lista) {
        const bandejas = v.gPorTray > 0 ? ` · ${Math.ceil(v.gramos / v.gPorTray)} bandeja(s)` : "";
        slackTxt += `\n*${v.nombre}: ${Math.round(v.gramos)} g*${bandejas}\n`;
        for (const d of v.detalles) slackTxt += `   • ${d}\n`;
      }
      slackTxt += `\n*TOTAL: ${Math.round(totalGramos)} g* en ${lista.length} variedad(es)`;
    }

    const resultados: Record<string, unknown> = {};

    // Slack: webhook de notificaciones_config o, si no hay, el secret SLACK_WEBHOOK_URL
    // (el mismo que usa la función send-slack)
    const slackWebhook = cfg.slack_webhook_url || Deno.env.get("SLACK_WEBHOOK_URL");
    if (cfg.slack_activo !== false && slackWebhook) {
      const r = await fetch(slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: slackTxt }),
      });
      resultados.slack = r.ok ? "ok" : `error ${r.status}`;
    } else {
      resultados.slack = "sin webhook configurado";
    }

    // ---- Email (Resend) ----
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey && emailDestino) {
      const filas = lista.map((v) => {
        const bandejas = v.gPorTray > 0 ? Math.ceil(v.gramos / v.gPorTray) : "—";
        const det = v.detalles.map((d) => `<div style="color:#666;font-size:12px">• ${d}</div>`).join("");
        return `<tr>
          <td style="padding:10px;border-bottom:1px solid #eee"><strong>${v.nombre}</strong>${det}</td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right;font-size:18px"><strong>${Math.round(v.gramos)} g</strong></td>
          <td style="padding:10px;border-bottom:1px solid #eee;text-align:right">${bandejas}</td>
        </tr>`;
      }).join("");

      const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FCF2EB;padding:20px;margin:0">
<div style="max-width:560px;margin:0 auto;background:white;border-radius:12px;overflow:hidden">
  <div style="background:#1D4F37;color:white;padding:20px 24px">
    <h1 style="margin:0;font-size:20px">🌱 Siembra de hoy</h1>
    <p style="margin:4px 0 0;opacity:.85;font-size:13px;text-transform:capitalize">${fechaBonita}</p>
  </div>
  <div style="padding:24px">
    ${lista.length === 0
      ? `<p style="font-size:15px">Hoy no hay siembras programadas según los pedidos abiertos. ✅</p>`
      : `<p style="font-size:13px;color:#666;margin-top:0">Calculado desde los pedidos abiertos: fecha de entrega menos ciclo de cultivo (germinación + luz) de cada variedad.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr style="background:#f7f7f7">
        <th style="padding:8px 10px;text-align:left">Variedad</th>
        <th style="padding:8px 10px;text-align:right">Gramos</th>
        <th style="padding:8px 10px;text-align:right">Bandejas</th>
      </tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr>
        <td style="padding:12px 10px"><strong>TOTAL</strong></td>
        <td style="padding:12px 10px;text-align:right;font-size:18px;color:#1D4F37"><strong>${Math.round(totalGramos)} g</strong></td>
        <td></td>
      </tr></tfoot>
    </table>`}
  </div>
  <div style="padding:14px 24px;background:#f7f7f7;font-size:11px;color:#999">Rootflow ERP · Notificación automática diaria (9:00)</div>
</div></body></html>`;

      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [emailDestino],
          subject: `🌱 Siembra de hoy — ${lista.length === 0 ? "sin siembras" : Math.round(totalGramos) + " g en " + lista.length + " variedad(es)"}`,
          html,
        }),
      });
      resultados.email = r.ok ? `ok → ${emailDestino}` : `error ${r.status}: ${await r.text()}`;
    } else {
      resultados.email = resendKey ? "sin destinatario" : "falta secret RESEND_API_KEY";
    }

    return json({ ok: true, fecha: hoyMadrid, variedades: lista.length, totalGramos: Math.round(totalGramos), resultados });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function fmtFecha(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
