// V87: numeración correlativa de las facturas emitidas y cuadre con la contabilidad.
// Funciones puras (sin Supabase ni React) para poder probarlas en Node.
//
// Reglas (art. 6 y 15 del Reglamento de facturación, RD 1619/2012):
//  - Cada serie (F-AAAA-, R-AAAA-) va numerada de forma correlativa, sin huecos y en orden de fecha.
//  - Una factura emitida no se borra: se anula con una factura rectificativa (serie R) y el número se queda.
//  - Solo se puede borrar la ÚLTIMA de su serie si no se ha enviado ni cobrado: su número se reutiliza.
//  - Los números que se borraron antes de la V87 se registran como "número anulado" (tipo 'anulada', importe 0).

export const ESTADOS_SIN_VENTA = ['anulada', 'rectificativa', 'cancelada']; // fuera de análisis de ventas

// "F-2026-0017" → { prefijo: 'F-2026-', n: 17, ancho: 4 }
export function partesId(id) {
  const m = String(id || '').match(/^(.*?)(\d+)\s*$/);
  if (!m) return null;
  return { prefijo: m[1], n: parseInt(m[2], 10), ancho: m[2].length };
}

export const esNumeroAnulado = (f) => f?.tipo === 'anulada'; // hueco antiguo registrado (sin importes)
export const esRectificativa = (f) => f?.tipo === 'rectificativa' || /^R-/.test(String(f?.id || ''));

// Huecos y desorden de fechas en cada serie.
// fechasConocidas: { 'F-2026-0005': '2026-09-05' } (p. ej. la fecha del asiento que dejó la factura borrada);
// se usa si cae entre la del número anterior y la del siguiente.
export function analizarSerie(facturas, fechasConocidas = {}) {
  const series = {};
  for (const f of facturas || []) {
    const p = partesId(f.id);
    if (!p) continue;
    (series[p.prefijo] = series[p.prefijo] || { prefijo: p.prefijo, ancho: p.ancho, items: [] }).items.push({ ...p, f });
  }
  const resultado = [];
  for (const s of Object.values(series)) {
    s.items.sort((a, b) => a.n - b.n);
    const porN = new Map(s.items.map((i) => [i.n, i.f]));
    const max = s.items[s.items.length - 1].n;
    const huecos = [];
    for (let n = 1; n <= max; n++) {
      if (porN.has(n)) continue;
      // fecha del número anterior que existe (o del siguiente si es el primero): así no se rompe el orden
      const id = `${s.prefijo}${String(n).padStart(s.ancho, '0')}`;
      let antes = null, despues = null;
      for (let k = n - 1; k >= 1 && !antes; k--) antes = porN.get(k)?.fecha || null;
      for (let k = n + 1; k <= max && !despues; k++) despues = porN.get(k)?.fecha || null;
      const conocida = fechasConocidas[id];
      const fecha = conocida && (!antes || conocida >= antes) && (!despues || conocida <= despues) ? conocida : (antes || despues);
      huecos.push({ id, n, fecha });
    }
    const desordenadas = [];
    let anterior = null;
    for (const i of s.items) {
      if (anterior && i.f.fecha && anterior.f.fecha && i.f.fecha < anterior.f.fecha) desordenadas.push({ id: i.f.id, fecha: i.f.fecha, anteriorId: anterior.f.id, anteriorFecha: anterior.f.fecha });
      anterior = i;
    }
    resultado.push({ prefijo: s.prefijo, total: s.items.length, ultimo: s.items[s.items.length - 1].f.id, huecos, desordenadas });
  }
  return resultado.sort((a, b) => a.prefijo.localeCompare(b.prefijo));
}

// ¿Es la última de su serie? (la única que se puede borrar sin dejar hueco)
export function esUltimaDeSuSerie(factura, facturas) {
  const p = partesId(factura?.id);
  if (!p) return false;
  return !(facturas || []).some((f) => { const q = partesId(f.id); return q && q.prefijo === p.prefijo && q.n > p.n; });
}

// Siguiente número de la serie R del año
export function siguienteId(prefijo, facturas, ancho = 4) {
  let max = 0;
  for (const f of facturas || []) { const p = partesId(f.id); if (p && p.prefijo === prefijo && p.n > max) max = p.n; }
  return `${prefijo}${String(max + 1).padStart(ancho, '0')}`;
}

const r2 = (x) => Math.round((parseFloat(x) || 0) * 100) / 100;
const saldoCuenta = (asiento, cuenta) => r2((asiento.lineas || []).filter((l) => String(l.cuenta) === cuenta).reduce((s, l) => s + (parseFloat(l.debe) || 0) - (parseFloat(l.haber) || 0), 0));

