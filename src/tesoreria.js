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
