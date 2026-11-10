// V109: cifras del Dashboard (cálculo puro, sin React ni Supabase) para poder probarlo en Node con datos reales.
//  · periodoDashboard(): fechas del periodo elegido y del de comparación (mismos días del mes / año anterior).
//  · esFacturaVenta(): factura que cuenta como venta (ni anulada, ni rectificativa, ni número anulado).
//  · resumenVentas(): base facturada (sin IVA) entre dos fechas, nº de facturas y clientes.
//  · resumenCobros(): lo pendiente de cobro (facturas pendientes o vencidas), lo vencido por antigüedad y quién debe.
//  · pendienteFacturar(): albaranes entregados que no están en ninguna factura (ni agrupada ni de su pedido).
//  · cobradoEntre(): facturas cobradas entre dos fechas (por fecha de cobro).
//  · ventasEntregadas(): lo entregado entre dos fechas (albaranes por fecha de entrega, base sin IVA): mide la actividad
//    real aunque el cliente facture a mes vencido (La Huerta factura en noviembre lo de octubre).

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dia = (f) => String(f || '').slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');
const finMes = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // m de 1 a 12
const diasEntre = (a, b) => Math.round((Date.parse(`${dia(a)}T12:00:00Z`) - Date.parse(`${dia(b)}T12:00:00Z`)) / 86400000);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** clave: 'mes_actual' | 'año_actual' | 'AAAA-MM'. hoy: 'AAAA-MM-DD' */
export function periodoDashboard(clave, hoy) {
  const [y, m, d] = dia(hoy).split('-').map(Number);
  if (clave === 'año_actual') {
    const dd = m === 2 && d === 29 ? 28 : d;
    return { desde: `${y}-01-01`, hasta: dia(hoy), label: `año ${y} (hasta hoy)`, antDesde: `${y - 1}-01-01`, antHasta: `${y - 1}-${pad(m)}-${pad(dd)}`, antLabel: `lo mismo de ${y - 1}` };
  }
  if (clave === 'mes_actual' || !/^\d{4}-\d{2}$/.test(String(clave || ''))) {
    const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
    const dd = Math.min(d, Number(finMes(py, pm).slice(8, 10)));
    return { desde: `${y}-${pad(m)}-01`, hasta: dia(hoy), label: `${MESES[m - 1]} (hasta hoy)`, antDesde: `${py}-${pad(pm)}-01`, antHasta: `${py}-${pad(pm)}-${pad(dd)}`, antLabel: `1-${dd} de ${MESES[pm - 1]}` };
  }
  const [yy, mm] = clave.split('-').map(Number);
  const pm = mm === 1 ? 12 : mm - 1, py = mm === 1 ? yy - 1 : yy;
  return { desde: `${yy}-${pad(mm)}-01`, hasta: finMes(yy, mm), label: `${MESES[mm - 1]} ${yy}`, antDesde: `${py}-${pad(pm)}-01`, antHasta: finMes(py, pm), antLabel: `${MESES[pm - 1]} ${py}` };
}

export const esFacturaVenta = (f) => !!f && !['anulada', 'rectificativa', 'cancelada'].includes(f.estado) && f.tipo !== 'anulada' && f.tipo !== 'rectificativa' && !/^R-/.test(String(f.id)) && Number(f.total) > 0;
const enRango = (f, desde, hasta) => !!f && dia(f) >= desde && dia(f) <= hasta;

export function resumenVentas(facturas, desde, hasta) {
  const fs = (facturas || []).filter((f) => esFacturaVenta(f) && enRango(f.fecha, desde, hasta));
  return { base: r2(fs.reduce((t, f) => t + (Number(f.base_imponible) || 0), 0)), total: r2(fs.reduce((t, f) => t + (Number(f.total) || 0), 0)), n: fs.length, clientes: new Set(fs.map((f) => f.cliente_id)).size };
}

export function cobradoEntre(facturas, desde, hasta) {
  const fs = (facturas || []).filter((f) => esFacturaVenta(f) && f.estado === 'pagada' && enRango(f.fecha_cobro, desde, hasta));
  return { total: r2(fs.reduce((t, f) => t + (Number(f.total) || 0), 0)), n: fs.length };
}

