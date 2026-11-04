// V97: COPIA de src/controlFacturas.js (Supabase despliega solo esta carpeta). Si cambias una, cambia la otra.
// V97: control de facturas emitidas contra lo que de verdad se entregó (cálculo puro, sin React ni Supabase).
// Una factura tiene que cuadrar con sus albaranes (agrupada) o con el albarán de su pedido (por pedido); si el
// pedido aún no tiene albarán, con las líneas del pedido. Se compara la BASE imponible (el total puede bailar
// un céntimo por redondear el IVA albarán a albarán).
// La usan: sincronizarFacturaDePedido() (al editar pedido/albarán y al entregar), el panel "🧾 Control de
// facturas" de Facturación y, con una copia reducida, portal-cliente antes de enviar cada factura.

const r2 = (x) => Math.round((parseFloat(x) || 0) * 100) / 100;
export const PERIODICIDADES_AGRUPADAS = ['semanal', 'quincenal', 'mensual'];
const esDeVenta = (f) => f && !['anulada', 'rectificativa', 'cancelada'].includes(f.estado) && f.tipo !== 'anulada' && f.tipo !== 'rectificativa' && !/^R-/.test(String(f.id));
const idsAlbaranes = (f) => (Array.isArray(f.albaranes_ids) ? f.albaranes_ids.map(String) : []);

/**
 * Importes que debería tener la factura.
 * ctx: { albaranes, albaranPedidos, pedidoItems, pedidos, cliente, descuentoPct(cliente, fechaIso), ivaPct, rePct }
 * Devuelve { fuente: 'albaranes' | 'albaran' | 'pedido', albaranId?, subtotal, descuento_aplicado, portes_importe,
 *   base_imponible, iva, re_importe, total } o null si no hay con qué comparar.
 */
export function importeEsperado(f, ctx) {
  const { albaranes = [], albaranPedidos = [], pedidoItems = [], pedidos = [], cliente, descuentoPct = () => 0, ivaPct = 4, rePct = 0.5 } = ctx;
  const ids = idsAlbaranes(f);
  if (ids.length) {
    const als = ids.map((id) => albaranes.find((a) => String(a.id) === id)).filter(Boolean);
    if (als.length !== ids.length) return null;
    const suma = (k) => r2(als.reduce((t, a) => t + r2(a[k]), 0));
    return { fuente: 'albaranes', subtotal: suma('subtotal'), descuento_aplicado: suma('descuento_aplicado'), portes_importe: suma('coste_envio'), base_imponible: suma('base_imponible'), iva: suma('iva'), re_importe: suma('re_importe'), total: suma('total') };
  }
  if (!f.pedido_id) return null;
  // Albaranes que son solo de este pedido
  const albIds = [...new Set(albaranPedidos.filter((x) => x.pedido_id === f.pedido_id).map((x) => x.albaran_id))]
    .filter((id) => albaranPedidos.filter((x) => x.albaran_id === id).length === 1);
  if (albIds.length === 1) {
    const a = albaranes.find((x) => String(x.id) === String(albIds[0]));
    if (a && a.valorado !== false && r2(a.total) > 0) {
      return { fuente: 'albaran', albaranId: a.id, subtotal: r2(a.subtotal) || r2(r2(a.base_imponible) - r2(a.coste_envio) + r2(a.descuento_aplicado)), descuento_aplicado: r2(a.descuento_aplicado), portes_importe: r2(a.coste_envio), base_imponible: r2(a.base_imponible), iva: r2(a.iva), re_importe: r2(a.re_importe), total: r2(a.total) };
    }
  }
  if (albIds.length > 1) return null; // varios albaranes del mismo pedido: no se adivina
  const its = pedidoItems.filter((i) => i.pedido_id === f.pedido_id);
  if (!its.length) return null;
  const ped = pedidos.find((p) => p.id === f.pedido_id);
  const subtotal = r2(its.reduce((t, i) => t + (parseFloat(i.subtotal) || 0), 0));
  const desc = r2(subtotal * ((descuentoPct(cliente, ped?.fecha_entrega || ped?.fecha) || 0) / 100));
  const base = r2(subtotal - desc);
  const iva = r2(base * ivaPct / 100);
  const re = cliente?.recargo_equivalencia ? r2(base * rePct / 100) : 0;
  return { fuente: 'pedido', subtotal, descuento_aplicado: desc, portes_importe: 0, base_imponible: base, iva, re_importe: re, total: r2(base + iva + re) };
}

export const cuadra = (f, esperado) => !esperado || Math.abs(r2(f.base_imponible ?? f.subtotal) - esperado.base_imponible) < 0.011;

/**
 * Revisión completa: facturas que no cuadran, pedidos facturados dos veces (factura del pedido + su albarán en una
 * agrupada) y pedidos entregados de clientes "por pedido" sin factura.
 * ctx como importeEsperado + { facturas, clientes, desde } (desde: no mirar pedidos más antiguos, AAAA-MM-DD).
 */
export function revisarFacturas(ctx) {
  const { facturas = [], clientes = [], pedidos = [], albaranPedidos = [], desde = '0000-00-00' } = ctx;
  const cli = (id) => clientes.find((c) => c.id === id);
  const descuadres = [];
  for (const f of facturas) {
    if (!esDeVenta(f) || !['pendiente', 'vencida'].includes(f.estado)) continue;
    const esperado = importeEsperado(f, { ...ctx, cliente: cli(f.cliente_id) });
    if (!cuadra(f, esperado)) descuadres.push({ factura: f, esperado, diferencia: r2(esperado.total - r2(f.total)), enviada: !!f.enviada_at });
  }
  // Facturado dos veces: factura del pedido + su albarán dentro de una factura agrupada
  const agrupadasPorAlbaran = {};
  facturas.filter((f) => esDeVenta(f) && idsAlbaranes(f).length).forEach((f) => idsAlbaranes(f).forEach((id) => { agrupadasPorAlbaran[id] = f; }));
  const duplicadas = [];
  for (const f of facturas) {
    if (!esDeVenta(f) || !f.pedido_id || idsAlbaranes(f).length) continue;
    const albs = albaranPedidos.filter((x) => x.pedido_id === f.pedido_id).map((x) => String(x.albaran_id));
    const ag = albs.map((id) => agrupadasPorAlbaran[id]).find(Boolean);
    if (ag) duplicadas.push({ factura: f, agrupada: ag, albaranId: albs.find((id) => agrupadasPorAlbaran[id]) });
  }
  // Pedidos entregados sin factura (clientes que facturan por pedido)
  const facturados = new Set(facturas.filter((f) => f.estado !== 'anulada' && f.tipo !== 'anulada' && f.pedido_id).map((f) => f.pedido_id));
  const albEnAgrupada = new Set(facturas.filter((f) => f.estado !== 'anulada').flatMap(idsAlbaranes));
  const pedidosEnAgrupada = new Set(albaranPedidos.filter((x) => albEnAgrupada.has(String(x.albaran_id))).map((x) => x.pedido_id));
  const sinFactura = pedidos.filter((p) => p.estado === 'entregado' && String(p.fecha_entrega || p.fecha) >= desde
    && !PERIODICIDADES_AGRUPADAS.includes(cli(p.cliente_id)?.periodicidad_facturacion)
    && !facturados.has(p.id) && !pedidosEnAgrupada.has(p.id) && r2(p.total) > 0);
  return { descuadres, duplicadas, sinFactura };
}
