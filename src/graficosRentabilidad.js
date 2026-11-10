// V110: datos de los gráficos de Rentabilidad (cálculo puro, sin React ni Supabase) para poder probarlo en Node.
//  · periodoAnterior(): el mismo número de meses justo antes (para comparar).
//  · puenteBeneficio(): de EBITDA del periodo anterior al actual: volumen (kg), precio (€/kg), portes, materiales,
//    costes variables y estructura. La suma de los pasos cuadra exacta con la diferencia de EBITDA.
//  · puenteResultados(): de las ventas al EBIT (ventas − materiales = margen bruto − variables − estructura = EBITDA − amortización = EBIT).
//  · rioCaja(): el dinero que ha entrado y salido del banco en el periodo, agrupado por origen y destino, cuadrado con la
//    variación de caja (si sale más de lo que entra, la diferencia sale «de la caja»).

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dia = (f) => String(f || '').slice(0, 10);

export function periodoAnterior(desde, hasta) {
  const [y0, m0] = dia(desde).split('-').map(Number);
  const [y1, m1] = dia(hasta).split('-').map(Number);
  const meses = (y1 - y0) * 12 + (m1 - m0) + 1;
  const ini = new Date(Date.UTC(y0, m0 - 1 - meses, 1));
  const fin = new Date(Date.UTC(y0, m0 - 1, 0));
  return { desde: ini.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10), meses };
}

const paso = (clave, label, valor, tipo, nota) => ({ clave, label, valor: r2(valor), tipo, nota });

/** ant y act: `tot` de calcularRentabilidad. Pasos: total inicial, deltas y total final. */
export function puenteBeneficio(ant, act) {
  const kg0 = Number(ant.kg) || 0, kg1 = Number(act.kg) || 0;
  const vp0 = Number(ant.ventasProducto) || 0, vp1 = Number(act.ventasProducto) || 0;
  let volumen, precio;
  if (kg0 > 0 && kg1 > 0) {
    const p0 = vp0 / kg0, p1 = vp1 / kg1;
    volumen = (kg1 - kg0) * p0;
    precio = (p1 - p0) * kg1;
  } else { volumen = vp1 - vp0; precio = 0; } // sin kilos en uno de los dos periodos no se puede separar
  const pasos = [
    paso('inicio', 'EBITDA anterior', ant.ebitda, 'total'),
    paso('volumen', 'Volumen', volumen, 'delta', kg0 > 0 && kg1 > 0 ? `${r2(kg1 - kg0)} kg a ${r2(vp0 / kg0)} €/kg` : 'cambio de ventas'),
    paso('precio', 'Precio', precio, 'delta', kg0 > 0 && kg1 > 0 ? `${r2(vp1 / kg1 - vp0 / kg0)} €/kg` : ''),
    paso('portes', 'Portes', (Number(act.portes) || 0) - (Number(ant.portes) || 0), 'delta'),
    paso('materiales', 'Materiales', -((Number(act.materiales) || 0) - (Number(ant.materiales) || 0)), 'delta', 'semilla, sustrato, envases'),
    paso('variables', 'Variables', -((Number(act.variables) || 0) - (Number(ant.variables) || 0)), 'delta', 'luz, agua, transporte'),
    paso('estructura', 'Estructura', -((Number(act.estructura) || 0) - (Number(ant.estructura) || 0)), 'delta', 'alquiler, software, gestoría…'),
    paso('fin', 'EBITDA actual', act.ebitda, 'total'),
  ];
  // El redondeo de cada paso no debe descuadrar el total
  const suma = pasos.filter((p) => p.tipo === 'delta').reduce((t, p) => t + p.valor, 0);
  const desfase = r2(pasos[pasos.length - 1].valor - pasos[0].valor - suma);
  if (Math.abs(desfase) >= 0.01) pasos[1].valor = r2(pasos[1].valor + desfase);
  return pasos;
}

export function puenteResultados(t) {
  return [
    paso('ventas', 'Ventas', t.ventas, 'total'),
    paso('materiales', 'Materiales', -(Number(t.materiales) || 0), 'delta'),
    paso('mb', 'Margen bruto', t.margenBruto, 'subtotal'),
    paso('variables', 'Variables', -(Number(t.variables) || 0), 'delta'),
    paso('estructura', 'Estructura', -(Number(t.estructura) || 0), 'delta'),
    paso('ebitda', 'EBITDA', t.ebitda, 'subtotal'),
    paso('amortizacion', 'Amortización', -(Number(t.amortizacion) || 0), 'delta'),
    paso('ebit', 'EBIT', t.ebit, 'total'),
  ].filter((p) => p.tipo !== 'delta' || Math.abs(p.valor) >= 0.005);
}

/** Barras de la cascada: cada paso con su base y su tope (para pintarlo) */
export function barrasCascada(pasos) {
  let nivel = 0;
  return pasos.map((p) => {
    if (p.tipo === 'delta') { const a = nivel; nivel = r2(nivel + p.valor); return { ...p, desde: a, hasta: nivel }; }
    nivel = p.valor;
    return { ...p, desde: 0, hasta: p.valor };
  });
}

/**
 * movs: movimientos del banco. origenDe(m) / destinoDe(m) devuelven { clave, label, grupo? } (grupo = color).
 * excluir: Set de ids que no cuentan (cargo devuelto y su anulación). maxGrupos: el resto va a «Otros».
 */
export function rioCaja({ movs = [], desde, hasta, origenDe, destinoDe, excluir = new Set(), maxGrupos = 8 }) {
  const enRango = movs.filter((m) => dia(m.fecha) >= desde && dia(m.fecha) <= hasta && !excluir.has(m.id) && Number(m.importe));
  const agrupar = (lista, fn) => {
    const g = new Map();
    for (const m of lista) {
      const o = fn(m) || { clave: 'otros', label: 'Otros' };
      const x = g.get(o.clave) || { ...o, importe: 0, n: 0 };
      x.importe += Math.abs(Number(m.importe)); x.n++;
      g.set(o.clave, x);
    }
    let arr = [...g.values()].map((x) => ({ ...x, importe: r2(x.importe) })).sort((a, b) => b.importe - a.importe);
    if (arr.length > maxGrupos) {
      const resto = arr.slice(maxGrupos - 1);
      arr = [...arr.slice(0, maxGrupos - 1), { clave: 'resto', label: `Otros (${resto.length})`, grupo: 'otros', importe: r2(resto.reduce((t, x) => t + x.importe, 0)), n: resto.reduce((t, x) => t + x.n, 0) }];
    }
    return arr;
  };
  const entradas = agrupar(enRango.filter((m) => Number(m.importe) > 0), origenDe);
  const salidas = agrupar(enRango.filter((m) => Number(m.importe) < 0), destinoDe);
  const totalEntradas = r2(entradas.reduce((t, x) => t + x.importe, 0));
  const totalSalidas = r2(salidas.reduce((t, x) => t + x.importe, 0));
  const variacion = r2(totalEntradas - totalSalidas);
  if (variacion > 0.004) salidas.push({ clave: 'caja_sube', label: 'Aumento de caja', grupo: 'caja', importe: variacion, n: 0 });
  if (variacion < -0.004) entradas.push({ clave: 'caja_baja', label: 'Sacado de la caja', grupo: 'caja', importe: -variacion, n: 0 });
  return { entradas, salidas, totalEntradas, totalSalidas, variacion, movido: Math.max(totalEntradas, totalSalidas), n: enRango.length };
}
