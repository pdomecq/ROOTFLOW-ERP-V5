// Supabase Edge Function: portal-cliente (V82)
// Backend del área de cliente (src/AreaCliente.jsx). El cliente entra con el enlace
// https://…/area-cliente?t=<clientes.portal_token> y esta función, con la service role,
// le devuelve SOLO sus datos. El navegador del cliente nunca lee las tablas directamente.
//
// Despliegue:  supabase functions deploy portal-cliente --no-verify-jwt
// Secrets:     SLACK_WEBHOOK_URL (opcional; si no está, usa notificaciones_config.slack_webhook_url)
//              SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
//
// Acciones (POST JSON):
//   { token, accion: 'datos' }                         → cliente, facturas con líneas, pedidos, recurrentes, solicitudes, catálogo
//   { token, accion: 'solicitar', pedido_recurrente_id, items: [{ producto_id, cantidad_solicitada }], fecha_desde, mensaje, contacto_nombre }
//   { token, accion: 'cancelar_solicitud', solicitud_id }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const MAX_SOLICITUDES_PENDIENTES = 5;
const MAX_CANTIDAD = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Petición no válida" }, 400);
  }

  const token = String(body?.token || "").trim();
  if (token.length < 20 || token.length > 100 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return json({ error: "Enlace no válido" }, 401);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // ---------- Cliente por token ----------
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

  const accion = body?.accion || "datos";

  try {
    if (accion === "datos") return json(await cargarDatos(supabase, cliente));
    if (accion === "solicitar") return await crearSolicitud(supabase, cliente, body);
    if (accion === "cancelar_solicitud") return await cancelarSolicitud(supabase, cliente, body);
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    console.error("portal-cliente", accion, e);
    return json({ error: "Error inesperado. Inténtalo de nuevo o escríbenos a info@rootflow.es." }, 500);
  }
});

// ==================== DATOS ====================
async function cargarDatos(supabase: any, cliente: any) {
  const cid = cliente.id;

  const [productosR, variedadesR, facturasR, pedidosR, albaranesR, recurrentesR, solicitudesR] = await Promise.all([
    supabase.from("productos").select("id, nombre, categoria, unidad, formato_gramos, variedad_id, activo").order("nombre"),
    supabase.from("variedades").select("id, nombre"),
    supabase.from("facturas").select("*").eq("cliente_id", cid).order("fecha", { ascending: false }),
    supabase.from("pedidos").select("id, fecha, fecha_entrega, estado, total, concepto, horario_entrega").eq("cliente_id", cid).order("fecha", { ascending: false }).limit(500),
    supabase.from("albaranes").select("id, fecha_emision, fecha_entrega_real, estado, valorado, items_json, coste_envio, numero_factura, total").eq("cliente_id", cid).order("fecha_emision", { ascending: false }).limit(500),
    supabase.from("pedidos_recurrentes").select("id, nombre, frecuencia, dia_semana, activo, proxima_ejecucion, notas").eq("cliente_id", cid),
    supabase.from("solicitudes_cliente").select("id, pedido_recurrente_id, items_json, fecha_desde, mensaje, estado, respuesta, respondida_at, created_at").eq("cliente_id", cid).order("created_at", { ascending: false }),
  ]);

  const productos = productosR.data || [];
  const variedades = variedadesR.data || [];
  const prodById = new Map(productos.map((p: any) => [p.id, p]));
  const varById = new Map(variedades.map((v: any) => [v.id, v.nombre]));
  const describir = (productoId: any, nombreGuardado?: string) => {
    const p: any = prodById.get(Number(productoId));
    return {
      producto_id: Number(productoId) || null,
      producto: nombreGuardado || p?.nombre || "Producto",
      variedad: p?.variedad_id ? varById.get(p.variedad_id) || null : null,
      formato_gramos: p?.formato_gramos || null,
      unidad: p?.unidad || "ud",
    };
  };

  // Líneas de pedidos
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

  // Albaranes
  const albaranes = (albaranesR.data || []).map((a: any) => ({
    id: a.id,
    fecha: a.fecha_entrega_real || a.fecha_emision,
    estado: a.estado,
    numero_factura: a.numero_factura,
    coste_envio: Number(a.coste_envio) || 0,
    lineas: (Array.isArray(a.items_json) ? a.items_json : []).map((it: any) => {
      const cantidad = Number(it.cantidad) || 0;
      const precio = Number(it.precio_unitario) || 0;
      return { ...describir(it.producto_id, it.producto_nombre), cantidad, precio_unitario: precio, subtotal: Number(it.subtotal) || +(cantidad * precio).toFixed(2) };
    }),
  }));
  const albById = new Map(albaranes.map((a: any) => [String(a.id), a]));

  // Facturas: importes tal como se emitieron + líneas (de los albaranes si es agrupada, del pedido si no)
  const facturas = (facturasR.data || [])
    .filter((f: any) => f.estado !== "cancelada")
    .map((f: any) => {
      const albIds: string[] = Array.isArray(f.albaranes_ids) ? f.albaranes_ids.map(String) : [];
      const grupos = albIds.length
        ? albIds.map((id) => albById.get(id)).filter(Boolean).map((a: any) => ({ titulo: `Albarán ${a.id}`, fecha: a.fecha, lineas: a.lineas }))
        : f.pedido_id ? [{ titulo: `Pedido #${f.pedido_id}`, fecha: pedidos.find((p: any) => p.id === f.pedido_id)?.fecha_entrega || null, lineas: lineasPedido(f.pedido_id) }] : [];
      return {
        id: f.id,
        fecha: f.fecha,
        fecha_vencimiento: f.fecha_vencimiento,
        estado: f.estado,
        concepto: f.concepto,
        tipo: f.tipo,
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
        grupos,
      };
    });

  // Pedidos recurrentes con sus productos
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
    let webhook = Deno.env.get("SLACK_WEBHOOK_URL") || "";
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
