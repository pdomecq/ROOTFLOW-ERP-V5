// ==================== V86 — RENTABILIDAD: MARGEN BRUTO, EBITDA Y EBIT ====================
// Cálculo puro (sin React ni Supabase) para poder probarlo aparte. Lo usa la sección "Rentabilidad".
//
// Criterios (todo sin IVA):
//  · Ventas = base imponible de las facturas emitidas (no canceladas), por fecha de factura.
//    Cada factura se reparte entre sus líneas (pedido o albaranes) en proporción a su importe;
//    los portes van aparte. Las facturas sin líneas quedan como "Sin detalle".
//  · Gastos = desgloseGasto(g).base (el IVA soportado no es coste), por fecha del gasto.
//    Se clasifican por categoría: materiales → margen bruto; variables → margen de contribución;
//    estructura → EBITDA; CAPEX → amortización lineal mensual → EBIT.
//  · Reparto a variedades: semillas y sustrato por bandejas sembradas de cada variedad en el periodo
//    (si no hay lotes, por kg vendidos); envases por unidades vendidas; costes variables y de
//    estructura por bandeja-día (bandejas × días de ciclo), por kg o por ventas, a elegir.
//  · Clientes y líneas de negocio heredan el coste por kg de cada variedad que compran. Lo que se
//    produjo y no se vendió queda en "Producción no vendida" para que los totales cuadren.

export const GRUPOS_PYG = {
  materiales: { label: 'Coste de materiales', orden: 1 },
  variables: { label: 'Costes variables de producción y reparto', orden: 2 },
  estructura: { label: 'Costes de estructura', orden: 3 },
  capex: { label: 'Inversión (se amortiza)', orden: 4 },
};

// Categoría de gasto (claves de categoriasGasto) → grupo de la cuenta de resultados
export const CLASIFICACION_PYG = {
  semillas: { grupo: 'materiales', sub: 'semillas', label: 'Semillas' },
  sustratos: { grupo: 'materiales', sub: 'sustrato', label: 'Sustrato y aprovisionamientos' },
  embalajes: { grupo: 'materiales', sub: 'envases', label: 'Envases y embalajes' },
  energia: { grupo: 'variables', label: 'Luz, agua y gas' },
  transporte: { grupo: 'variables', label: 'Transporte y reparto' },
  alquiler: { grupo: 'estructura', label: 'Alquiler' },
  reparaciones: { grupo: 'estructura', label: 'Reparaciones y mantenimiento' },
  asesoria: { grupo: 'estructura', label: 'Asesoría y profesionales' },
  seguros: { grupo: 'estructura', label: 'Seguros' },
  banco: { grupo: 'estructura', label: 'Comisiones bancarias' },
  publicidad: { grupo: 'estructura', label: 'Publicidad y marketing' },
  servicios: { grupo: 'estructura', label: 'Otros servicios' },
  tributos: { grupo: 'estructura', label: 'Tributos' },
  nominas: { grupo: 'estructura', label: 'Sueldos y salarios' },
  seguridad_social: { grupo: 'estructura', label: 'Seguridad Social' },
  software: { grupo: 'estructura', label: 'Software' },
  formacion: { grupo: 'estructura', label: 'Formación' },
  otros: { grupo: 'estructura', label: 'Otros gastos' },
};
export const clasificarGasto = (categoria) => {
  if (String(categoria || '').startsWith('capex')) return { grupo: 'capex', label: 'Inversión' };
  return CLASIFICACION_PYG[categoria] || { grupo: 'estructura', label: 'Otros gastos', clave: 'otros' };
};

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const mesDe = (fecha) => String(fecha || '').slice(0, 7);