// Cuadre entre facturas emitidas y asientos de ventas (FAC-<id>) y cobros (COB-<id>)
export function cuadreVentas(facturas, asientos) {
  const porId = new Map((facturas || []).map((f) => [String(f.id), f]));
  const fac = {}, cob = {};
  for (const a of asientos || []) {
    const ref = String(a.referencia || '');
    if (ref.startsWith('FAC-')) (fac[ref.slice(4)] = fac[ref.slice(4)] || []).push(a);
    else if (ref.startsWith('COB-')) (cob[ref.slice(4)] = cob[ref.slice(4)] || []).push(a);
  }
  const sobrantes = [];      // asientos de ventas de facturas que no existen (borradas) o de números anulados
  const sinAsiento = [];     // facturas sin asiento de venta
  const duplicados = [];     // facturas con más de un asiento de venta
  const descuadrados = [];   // asiento con importe distinto del total de la factura
  for (const [id, lista] of Object.entries(fac)) {
    const f = porId.get(id);
    if (!f || esNumeroAnulado(f)) lista.forEach((a) => sobrantes.push({ asiento: a, facturaId: id, importe: saldoCuenta(a, '430'), motivo: f ? 'número anulado' : 'la factura ya no existe' }));
  }
  for (const f of facturas || []) {
    if (esNumeroAnulado(f)) continue;
    const lista = fac[String(f.id)] || [];
    if (!lista.length) { if (Math.abs(r2(f.total)) > 0.005) sinAsiento.push(f); continue; }
    if (lista.length > 1) { duplicados.push({ factura: f, asientos: lista, importes: lista.map((a) => saldoCuenta(a, '430')) }); continue; }
    const imp = saldoCuenta(lista[0], '430');
    if (Math.abs(imp - r2(f.total)) > 0.01) descuadrados.push({ factura: f, asiento: lista[0], importe: imp });
  }
  const cobrosHuerfanos = [];   // cobros de facturas que no existen o que no están cobradas
  const cobrosDescuadrados = []; // cobro por importe distinto del total
  for (const [id, lista] of Object.entries(cob)) {
    const f = porId.get(id);
    lista.forEach((a, i) => {
      const imp = saldoCuenta(a, '572') || -saldoCuenta(a, '430');
      if (!f) cobrosHuerfanos.push({ asiento: a, facturaId: id, importe: imp, motivo: 'la factura ya no existe' });
      else if (f.estado !== 'pagada' && f.estado !== 'anulada') cobrosHuerfanos.push({ asiento: a, facturaId: id, importe: imp, motivo: `la factura está ${f.estado}` });
      else if (i > 0) cobrosHuerfanos.push({ asiento: a, facturaId: id, importe: imp, motivo: 'cobro repetido' });
      else if (Math.abs(imp - r2(f.total)) > 0.01) cobrosDescuadrados.push({ factura: f, asiento: a, importe: imp });
    });
  }
  const facturasARehacer = [...sinAsiento, ...duplicados.map((d) => d.factura), ...descuadrados.map((d) => d.factura)];
  const totalIncidencias = sobrantes.length + facturasARehacer.length + cobrosHuerfanos.length + cobrosDescuadrados.length;
  return { sobrantes, sinAsiento, duplicados, descuadrados, cobrosHuerfanos, cobrosDescuadrados, facturasARehacer, totalIncidencias };
}

// Datos de la factura rectificativa que anula por completo `f` (importes en negativo)
export function datosRectificativa(f, id, fechaHoy, motivo) {
  const neg = (x) => (r2(x) ? -r2(x) : 0);
  const fechaES = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : '');
  return {
    id,
    pedido_id: null,
    cliente_id: f.cliente_id,
    fecha: fechaHoy,
    fecha_vencimiento: fechaHoy,
    estado: 'rectificativa',
    tipo: 'rectificativa',
    subtotal: neg(f.subtotal),
    descuento_aplicado: neg(f.descuento_aplicado),
    base_imponible: neg(f.base_imponible ?? f.subtotal),
    iva_porcentaje: f.iva_porcentaje,
    iva: neg(f.iva),
    recargo_equivalencia: !!f.recargo_equivalencia,
    re_porcentaje: f.re_porcentaje || 0,
    re_importe: neg(f.re_importe),
    total: neg(f.total),
    portes_importe: neg(f.portes_importe),
    periodo_desde: f.periodo_desde || null,
    periodo_hasta: f.periodo_hasta || null,
    metodo_cobro: f.metodo_cobro || null,
    concepto: `Factura rectificativa de la factura ${f.id} de ${fechaES(f.fecha)}: anulación total (art. 15 RD 1619/2012).${motivo ? ' Motivo: ' + motivo : ''}`,
    factura_rectificada_id: f.id,
    motivo_anulacion: motivo || null,
  };
}