/** Facturas pendientes o vencidas: total, vencido, por antigüedad del vencimiento y por cliente (las que más deben primero) */
export function resumenCobros(facturas, hoy) {
  const vivas = (facturas || []).filter((f) => esFacturaVenta(f) && ['pendiente', 'vencida'].includes(f.estado));
  const tramos = [
    { clave: 'al_dia', label: 'Sin vencer', importe: 0, n: 0 },
    { clave: '1_15', label: '1–15 días', importe: 0, n: 0 },
    { clave: '16_30', label: '16–30 días', importe: 0, n: 0 },
    { clave: 'mas_30', label: '+30 días', importe: 0, n: 0 },
  ];
  const porCliente = new Map();
  let total = 0, vencido = 0, nVencidas = 0;
  for (const f of vivas) {
    const imp = Number(f.total) || 0;
    const vto = dia(f.fecha_vencimiento || f.fecha);
    const retraso = vto && vto < dia(hoy) ? diasEntre(hoy, vto) : 0;
    const t = retraso <= 0 ? tramos[0] : retraso <= 15 ? tramos[1] : retraso <= 30 ? tramos[2] : tramos[3];
    t.importe += imp; t.n++;
    total += imp;
    if (retraso > 0) { vencido += imp; nVencidas++; }
    const c = porCliente.get(f.cliente_id) || { cliente_id: f.cliente_id, total: 0, vencido: 0, n: 0, retrasoMax: 0, proximoVto: null, facturas: [] };
    c.total += imp; c.n++; c.facturas.push(f.id);
    if (retraso > 0) c.vencido += imp;
    c.retrasoMax = Math.max(c.retrasoMax, retraso);
    if (retraso <= 0 && (!c.proximoVto || vto < c.proximoVto)) c.proximoVto = vto;
    porCliente.set(f.cliente_id, c);
  }
  tramos.forEach((t) => { t.importe = r2(t.importe); });
  const deudores = [...porCliente.values()].map((c) => ({ ...c, total: r2(c.total), vencido: r2(c.vencido) }))
    .sort((a, b) => b.vencido - a.vencido || b.total - a.total);
  return { total: r2(total), vencido: r2(vencido), n: vivas.length, nVencidas, tramos, deudores };
}

/**
 * Albaranes entregados sin factura: ni están en una factura agrupada (albaranes_ids) ni su pedido tiene factura propia.
 * importeDe(albaran) = base sin IVA (en el ERP, calcularImportesAlbaran(a, cliente).base). desde: solo los entregados desde esa fecha.
 */
export function pendienteFacturar({ albaranes = [], facturas = [], albaranPedidos = [], importeDe, desde = '0000-00-00' }) {
  const vivas = facturas.filter((f) => f.estado !== 'anulada' && f.tipo !== 'anulada');
  const albEnFactura = new Set(vivas.flatMap((f) => (Array.isArray(f.albaranes_ids) ? f.albaranes_ids.map(String) : [])));
  const pedidosFacturados = new Set(vivas.filter((f) => f.pedido_id).map((f) => f.pedido_id));
  const lista = albaranes.filter((a) => {
    if (a.estado !== 'entregado' || albEnFactura.has(String(a.id))) return false;
    if (a.numero_factura || a.factura_semanal_id) return false;
    const fecha = fechaAlbaran(a);
    if (fecha && fecha < desde) return false;
    const peds = albaranPedidos.filter((x) => String(x.albaran_id) === String(a.id)).map((x) => x.pedido_id);
    return !(peds.length && peds.every((p) => pedidosFacturados.has(p)));
  }).map((a) => ({ albaran: a, fecha: fechaAlbaran(a), base: r2(importeDe ? importeDe(a) : Number(a.base_imponible) || 0) }));
  return { lista, base: r2(lista.reduce((t, x) => t + x.base, 0)), n: lista.length };
}

export const fechaAlbaran = (a) => dia(a.fecha_entrega_real || a.fecha_entrega_prevista || a.fecha_emision);
export function ventasEntregadas(albaranes, desde, hasta, importeDe) {
  const ls = (albaranes || []).filter((a) => ['entregado', 'facturado'].includes(a.estado) && enRango(fechaAlbaran(a), desde, hasta));
  const base = ls.reduce((t, a) => t + (importeDe ? importeDe(a) : Number(a.base_imponible) || 0), 0);
  return { base: r2(base), n: ls.length, clientes: new Set(ls.map((a) => a.cliente_id)).size, albaranes: ls };
}

/** Variación en % (null si no hay con qué comparar) */
export const variacion = (actual, anterior) => (Number(anterior) > 0 ? ((Number(actual) - Number(anterior)) / Number(anterior)) * 100 : null);