// Lista de meses AAAA-MM entre dos fechas (incluidas)
export const mesesEntre = (desde, hasta) => {
  const out = [];
  let [y, m] = mesDe(desde).split('-').map(Number);
  const [y2, m2] = mesDe(hasta).split('-').map(Number);
  while (y < y2 || (y === y2 && m <= m2)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
};

// Nombre de variedad de un producto: su variedad o, si no tiene, el nombre sin formato ("Albahaca 15g" → "Albahaca")
export const variedadDeProducto = (producto, variedades) => {
  const v = (variedades || []).find((x) => x.id === producto?.variedad_id);
  if (v?.nombre) return v.nombre;
  return String(producto?.nombre || 'Sin variedad').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s*\d+\s*(g|gr|kg)\b.*$/i, '').trim() || 'Sin variedad';
};
const esPorte = (producto, nombreVariedad) => /transporte|porte/i.test(nombreVariedad || '') || /transporte|porte/i.test(producto?.nombre || '');

// Días que una bandeja ocupa el rack: los del lote si los tiene, si no los de la variedad
const diasCiclo = (lote, variedad) => {
  const g = Number(lote?.dias_germinacion) || Number(variedad?.dias_germinacion) || 0;
  const c = Number(lote?.dias_crecimiento) || Number(variedad?.dias_luz) || Number(variedad?.dias_crecimiento) || 0;
  return g + c || 10;
};

/**
 * @param datos { facturas, pedidoItems, albaranes, productos, variedades, clientes, gastos, lotes }
 * @param op    { desde, hasta (AAAA-MM-DD), reparto: 'bandeja_dia' | 'kg' | 'ventas', linea: 'todas' | 'distribucion' | 'restaurantes' }
 * @param h     { desgloseGasto(g), lineaDeCliente(c), gramosPorUnidad(p), vidaUtilAnios(g) }
 */
