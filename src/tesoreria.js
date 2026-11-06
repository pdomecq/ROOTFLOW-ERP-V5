// V107: TESORERÍA — cálculo puro (sin React ni Supabase) para poder probarlo en Node con datos reales.
//  · reconstruirSaldos(): saldo de cada día a partir de los movimientos del BBVA. El extracto trae el saldo tras cada
//    apunte (no siempre en orden dentro del día) y Enable Banking a veces no lo trae: se encadenan los importes desde el
//    último saldo conocido y se avisa si un día no cuadra (= faltan movimientos).
//  · clasificarMovimiento(): cobros de clientes, aportaciones de socios, proveedores, impuestos, comisiones…
//  · resumenMensual(): entradas y salidas por mes y por tipo.
//  · pagosRecurrentes(): cargos que se repiten cada mes (alquiler, luz, software…) para preverlos.
//  · prevision(): saldo previsto día a día con los cobros y pagos esperados; punto más bajo.
//  · diasCobro(): días que tarda en pagar cada cliente (desde la fecha de la factura).

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dia = (f) => String(f || '').slice(0, 10);
export const sumarDias = (iso, n) => { const d = new Date(`${dia(iso)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export const diasEntre = (a, b) => Math.round((Date.parse(`${dia(a)}T12:00:00Z`) - Date.parse(`${dia(b)}T12:00:00Z`)) / 86400000);
const sumarMes = (iso, n = 1) => { const d = new Date(`${dia(iso)}T12:00:00Z`); const dd = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); const fin = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(dd, fin)); return d.toISOString().slice(0, 10); };
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

// ---------- saldos ----------
// Saldo al final de un día con varios apuntes: el del apunte que no es «anterior» de ningún otro del mismo día
function saldoFinalDelDia(movs) {
  const conSaldo = movs.filter(m => m.saldo !== null && m.saldo !== undefined && m.saldo !== '');
  if (!conSaldo.length) return null;
  const finales = conSaldo.filter(m => !conSaldo.some(n => n !== m && Math.abs(r2(Number(n.saldo) - Number(n.importe)) - r2(m.saldo)) < 0.011));
  return r2((finales[0] || conSaldo[0]).saldo);
}

/**
 * movs: [{ fecha, importe, saldo? }] (cualquier orden). Devuelve { diario: [{ fecha, saldo, entradas, salidas, estimado }],
 * saldoHoy, fechaUltimo, avisos: [{ fecha, esperado, banco, diferencia }] }.
 */
export function reconstruirSaldos(movs, hasta = null) {
  const porDia = new Map();
  for (const m of movs || []) { const f = dia(m.fecha); if (!f) continue; if (!porDia.has(f)) porDia.set(f, []); porDia.get(f).push(m); }
  const dias = [...porDia.keys()].sort();
  if (!dias.length) return { diario: [], saldoHoy: null, fechaUltimo: null, avisos: [] };
  const diario = [];
  const avisos = [];
  let saldo = null;
  // Saldo al empezar: el final del primer día con saldo, menos lo de los días anteriores y lo de ese día
  for (const f of dias) {
    const ms = porDia.get(f);
    const neto = r2(ms.reduce((t, m) => t + Number(m.importe || 0), 0));
    const entradas = r2(ms.filter(m => Number(m.importe) > 0).reduce((t, m) => t + Number(m.importe), 0));
    const salidas = r2(ms.filter(m => Number(m.importe) < 0).reduce((t, m) => t - Number(m.importe), 0));
    const banco = saldoFinalDelDia(ms);
    if (saldo === null) {
      if (banco === null) { diario.push({ fecha: f, saldo: null, entradas, salidas, estimado: true, neto }); continue; }
      // rellenar hacia atrás los días sin saldo del principio
      let s = r2(banco - neto);
      for (let i = diario.length - 1; i >= 0; i--) { diario[i].saldo = s; s = r2(s - diario[i].neto); }
      saldo = banco;
      diario.push({ fecha: f, saldo, entradas, salidas, estimado: false, neto });
      continue;
    }
    const esperado = r2(saldo + neto);
    if (banco !== null && Math.abs(banco - esperado) > 0.011) avisos.push({ fecha: f, esperado, banco, diferencia: r2(banco - esperado) });
    saldo = banco !== null ? banco : esperado;
    diario.push({ fecha: f, saldo, entradas, salidas, estimado: banco === null, neto });
  }
  // rellenar días sin movimientos hasta «hasta» (para la gráfica)
  const completo = [];
  const fin = hasta && hasta > dias[dias.length - 1] ? hasta : dias[dias.length - 1];
  let i = 0, ultimo = null;
  for (let f = dias[0]; f <= fin; f = sumarDias(f, 1)) {
    if (diario[i] && diario[i].fecha === f) { ultimo = diario[i]; completo.push(diario[i]); i++; }
    else completo.push({ fecha: f, saldo: ultimo ? ultimo.saldo : null, entradas: 0, salidas: 0, estimado: ultimo ? ultimo.estimado : true, neto: 0 });
  }
  const ult = diario[diario.length - 1];
  return { diario: completo, saldoHoy: ult.saldo, fechaUltimo: ult.fecha, saldoEstimado: ult.estimado, avisos };
}

// ---------- clasificación ----------
export const TIPOS_MOVIMIENTO = {
  cobro: { label: 'Cobros de clientes', signo: 1, color: '#16a34a' },
  stripe: { label: 'Transferencias de Stripe', signo: 1, color: '#635BFF' },
  socios: { label: 'Aportaciones de socios', signo: 1, color: '#0ea5e9' },
  otros_ingresos: { label: 'Otros ingresos', signo: 1, color: '#84cc16' },
  proveedores: { label: 'Proveedores y gastos', signo: -1, color: '#f97316' },
  suministros: { label: 'Luz, agua, teléfono y software', signo: -1, color: '#eab308' },
  impuestos: { label: 'Impuestos y Seguridad Social', signo: -1, color: '#dc2626' },
  comisiones: { label: 'Comisiones del banco', signo: -1, color: '#a3a3a3' },
  socios_salida: { label: 'Pagos a socios', signo: -1, color: '#0284c7' },
  tarjeta_entrada: { label: 'Dinero pasado desde la tarjeta de crédito', signo: 1, color: '#c084fc' },
  tarjeta_salida: { label: 'Pagos de la tarjeta de crédito', signo: -1, color: '#9333ea' },
  otros_gastos: { label: 'Otros pagos', signo: -1, color: '#78716c' },
};
/** m: movimiento; socios: lista de textos (apellidos/nombres) que identifican a los socios en el banco */
export function clasificarMovimiento(m, socios = []) {
  const t = norm(`${m.concepto || ''} ${m.contraparte || ''}`);
  const imp = Number(m.importe) || 0;
  const esSocio = socios.some(s => s && t.includes(norm(s)));
  if (/traspaso desde tarj|abo por traspaso/.test(t)) return 'tarjeta_entrada';
  if (/deuda vencida de tarjeta|adeudo mensual de tarjeta|^traspaso \d|traspaso \d{4}/.test(t)) return imp >= 0 ? 'tarjeta_entrada' : 'tarjeta_salida';
  if (imp >= 0) {
    if (/stripe/.test(t)) return 'stripe';
    if (['ya_cobrada', 'cobrado', 'conciliado', 'sugerido'].includes(m.estado) || (Array.isArray(m.factura_ids) && m.factura_ids.length)) return 'cobro';
    if (esSocio || /aportacion|ap socio/.test(t)) return 'socios';
    if (/remesa de comercios|tpv|liquidacion remesa/.test(t)) return 'cobro';
    return 'otros_ingresos';
  }
  if (/aeat|agencia tributaria|hacienda|tgss|seg social|seguridad social|impuesto|modelo \d{3}/.test(t)) return 'impuestos';
  if (/comision|mantenimiento|retencion promocion|cuota tarjeta/.test(t)) return 'comisiones';
  if (esSocio) return 'socios_salida';
  if (/iberdrola|curenergia|endesa|naturgy|canal de isabel|agua|movistar|vodafone|orange|digi|google|microsoft|anthropic|claude|adobe|apple|openai|shopify|wix|holded|stripe/.test(t)) return 'suministros';
  return 'proveedores';
}

export function resumenMensual(movs, socios = []) {
  const out = {};
  for (const m of movs || []) {
    const mes = dia(m.fecha).slice(0, 7);
    if (!mes) continue;
    const tipo = clasificarMovimiento(m, socios);
    out[mes] = out[mes] || { mes, entradas: 0, salidas: 0, porTipo: {} };
    const imp = Number(m.importe) || 0;
    if (imp >= 0) out[mes].entradas = r2(out[mes].entradas + imp); else out[mes].salidas = r2(out[mes].salidas - imp);
    out[mes].porTipo[tipo] = r2((out[mes].porTipo[tipo] || 0) + Math.abs(imp));
  }
  return Object.values(out).sort((a, b) => a.mes.localeCompare(b.mes));
}

// ---------- pagos que se repiten cada mes ----------
const claveCargo = (m) => {
  const base = norm(m.contraparte) || norm(String(m.concepto || '').replace(/^(adeudo a su cargo|adeudo de|transferencias|recibo|compra tarjeta)\s*[|/]*/i, ''));
  return base.split(' ').filter(w => w.length > 2 && !/^\d+$/.test(w)).slice(0, 2).join(' ');
};
/**
 * Pagos que se repiten: mismo destinatario en al menos 2 meses de los últimos 4, el último hace menos de 2 meses y
 * el total de cada mes parecido (±40 %; p. ej. el alquiler en varios pagos). Devuelve [{ clave, concepto, importe
 * (negativo, media de los 2 últimos meses), ultima, meses, tipo }]. No incluye socios, impuestos ni la tarjeta.
 */
export function pagosRecurrentes(movs, hoy, socios = []) {
  const desde = sumarMes(hoy, -4);
  const grupos = new Map();
  for (const m of movs || []) {
    if (!(Number(m.importe) < 0) || dia(m.fecha) < desde) continue;
    const tipo = clasificarMovimiento(m, socios);
    if (['socios_salida', 'impuestos', 'tarjeta_salida', 'comisiones'].includes(tipo)) continue;
    const k = claveCargo(m);
    if (!k) continue;
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(m);
  }
  const out = [];
  for (const [clave, ms] of grupos) {
    const porMes = {};
    ms.forEach(m => { const mes = dia(m.fecha).slice(0, 7); porMes[mes] = r2((porMes[mes] || 0) + Math.abs(Number(m.importe))); });
    const meses = Object.keys(porMes).sort();
    if (meses.length < 2) continue;
    const ultima = ms.map(m => dia(m.fecha)).sort().pop();
    if (diasEntre(hoy, ultima) > 62) continue; // ya no se paga
    const totales = meses.map(k => porMes[k]);
    const med = totales.slice().sort((a, b) => a - b)[Math.floor(totales.length / 2)];
    if (totales.some(x => Math.abs(x - med) > med * 0.4)) continue; // importes muy distintos: no es un pago fijo
    const dos = totales.slice(-2);
    const ult = ms.slice().sort((a, b) => dia(a.fecha).localeCompare(dia(b.fecha))).pop();
    out.push({ clave, concepto: ult.contraparte || ult.concepto, importe: -r2(dos.reduce((t, x) => t + x, 0) / dos.length), ultima, meses: meses.length, tipo: clasificarMovimiento(ult, socios) });
  }
  return out.sort((a, b) => a.importe - b.importe);
}

// ---------- previsión ----------
/**
 * saldoHoy, hoy, dias (horizonte), eventos: [{ fecha, importe (+ cobro / − pago), concepto, tipo, dudoso? }].
 * Los eventos con fecha pasada se mueven a «hoy + atraso» (las facturas vencidas: cuando se cobren).
 * recurrentes: de pagosRecurrentes() → se repiten cada mes en el horizonte desde su último cargo.
 * Devuelve { serie: [{ fecha, saldo, cobros, pagos }], minimo, fechaMinimo, final, eventos (ordenados con saldo después) }.
 */
export function prevision({ saldoHoy, hoy, dias = 90, eventos = [], recurrentes = [], atrasoVencidas = 7 }) {
  const fin = sumarDias(hoy, dias);
  const todos = [];
  for (const e of eventos) {
    let f = dia(e.fecha) || hoy;
    if (f < hoy) f = sumarDias(hoy, e.importe > 0 ? atrasoVencidas : 0);
    if (f > fin) continue;
    todos.push({ ...e, fecha: f, importe: r2(e.importe) });
  }
  for (const r of recurrentes) {
    let f = sumarMes(r.ultima, 1);
    while (f <= hoy) f = sumarMes(f, 1);
    while (f <= fin) { todos.push({ fecha: f, importe: r.importe, concepto: r.concepto, tipo: 'recurrente' }); f = sumarMes(f, 1); }
  }
  todos.sort((a, b) => a.fecha.localeCompare(b.fecha) || b.importe - a.importe);
  const serie = [];
  let saldo = r2(saldoHoy || 0), j = 0, minimo = saldo, fechaMinimo = hoy;
  for (let f = hoy; f <= fin; f = sumarDias(f, 1)) {
    let cobros = 0, pagos = 0;
    while (j < todos.length && todos[j].fecha === f) {
      const e = todos[j];
      if (e.importe >= 0) cobros = r2(cobros + e.importe); else pagos = r2(pagos - e.importe);
      saldo = r2(saldo + e.importe);
      e.saldoDespues = saldo;
      j++;
    }
    if (saldo < minimo) { minimo = saldo; fechaMinimo = f; }
    serie.push({ fecha: f, saldo, cobros, pagos });
  }
  return { serie, minimo, fechaMinimo, final: saldo, eventos: todos };
}
export const saldoEn = (prev, n) => prev.serie[Math.min(n, prev.serie.length - 1)]?.saldo ?? null;

// ---------- días de cobro por cliente ----------
export function diasCobro(facturas) {
  const out = {};
  for (const f of facturas || []) {
    if (f.estado !== 'pagada' || !f.fecha_cobro || !f.fecha || f.tipo === 'anulada' || /^R-/.test(String(f.id))) continue;
    const d = diasEntre(f.fecha_cobro, f.fecha);
    if (d < 0) continue;
    const c = out[f.cliente_id] = out[f.cliente_id] || { cliente_id: f.cliente_id, n: 0, suma: 0, total: 0 };
    c.n++; c.suma += d; c.total = r2(c.total + Number(f.total || 0));
  }
  return Object.values(out).map(c => ({ ...c, media: Math.round(c.suma / c.n) })).sort((a, b) => b.media - a.media);
}

// ==================== V108: CONTABILIZAR LOS MOVIMIENTOS DEL BANCO ====================
// Cada movimiento del BBVA tiene que estar en la 572 una sola vez:
//  · cobro de factura (conciliado / ya_cobrada)          → ya tiene su asiento COB-<factura>
//  · pago de un gasto registrado (forma de pago banco)  → ya tiene su asiento GAS-<gasto>
//  · aportación de socio registrada                     → asiento APO-<aportación> (572 / 551)
//  · transferencia de Stripe                             → asiento STR-… (572 / 5721)
//  · asiento hecho desde aquí                            → BAN-<movimiento>
//  · cargo y «anulación de adeudo» del mismo importe     → se compensan, no hace falta asiento
// El resto se propone con su contrapartida (editable) para contabilizarlo con un clic.
export const CONTRAPARTIDAS_BANCO = {
  '551': 'Cuenta corriente con socios',
  '5201': 'Tarjeta de crédito (deuda con el banco)',
  '626': 'Comisiones y servicios bancarios',
  '4750': 'Pago de IVA (modelo 303)',
  '4751': 'Pago de retenciones (modelos 111 / 115)',
  '476': 'Seguridad Social',
  '631': 'Otros tributos (IAE, tasas…)',
  '473': 'Retenciones que nos han practicado',
  '769': 'Otros ingresos financieros (cashback, bonificaciones)',
  '759': 'Ingresos por servicios diversos',
  '701': 'Venta sin factura (ticket) con IVA 4 %',
  '628': 'Suministros (devolución o pago sin factura)',
  '629': 'Otros servicios (pago sin factura)',
  '400': 'Proveedores (pago a cuenta de una factura que falta)',
  '430': 'Clientes (cobro a cuenta)',
  '555': 'Partidas pendientes de aplicación (no sé qué es)',
};
const SOCIO_DE_TEXTO = [['socio_peri', /domecq|pedro/], ['socio_guzman', /greus|guzman/], ['socio_nico', /bustamante|nicolas|nico\b/]];
export const socioDeMovimiento = (m) => { const t = norm(`${m.concepto || ''} ${m.contraparte || ''}`); return (SOCIO_DE_TEXTO.find(([, re]) => re.test(t)) || [null])[0]; };
const esTpvTexto = (t) => /remesa de comercios|liquidacion remesa|tpv/.test(t);

/** Contrapartida que se propone para un movimiento sin asiento */
export function contrapartidaSugerida(m, tipo) {
  const t = norm(`${m.concepto || ''} ${m.contraparte || ''}`);
  const imp = Number(m.importe) || 0;
  if (tipo === 'tarjeta_entrada' || tipo === 'tarjeta_salida') return { cuenta: '5201', nota: imp > 0 ? 'Dinero dispuesto de la tarjeta de crédito' : 'Pago de la tarjeta de crédito' };
  if (tipo === 'socios' || tipo === 'socios_salida') return { cuenta: '551', nota: imp > 0 ? 'Aportación de socio sin apuntar' : 'Pago / reembolso a socio' };
  if (tipo === 'stripe') return { cuenta: '5721', nota: 'Transferencia de Stripe' };
  if (/retencion promocion|retencion/.test(t) && imp < 0) return { cuenta: '473', nota: 'Retención sobre la bonificación' };
  if (/cashback|bonif|promocion comercial/.test(t)) return { cuenta: '769', nota: 'Bonificación del banco' };
  if (tipo === 'comisiones') return { cuenta: '626', nota: 'Comisión bancaria' };
  if (tipo === 'impuestos') return { cuenta: /seg social|tgss|seguridad social/.test(t) ? '476' : '4750', nota: 'Pago a Hacienda: elige el modelo (303 IVA → 4750, 111/115 → 4751)' };
  if (imp > 0 && esTpvTexto(t)) return { cuenta: '701', nota: 'Venta con tarjeta sin factura (ticket): base + IVA 4 %' };
  if (imp > 0 && /devoluc/.test(t)) return { cuenta: '628', nota: 'Devolución de un gasto' };
  if (imp > 0) return { cuenta: '759', nota: 'Otro ingreso' };
  if (tipo === 'suministros') return { cuenta: '628', nota: 'Falta el gasto: regístralo con su factura (o contabilízalo sin factura, sin IVA)' };
  return { cuenta: '629', nota: 'Falta el gasto: regístralo con su factura (o contabilízalo sin factura, sin IVA)' };
}

/** Líneas del asiento BAN-<id> (572 contra la contrapartida; la venta sin factura separa el IVA del 4 %) */
export function lineasAsientoBanco(m, cuenta, nombreCuenta = '') {
  const imp = r2(Math.abs(Number(m.importe) || 0));
  const entra = Number(m.importe) > 0;
  const banco = { cuenta: '572', concepto: 'Bancos c/c vista, euros', debe: entra ? imp : 0, haber: entra ? 0 : imp };
  if (cuenta === '701' && entra) {
    const base = r2(imp / 1.04);
    return [banco, { cuenta: '701', concepto: 'Ventas de productos terminados (ticket)', debe: 0, haber: base }, { cuenta: '477', concepto: 'H.P. IVA repercutido (4%)', debe: 0, haber: r2(imp - base) }];
  }
  return [banco, { cuenta, concepto: nombreCuenta || CONTRAPARTIDAS_BANCO[cuenta] || cuenta, debe: entra ? 0 : imp, haber: entra ? imp : 0 }];
}

/**
 * movs: movimientos_banco · gastos · aportaciones: aportaciones_socios · asientos: asientos_contables · lineas: asiento_lineas
 * Devuelve { filas: [{ mov, tipo, estado, detalle, gasto?, aportacion?, cuenta?, nota? }], pendientes, aportacionesSinAsiento,
 *            gastosSinMovimiento, regularizacion: { fecha, saldoBanco, saldoContable, diferencia } | null, inicio }
 */
export function planContabilizarBanco({ movs = [], gastos = [], aportaciones = [], asientos = [], lineas = [], socios = [] }) {
  const ordenados = [...movs].sort((a, b) => dia(a.fecha).localeCompare(dia(b.fecha)) || (a.id || 0) - (b.id || 0));
  const inicio = ordenados.length ? dia(ordenados[0].fecha) : null;
  const refs = new Set(asientos.map(a => String(a.referencia || '')));
  const asientoPorId = new Map(asientos.map(a => [a.id, a]));
  // Aportaciones por transferencia: se casan con el ingreso del socio (mismo importe, ±6 días)
  const aportBanco = aportaciones.filter(a => !/efectivo|caja|metalico/i.test(String(a.metodo || '')));
  const aportUsadas = new Set();
  const gastoUsado = new Set();
  const gastosBanco = gastos.filter(g => ['banco', 'transferencia'].includes(g.forma_pago || 'banco') && r2(g.importe) > 0);
  // Ingresos de Stripe ya contabilizados (asientos STR-…: debe en la 572)
  const strLineas = lineas.filter(l => l.cuenta === '572' && r2(l.debe) > 0 && /^STR-/.test(String(asientoPorId.get(l.asiento_id)?.referencia || '')))
    .map(l => ({ importe: r2(l.debe), fecha: dia(asientoPorId.get(l.asiento_id)?.fecha), usado: false }));
  const filas = [];
  const anulaciones = ordenados.filter(m => Number(m.importe) > 0 && /anulacion adeudo/.test(norm(m.concepto)));
  const compensados = new Set();
  const casados = new Set(); // referencias de asientos que corresponden a un movimiento del banco (para el saldo inicial)
  for (const a of anulaciones) {
    const cargo = ordenados.find(m => Number(m.importe) < 0 && !compensados.has(m.id) && Math.abs(r2(m.importe) + r2(a.importe)) < 0.011 && Math.abs(diasEntre(m.fecha, a.fecha)) <= 15);
    if (cargo) { compensados.add(cargo.id); compensados.add(a.id); }
  }
  for (const m of ordenados) {
    const tipo = clasificarMovimiento(m, socios);
    const imp = r2(m.importe);
    const fila = { mov: m, tipo };
    if (refs.has(`BAN-${m.id}`)) { filas.push({ ...fila, estado: 'asiento', detalle: `Asiento BAN-${m.id}` }); continue; }
    if (['conciliado', 'ya_cobrada'].includes(m.estado) && (m.factura_ids || []).length) { m.factura_ids.forEach(id => casados.add(`COB-${id}`)); filas.push({ ...fila, estado: 'cobro', detalle: `Cobro de ${(m.factura_ids || []).join(', ')}` }); continue; }
    if (compensados.has(m.id)) { filas.push({ ...fila, estado: 'compensado', detalle: imp > 0 ? 'Devolución de un adeudo: se anula con su cargo' : 'Adeudo devuelto: se anula con su devolución' }); continue; }
    if (imp > 0 && tipo === 'stripe') {
      const s = strLineas.find(x => !x.usado && Math.abs(x.importe - imp) < 0.011 && Math.abs(diasEntre(x.fecha, m.fecha)) <= 6);
      if (s) { s.usado = true; filas.push({ ...fila, estado: 'asiento', detalle: 'Transferencia de Stripe (asiento STR)' }); continue; }
    }
    if (imp > 0 && (tipo === 'socios' || socioDeMovimiento(m))) {
      const socio = socioDeMovimiento(m);
      const cands = aportBanco.filter(a => !aportUsadas.has(a.id) && Math.abs(r2(a.importe) - imp) < 0.011 && Math.abs(diasEntre(a.fecha, m.fecha_valor || m.fecha)) <= 6 && (!socio || !a.socio_clave || a.socio_clave === socio))
        .sort((a, b) => Math.abs(diasEntre(a.fecha, m.fecha)) - Math.abs(diasEntre(b.fecha, m.fecha)));
      if (cands.length) { aportUsadas.add(cands[0].id); casados.add(`APO-${cands[0].id}`); filas.push({ ...fila, estado: 'aportacion', aportacion: cands[0], detalle: `Aportación registrada (${cands[0].socio_clave?.replace('socio_', '')})` }); continue; }
      filas.push({ ...fila, estado: 'proponer', socio, cuenta: '551', nota: 'Aportación de socio sin apuntar: se apunta también en Socios' });
      continue;
    }
    if (imp < 0) {
      const cands = gastosBanco.filter(g => !gastoUsado.has(g.id) && Math.abs(r2(g.importe) + imp) < 0.011 && Math.abs(diasEntre(g.fecha, m.fecha)) <= 20)
        .sort((a, b) => Math.abs(diasEntre(a.fecha, m.fecha)) - Math.abs(diasEntre(b.fecha, m.fecha)));
      if (cands.length) { gastoUsado.add(cands[0].id); casados.add(`GAS-${cands[0].id}`); filas.push({ ...fila, estado: 'gasto', gasto: cands[0], detalle: `Gasto «${cands[0].concepto || cands[0].proveedor || cands[0].id}»` }); continue; }
      // Una transferencia que paga varias facturas a la vez (alquiler + agua + luz): 2 a 4 gastos que suman el cargo
      const cerca = gastosBanco.filter(g => !gastoUsado.has(g.id) && r2(g.importe) < -imp && Math.abs(diasEntre(g.fecha, m.fecha)) <= 20).slice(0, 14);
      let combo = null;
      for (let mask = 1; mask < 1 << cerca.length && !combo; mask++) {
        const sel = cerca.filter((_, i) => mask & (1 << i));
        if (sel.length >= 2 && sel.length <= 4 && Math.abs(r2(sel.reduce((t, g) => t + r2(g.importe), 0)) + imp) < 0.011) combo = sel;
      }
      if (combo) { combo.forEach(g => { gastoUsado.add(g.id); casados.add(`GAS-${g.id}`); }); filas.push({ ...fila, estado: 'gasto', gasto: combo[0], gastos: combo, detalle: `Gastos ${combo.map(g => `«${g.concepto || g.id}»`).join(' + ')}` }); continue; }
    }
    const sug = contrapartidaSugerida(m, tipo);
    filas.push({ ...fila, estado: 'proponer', cuenta: sug.cuenta, nota: sug.nota, faltaGasto: imp < 0 && ['proveedores', 'suministros'].includes(tipo) });
  }
  // Aportaciones sin asiento APO (también las de antes de tener el banco cargado: el dinero entró en la cuenta)
  const aportacionesSinAsiento = aportBanco.filter(a => !refs.has(`APO-${a.id}`));
  // Gastos «pagados por banco» en el periodo del banco que no aparecen en él (¿con tarjeta? ¿los pagó un socio?)
  const fin = ordenados.length ? dia(ordenados[ordenados.length - 1].fecha) : null;
  const gastosSinMovimiento = inicio ? gastosBanco.filter(g => !gastoUsado.has(g.id) && dia(g.fecha) >= sumarDias(inicio, 5) && dia(g.fecha) <= sumarDias(fin, -5)) : [];
  // Apuntes de la 572 que no deberían estar: asientos de gastos borrados, asientos que ya no cuadran con su gasto
  // y cobros (COB) de facturas cuyo dinero no ha entrado en el banco
  const gastoPorId = new Map(gastos.map(g => [String(g.id), g]));
  const lineasDe = new Map();
  for (const l of lineas) { if (!lineasDe.has(l.asiento_id)) lineasDe.set(l.asiento_id, []); lineasDe.get(l.asiento_id).push(l); }
  const cobradasEnBanco = new Set(ordenados.filter(m => ['conciliado', 'ya_cobrada'].includes(m.estado)).flatMap(m => m.factura_ids || []));
  const revisar = [];
  for (const a of asientos) {
    const ref = String(a.referencia || '');
    const ls = (lineasDe.get(a.id) || []).filter(l => l.cuenta === '572');
    const neto = r2(ls.reduce((t, l) => t + r2(l.debe) - r2(l.haber), 0));
    if (!ls.length) continue;
    const mg = ref.match(/^GAS-(\d+)$/);
    if (mg) {
      const g = gastoPorId.get(mg[1]);
      if (!g) { if (Math.abs(neto) > 0.009) revisar.push({ tipo: 'gasto_borrado', asiento: a, importe: neto, texto: `Asiento ${a.numero || ''} de un gasto que ya no existe (${ref})` }); continue; }
      const porBanco = ['banco', 'transferencia'].includes(g.forma_pago || 'banco');
      const esperado = porBanco ? -r2(g.importe) : 0;
      if (Math.abs(neto - esperado) > 0.011) revisar.push({ tipo: 'gasto_descuadrado', asiento: a, gasto: g, importe: r2(neto - esperado), texto: `«${g.concepto || ref}»: el asiento mueve ${Math.abs(neto)} € en el banco y el gasto es de ${porBanco ? r2(g.importe) : `0 € (pagado con ${g.forma_pago})`}` });
      continue;
    }
    const mc = ref.match(/^COB-(.+)$/);
    if (mc && inicio && dia(a.fecha) >= inicio && neto > 0 && !cobradasEnBanco.has(mc[1])) {
      revisar.push({ tipo: 'cobro_sin_ingreso', asiento: a, facturaId: mc[1], importe: neto, texto: `Cobro de ${mc[1]} (${neto} €, ${dia(a.fecha)}) que no ha entrado en el BBVA` });
    }
  }
  // Saldo inicial: el banco antes del primer movimiento contra la 572 de la contabilidad hasta ese día (+ aportaciones por contabilizar).
  // Lo que en el banco pasa después (gastos, cobros o aportaciones casados con un movimiento) no cuenta aunque su asiento sea anterior.
  let regularizacion = null;
  if (inicio) {
    const saldos = reconstruirSaldos(movs);
    const d0 = saldos.diario.find(d => d.fecha === inicio);
    if (d0 && d0.saldo !== null) {
      const saldoBanco = r2(d0.saldo - d0.neto);
      const fechaAntes = sumarDias(inicio, -1);
      const antes = (l) => { const a = asientoPorId.get(l.asiento_id); return a && dia(a.fecha) && dia(a.fecha) <= fechaAntes && !casados.has(String(a.referencia || '')) && String(a.referencia || '') !== 'BAN-INICIO'; };
      const contable = r2(lineas.filter(l => l.cuenta === '572' && antes(l)).reduce((t, l) => t + r2(l.debe) - r2(l.haber), 0)
        + aportacionesSinAsiento.filter(a => dia(a.fecha) <= fechaAntes && !aportUsadas.has(a.id)).reduce((t, a) => t + r2(a.importe), 0));
      const ini = asientos.find(a => a.referencia === 'BAN-INICIO');
      const yaRegularizado = !!ini;
      const hecho = ini ? r2((lineasDe.get(ini.id) || []).filter(l => l.cuenta === '572').reduce((t, l) => t + r2(l.debe) - r2(l.haber), 0)) : 0;
      regularizacion = { fecha: fechaAntes, saldoBanco, saldoContable: contable, diferencia: r2(saldoBanco - contable - hecho), previo: hecho, hecho: yaRegularizado && Math.abs(saldoBanco - contable - hecho) < 0.01 };
    }
  }
  const pendientes = filas.filter(f => f.estado === 'proponer');
  return { filas, pendientes, aportacionesSinAsiento, gastosSinMovimiento, revisar, regularizacion, inicio };
}