export function calcularRentabilidad(datos, op, h) {
  const { facturas = [], pedidoItems = [], albaranes = [], productos = [], variedades = [], clientes = [], gastos = [], lotes = [] } = datos;
  const meses = mesesEntre(op.desde, op.hasta);
  const enPeriodo = (f) => f && String(f) >= op.desde && String(f) <= op.hasta;
  const prodById = new Map(productos.map((p) => [p.id, p]));
  const cliById = new Map(clientes.map((c) => [c.id, c]));
  const varPorNombre = new Map(variedades.map((v) => [v.nombre, v]));

  // ---------- 1. Ventas por línea ----------
  const lineas = []; // { mes, cliente_id, linea, variedad, producto, importe, gramos, unidades, porte }
  const avisos = { facturasSinDetalle: 0, importeSinDetalle: 0, lineasSinGramos: 0 };
  const facturasPeriodo = facturas.filter((f) => f.estado !== 'cancelada' && enPeriodo(f.fecha));
  for (const f of facturasPeriodo) {
    const cli = cliById.get(f.cliente_id);
    const linea = h.lineaDeCliente(cli);
    const base = Number(f.base_imponible) || 0;
    const mes = mesDe(f.fecha);
    // Líneas de la factura
    let items = [];
    let portes = 0;
    const albIds = Array.isArray(f.albaranes_ids) ? f.albaranes_ids.map(String) : [];
    if (albIds.length) {
      for (const a of albaranes.filter((x) => albIds.includes(String(x.id)))) {
        portes += Number(a.coste_envio) || 0;
        for (const it of Array.isArray(a.items_json) ? a.items_json : []) {
          items.push({ producto_id: Number(it.producto_id), cantidad: Number(it.cantidad) || 0, importe: (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0) });
        }
      }
      if (Number(f.portes_importe) > 0) portes = Number(f.portes_importe);
    } else if (f.pedido_id) {
      items = pedidoItems.filter((i) => i.pedido_id === f.pedido_id).map((i) => ({ producto_id: i.producto_id, cantidad: Number(i.cantidad) || 0, importe: Number(i.subtotal) || 0 }));
    }
    // Las líneas de "transporte" son portes
    items = items.filter((it) => {
      const p = prodById.get(it.producto_id);
      if (esPorte(p, variedadDeProducto(p, variedades))) { portes += it.importe; return false; }
      return true;
    });
    portes = Math.min(portes, base);
    const baseProductos = base - portes;
    const sumaItems = items.reduce((t, it) => t + it.importe, 0);
    if (portes > 0) lineas.push({ mes, cliente_id: f.cliente_id, linea, variedad: null, importe: portes, gramos: 0, unidades: 0, porte: true });
    if (!items.length || sumaItems <= 0) {
      if (baseProductos > 0.005) {
        avisos.facturasSinDetalle++; avisos.importeSinDetalle += baseProductos;
        lineas.push({ mes, cliente_id: f.cliente_id, linea, variedad: 'Sin detalle', importe: baseProductos, gramos: 0, unidades: 0, porte: false });
      }
      continue;
    }
    for (const it of items) {
      const p = prodById.get(it.producto_id);
      const g = h.gramosPorUnidad(p) * it.cantidad;
      if (!g) avisos.lineasSinGramos++;
      lineas.push({ mes, cliente_id: f.cliente_id, linea, variedad: variedadDeProducto(p, variedades), producto: p?.nombre, importe: baseProductos * (it.importe / sumaItems), gramos: g, unidades: it.cantidad, porte: false });
    }
  }

  // ---------- 2. Gastos por grupo y mes ----------
  const gastosMes = {}; // mes → { claveConcepto → importe }
  const conceptos = {}; // claveConcepto → { grupo, sub, label }
  const sumarGasto = (mes, clave, info, importe) => {
    if (!meses.includes(mes)) return;
    conceptos[clave] = conceptos[clave] || info;
    gastosMes[mes] = gastosMes[mes] || {};
    gastosMes[mes][clave] = (gastosMes[mes][clave] || 0) + importe;
  };
  for (const g of gastos) {
    const c = clasificarGasto(g.categoria);
    const base = h.desgloseGasto(g).base;
    if (c.grupo === 'capex') {
      // Amortización lineal mensual desde el mes de compra
      const anios = Number(h.vidaUtilAnios(g)) || 10;
      const cuota = base / (anios * 12);
      const inicio = mesDe(g.fecha);
      const fin = mesesEntre(g.fecha, `${Number(inicio.slice(0, 4)) + anios}-${inicio.slice(5, 7)}-01`).slice(0, anios * 12);
      for (const m of fin) sumarGasto(m, 'amortizacion', { grupo: 'amortizacion', label: 'Amortización del inmovilizado' }, cuota);
      continue;
    }
    if (!enPeriodo(g.fecha)) continue;
    const clave = c.sub || g.categoria || 'otros';
    sumarGasto(mesDe(g.fecha), CLASIFICACION_PYG[g.categoria] ? clave : 'otros', CLASIFICACION_PYG[g.categoria] ? { grupo: c.grupo, sub: c.sub, label: c.label } : { grupo: 'estructura', label: 'Otros gastos' }, base);
  }
  const totalGrupoMes = (mes, filtro) => Object.entries(gastosMes[mes] || {}).filter(([k]) => filtro(conceptos[k], k)).reduce((t, [, v]) => t + v, 0);

  // ---------- 3. Producción (lotes) por mes y variedad ----------
  const prodMes = {}; // mes → variedad → { bandejas, bandejaDias }
  for (const l of lotes.filter((x) => enPeriodo(x.fecha_siembra))) {
    const p = prodById.get(l.producto_id);
    const v = variedades.find((x) => x.id === l.variedad_id);
    const nombre = v?.nombre || variedadDeProducto(p, variedades);
    if (esPorte(p, nombre)) continue;
    const m = mesDe(l.fecha_siembra);
    prodMes[m] = prodMes[m] || {};
    const o = (prodMes[m][nombre] = prodMes[m][nombre] || { bandejas: 0, bandejaDias: 0 });
    o.bandejas += Number(l.bandejas) || 0;
    o.bandejaDias += (Number(l.bandejas) || 0) * diasCiclo(l, v || varPorNombre.get(nombre));
  }

  // ---------- 4. Reparto mes a mes de los costes entre variedades ----------
  // Cada mes, sus compras de semilla y sustrato van a las bandejas sembradas ese mes (o, sin lotes,
  // a los kg vendidos), los envases a las unidades vendidas y el resto según el criterio elegido.
  const acumVar = {}; // variedad → totales del periodo
  const costeKgMes = {}; // mes → variedad → { mat, varb, est } por kg vendido
  let mesesSinLotes = 0;
  const sumaDe = (obj, campo) => Object.values(obj).reduce((t, x) => t + (x[campo] || 0), 0);
  for (const mes of meses) {
    const ventasVar = {};
    for (const l of lineas.filter((x) => x.mes === mes && !x.porte && x.variedad !== 'Sin detalle')) {
      const o = (ventasVar[l.variedad] = ventasVar[l.variedad] || { importe: 0, gramos: 0, unidades: 0 });
      o.importe += l.importe; o.gramos += l.gramos; o.unidades += l.unidades;
    }
    // Variedades vendidas sin lotes propios ese mes (mezclas, stock de otro mes): cuentan como
    // "bandejas equivalentes" = kg vendidos ÷ gramos por bandeja, para que también carguen coste
    const prod = { ...(prodMes[mes] || {}) };
    const estimadas = new Set();
    for (const [nombre, v] of Object.entries(ventasVar)) {
      if (prod[nombre]?.bandejas > 0 || !(v.gramos > 0)) continue;
      const vv = varPorNombre.get(nombre);
      const gpb = Number(vv?.rendimiento_g_por_bandeja) || Number(vv?.gramos_por_bandeja) || 150;
      const eq = v.gramos / gpb;
      prod[nombre] = { bandejas: eq, bandejaDias: eq * diasCiclo(null, vv) };
      estimadas.add(nombre);
    }
    const tot = { bandejas: sumaDe(prod, 'bandejas'), bandejaDias: sumaDe(prod, 'bandejaDias'), gramos: sumaDe(ventasVar, 'gramos'), unidades: sumaDe(ventasVar, 'unidades'), importe: sumaDe(ventasVar, 'importe') };
    if (!tot.bandejas && tot.gramos) mesesSinLotes++;
    const peso = (nombre, tipo) => {
      const v = ventasVar[nombre] || {}; const p = prod[nombre] || {};
      const c = (n, d) => (d > 0 ? n / d : 0);
      if (tipo === 'bandejas') return tot.bandejas > 0 ? c(p.bandejas || 0, tot.bandejas) : c(v.gramos || 0, tot.gramos);
      if (tipo === 'bandeja_dia') return tot.bandejaDias > 0 ? c(p.bandejaDias || 0, tot.bandejaDias) : c(v.gramos || 0, tot.gramos);
      if (tipo === 'unidades') return tot.unidades > 0 ? c(v.unidades || 0, tot.unidades) : c(v.gramos || 0, tot.gramos);
      if (tipo === 'kg') return c(v.gramos || 0, tot.gramos);
      return c(v.importe || 0, tot.importe);
    };
    const g = (filtro) => totalGrupoMes(mes, filtro);
    const cSemSus = g((c) => c?.grupo === 'materiales' && c.sub !== 'envases');
    const cEnv = g((c) => c?.grupo === 'materiales' && c.sub === 'envases');
    const cVar = g((c) => c?.grupo === 'variables');
    const cEst = g((c) => c?.grupo === 'estructura');
    const cAm = g((c) => c?.grupo === 'amortizacion');
    costeKgMes[mes] = {};
    for (const nombre of new Set([...Object.keys(ventasVar), ...Object.keys(prod)])) {
      const v = ventasVar[nombre] || { importe: 0, gramos: 0, unidades: 0 };
      const p = prod[nombre] || { bandejas: 0, bandejaDias: 0 };
      const mat = cSemSus * peso(nombre, 'bandejas') + cEnv * peso(nombre, 'unidades');
      const varb = cVar * peso(nombre, op.reparto);
      const est = cEst * peso(nombre, op.reparto);
      const am = cAm * peso(nombre, op.reparto);
      const a = (acumVar[nombre] = acumVar[nombre] || { ventas: 0, gramos: 0, unidades: 0, bandejas: 0, bandejasEstimadas: 0, bandejaDias: 0, materiales: 0, variables: 0, estructura: 0, amortizacion: 0 });
      a.ventas += v.importe; a.gramos += v.gramos; a.unidades += v.unidades; a.bandejaDias += p.bandejaDias;
      if (estimadas.has(nombre)) a.bandejasEstimadas += p.bandejas; else a.bandejas += p.bandejas;
      a.materiales += mat; a.variables += varb; a.estructura += est; a.amortizacion += am;
      if (v.gramos > 0) costeKgMes[mes][nombre] = { mat: mat / (v.gramos / 1000), varb: varb / (v.gramos / 1000), est: est / (v.gramos / 1000) };
    }
  }
  const porVariedad = Object.entries(acumVar).map(([nombre, a]) => {
    const mb = a.ventas - a.materiales;
    const ebitda = mb - a.variables - a.estructura;
    const kg = a.gramos / 1000;
    return {
      variedad: nombre, ventas: a.ventas, kg, unidades: a.unidades, bandejas: a.bandejas, bandejasEstimadas: a.bandejasEstimadas, bandejaDias: a.bandejaDias,
      eurKg: kg > 0 ? a.ventas / kg : null,
      materiales: a.materiales, margenBruto: mb, mbPct: a.ventas > 0 ? mb / a.ventas : null,
      variables: a.variables, estructura: a.estructura, ebitda, ebitdaPct: a.ventas > 0 ? ebitda / a.ventas : null,
      ebit: ebitda - a.amortizacion, costeKg: kg > 0 ? (a.materiales + a.variables + a.estructura) / kg : null,
      ebitdaKg: kg > 0 ? ebitda / kg : null,
    };
  }).sort((x, y) => y.ventas - x.ventas);

  // ---------- 5. Por cliente y por línea de negocio ----------
  const agrupar = (claveDe) => {
    const out = {};
    for (const l of lineas) {
      const k = claveDe(l);
      out[k] = out[k] || { clave: k, ventas: 0, portes: 0, gramos: 0, materiales: 0, variables: 0, estructura: 0, sinDetalle: 0 };
      const o = out[k];
      if (l.porte) { o.portes += l.importe; o.ventas += l.importe; continue; }
      o.ventas += l.importe;
      if (l.variedad === 'Sin detalle') { o.sinDetalle += l.importe; continue; }
      o.gramos += l.gramos;
      const c = costeKgMes[l.mes]?.[l.variedad];
      if (c) { const kg = l.gramos / 1000; o.materiales += c.mat * kg; o.variables += c.varb * kg; o.estructura += c.est * kg; }
    }
    return Object.values(out).map((o) => {
      const mb = o.ventas - o.materiales;
      const ebitda = mb - o.variables - o.estructura;
      return { ...o, kg: o.gramos / 1000, eurKg: o.gramos > 0 ? (o.ventas - o.portes - o.sinDetalle) / (o.gramos / 1000) : null, margenBruto: mb, mbPct: o.ventas > 0 ? mb / o.ventas : null, ebitda, ebitdaPct: o.ventas > 0 ? ebitda / o.ventas : null };
    }).sort((a, b) => b.ventas - a.ventas);
  };
  const porCliente = agrupar((l) => l.cliente_id).map((o) => ({ ...o, cliente: cliById.get(o.clave)?.nombre || 'Cliente', linea: h.lineaDeCliente(cliById.get(o.clave)) }));
  const porLinea = agrupar((l) => l.linea);

  // Lo producido y no vendido (o vendido en facturas sin detalle) no se carga a ningún cliente
  const asignadoClientes = agrupar((l) => l.cliente_id).reduce((t, c) => t + c.materiales + c.variables + c.estructura, 0);

  // ---------- 6. Cuenta de resultados mensual ----------
  const pyg = meses.map((mes) => {
    const ls = lineas.filter((l) => l.mes === mes);
    const ventasProducto = ls.filter((l) => !l.porte).reduce((t, l) => t + l.importe, 0);
    const portes = ls.filter((l) => l.porte).reduce((t, l) => t + l.importe, 0);
    const ventas = ventasProducto + portes;
    const conceptosMes = gastosMes[mes] || {};
    const sumaGrupo = (grupo) => Object.entries(conceptosMes).filter(([k]) => conceptos[k]?.grupo === grupo).reduce((t, [, v]) => t + v, 0);
    const materiales = sumaGrupo('materiales');
    const variables = sumaGrupo('variables');
    const estructura = sumaGrupo('estructura');
    const amortizacion = sumaGrupo('amortizacion');
    const mb = ventas - materiales;
    const contribucion = mb - variables;
    const ebitda = contribucion - estructura;
    const gramos = ls.reduce((t, l) => t + l.gramos, 0);
    return {
      mes, ventasProducto, portes, ventas, conceptos: conceptosMes, materiales, margenBruto: mb, mbPct: ventas > 0 ? mb / ventas : null,
      variables, contribucion, estructura, ebitda, ebitdaPct: ventas > 0 ? ebitda / ventas : null, amortizacion, ebit: ebitda - amortizacion,
      kg: gramos / 1000,
    };
  });
  const sumaPyg = (campo) => pyg.reduce((t, m) => t + (m[campo] || 0), 0);
  const tot = {};
  ['ventasProducto', 'portes', 'ventas', 'materiales', 'margenBruto', 'variables', 'contribucion', 'estructura', 'ebitda', 'amortizacion', 'ebit', 'kg'].forEach((c) => { tot[c] = sumaPyg(c); });
  tot.mbPct = tot.ventas > 0 ? tot.margenBruto / tot.ventas : null;
  tot.contribucionPct = tot.ventas > 0 ? tot.contribucion / tot.ventas : null;
  tot.ebitdaPct = tot.ventas > 0 ? tot.ebitda / tot.ventas : null;
  tot.ebitPct = tot.ventas > 0 ? tot.ebit / tot.ventas : null;
  tot.eurKg = tot.kg > 0 ? tot.ventasProducto / tot.kg : null;
  tot.costeKg = tot.kg > 0 ? (tot.materiales + tot.variables + tot.estructura) / tot.kg : null;
  // Punto de equilibrio (ventas mensuales para EBITDA 0) = estructura mensual / % de contribución
  tot.estructuraMes = meses.length ? tot.estructura / meses.length : 0;
  tot.puntoEquilibrioMes = tot.contribucionPct > 0 ? tot.estructuraMes / tot.contribucionPct : null;
  tot.ventasMes = meses.length ? tot.ventas / meses.length : 0;
  tot.conceptos = {};
  for (const m of pyg) for (const [k, v] of Object.entries(m.conceptos)) tot.conceptos[k] = (tot.conceptos[k] || 0) + v;

  // Costes que no se cargan a ningún cliente: producción no vendida, meses sin ventas, facturas sin detalle
  const noAsignado = tot.materiales + tot.variables + tot.estructura - asignadoClientes;

    // Filtrado por línea de negocio (solo afecta a las tablas de detalle)
  const filtroLinea = (x) => !op.linea || op.linea === 'todas' || x.linea === op.linea;

  return {
    meses, pyg, tot, conceptos,
    porVariedad, porCliente: porCliente.filter(filtroLinea), porLinea,
    noAsignado,
    avisos: { ...avisos, importeSinDetalle: r2(avisos.importeSinDetalle), mesesSinLotes, bandejas: Object.values(prodMes).reduce((t, x) => t + sumaDe(x, 'bandejas'), 0) },
  };
}
