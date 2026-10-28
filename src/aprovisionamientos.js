// V88: APROVISIONAMIENTOS REALES — inventario de semillas, sustrato, envases y etiquetas a partir de las
// facturas de gasto (sus líneas, en compras_material), consumido según lo que de verdad se usa:
//   · semillas  → bandejas sembradas (lotes) × gramos de semilla por bandeja de la variedad
//   · sustrato  → bandejas sembradas × litros de sustrato por bandeja
//   · envases   → unidades entregadas de cada producto (su envase; por defecto según el formato en gramos)
//   · etiquetas → unidades entregadas × etiquetas por unidad
//   · mercadería (brotes comprados para revender) y "otros" → el día de la compra
// Antes del primer lote registrado, las bandejas se estiman con los gramos entregados de cada variedad.
// Valoración FIFO (primero en entrar, primero en salir). Cada recuento físico ajusta el stock: la diferencia
// (merma o consumo real distinto del teórico) es coste del mes del recuento, repartido como el consumo.
// Cálculo puro (sin React ni Supabase) para poder probarlo en Node. Lo usan Rentabilidad y la pestaña Aprovisionamientos.

export const TIPOS_MATERIAL = {
  semilla: { label: 'Semillas', unidad: 'g', icono: '🌱', cultivo: true },
  sustrato: { label: 'Sustrato', unidad: 'l', icono: '🪴', cultivo: true },
  envase: { label: 'Envases', unidad: 'ud', icono: '🥡', cultivo: false },
  etiqueta: { label: 'Etiquetas', unidad: 'ud', icono: '🏷️', cultivo: false },
  mercaderia: { label: 'Mercadería (producto comprado)', unidad: 'ud', icono: '🛒', cultivo: true },
  otro: { label: 'Otros aprovisionamientos', unidad: 'ud', icono: '📦', cultivo: false },
};

// Gramos de semilla por bandeja estándar 10×20" (referencia del sector) para estimar las variedades sin ficha.
// Se escalan con el factor de vuestras bandejas (mediana ficha ÷ estándar de las variedades que sí tienen ficha).
export const SEMILLA_ESTANDAR_G = [
  [/albahaca|basil/i, 5], [/cilantro|coriander/i, 18], [/daikon/i, 28], [/r[aá]bano|radish/i, 28], [/mostaza|mustard/i, 14],
  [/amaranto|amaranth/i, 4], [/remolacha|beet/i, 25], [/r[uú]cula|arugula|rocket/i, 8], [/br[oó]coli|broccoli/i, 12],
  [/guisante|pea/i, 225], [/pak ?choi|tatsoi/i, 10], [/cebollino|chive/i, 15], [/cebolla|onion/i, 15], [/nasturtium|capuchina/i, 60],
  [/girasol|sunflower/i, 100], [/ajo|garlic/i, 150],
];

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const mesDe = (f) => String(f || '').slice(0, 7);
const sumarFecha = (iso, dias) => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };
const lista = (x) => (Array.isArray(x) ? x : typeof x === 'string' && x.trim().startsWith('[') ? (() => { try { return JSON.parse(x); } catch { return []; } })() : []);
const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

export function estandarSemilla(nombre) {
  const e = SEMILLA_ESTANDAR_G.find(([re]) => re.test(String(nombre || '')));
  return e ? e[1] : null;
}

// Gramos de semilla por bandeja de cada variedad: ficha → estándar × factor de bandeja (marcado como estimado)
export function gramosSemillaPorVariedad(variedades) {
  const ratios = [];
  for (const v of variedades || []) {
    const ficha = Number(v.gramos_semilla_por_bandeja) || 0;
    const est = estandarSemilla(v.nombre);
    if (ficha > 0 && est) ratios.push(ficha / est);
  }
  const factor = mediana(ratios) || 1;
  const out = {};
  for (const v of variedades || []) {
    const ficha = Number(v.gramos_semilla_por_bandeja) || 0;
    const est = estandarSemilla(v.nombre);
    out[v.id] = ficha > 0 ? { g: ficha, estimado: false } : est ? { g: Math.round(est * factor * 10) / 10, estimado: true } : { g: 0, estimado: true };
  }
  return { porVariedad: out, factor };
}

/**
 * @param d { materiales, compras, recuentos, gastos, lotes, variedades, productos, entregas:[{fecha, producto_id, cantidad}], mezclas,
 *            parametros: { litrosSustratoBandeja } }
 * @param h { desgloseGasto(g), gramosPorUnidad(p) }
 */
export function calcularAprovisionamientos(d, h) {
  const { materiales = [], compras = [], recuentos = [], gastos = [], lotes = [], variedades = [], productos = [], entregas = [], mezclas = [] } = d;
  const parametros = d.parametros || {};
  const varById = new Map(variedades.map((v) => [v.id, v]));
  const prodById = new Map(productos.map((p) => [p.id, p]));
  const gastoById = new Map(gastos.map((g) => [g.id, g]));
  const matById = new Map(materiales.map((m) => [m.id, m]));
  const nombreVar = (id) => varById.get(id)?.nombre || 'Sin variedad';
  const avisos = [];

  // ---------- Compras: coste de cada línea = parte proporcional de la base del gasto ----------
  // (así portes, descuentos e IVA no deducible se reparten entre las líneas y todo cuadra con la contabilidad)
  const lineasPorGasto = {};
  compras.forEach((c) => { (lineasPorGasto[c.gasto_id] = lineasPorGasto[c.gasto_id] || []).push(c); });
  const comprasValoradas = [];
  for (const [gid, ls] of Object.entries(lineasPorGasto)) {
    const g = gastoById.get(Number(gid));
    const sumaLineas = ls.reduce((t, c) => t + (Number(c.importe_linea) || 0), 0);
    const base = g ? h.desgloseGasto(g).base : sumaLineas;
    for (const c of ls) {
      const peso = sumaLineas > 0 ? (Number(c.importe_linea) || 0) / sumaLineas : 1 / ls.length;
      comprasValoradas.push({ ...c, fecha: c.fecha || g?.fecha, coste: base * peso, cantidad: Number(c.cantidad) || 0 });
    }
  }
  const gastosConLineas = new Set(Object.keys(lineasPorGasto).map(Number));

  // ---------- Bandejas sembradas (lotes) y estimadas antes del primer lote ----------
  const { porVariedad: gSem, factor: factorBandeja } = gramosSemillaPorVariedad(variedades);
  const lotesValidos = lotes.filter((l) => l.fecha_siembra && (Number(l.bandejas) || 0) > 0);
  const inicioLotes = lotesValidos.map((l) => String(l.fecha_siembra)).sort()[0] || null;
  const gramosEsperados = (vid, bandejas) => { const v = varById.get(vid); return bandejas * (Number(v?.gramos_por_bandeja) || Number(v?.rendimiento_g_por_bandeja) || 150); };
  const siembras = lotesValidos.map((l) => {
    const vid = l.variedad_id || prodById.get(l.producto_id)?.variedad_id || null;
    return { fecha: String(l.fecha_siembra).slice(0, 10), variedad_id: vid, bandejas: Number(l.bandejas), estimada: false, gramos: Number(l.gramos_estimados) || gramosEsperados(vid, Number(l.bandejas)), coste: 0 };
  });
  const componentes = (vid) => { const mz = mezclas.find((m) => lista(m.variedades_ids).includes(vid) && /mezcl|mix/i.test(m.nombre || '')); return mz ? lista(mz.variedades_ids).filter((x) => x !== vid) : []; };
  for (const e of entregas) {
    if (inicioLotes && String(e.fecha) >= inicioLotes) continue;
    const p = prodById.get(e.producto_id);
    const vid = p?.variedad_id; const v = varById.get(vid);
    if (!v || /transporte|porte/i.test(v.nombre)) continue;
    const gramos = h.gramosPorUnidad(p) * (Number(e.cantidad) || 0);
    if (!gramos) continue;
    const ciclo = (Number(v.dias_germinacion) || 0) + (Number(v.dias_crecimiento) || 10);
    const comps = componentes(vid);
    const destino = comps.length ? comps : [vid];
    for (const x of destino) {
      const vx = varById.get(x);
      const gpb = Number(vx?.rendimiento_g_por_bandeja) || Number(vx?.gramos_por_bandeja) || 150;
      siembras.push({ fecha: sumarFecha(e.fecha, -ciclo), variedad_id: x, bandejas: gramos / destino.length / gpb, estimada: true, gramos: gramos / destino.length, coste: 0 });
    }
  }
  const totalBandejas = siembras.reduce((t, s) => t + s.bandejas, 0);

  // Litros de sustrato por bandeja: parámetro o, si no hay, calibrado = litros comprados ÷ bandejas
  const litrosComprados = comprasValoradas.filter((c) => matById.get(c.material_id)?.tipo === 'sustrato').reduce((t, c) => t + c.cantidad, 0);
  let litrosBandeja = Number(parametros.litrosSustratoBandeja) || 0;
  const litrosCalibrado = !litrosBandeja;
  let litrosOrigen = litrosBandeja ? 'manual' : 'compras';
  if (!litrosBandeja) {
    // Con un recuento de sustrato se mide de verdad: (litros comprados hasta ese día − litros contados) ÷ bandejas sembradas
    const idsSustrato = new Set(materiales.filter((m) => m.tipo === 'sustrato').map((m) => m.id));
    const ultimo = recuentos.filter((r) => idsSustrato.has(r.material_id)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
    if (ultimo) {
      const f = String(ultimo.fecha).slice(0, 10);
      const comprados = comprasValoradas.filter((c) => idsSustrato.has(c.material_id) && String(c.fecha) <= f).reduce((t, c) => t + c.cantidad, 0);
      const bandejasHasta = siembras.filter((x) => x.fecha <= f).reduce((t, x) => t + x.bandejas, 0);
      const medido = bandejasHasta > 0 ? (comprados - (Number(ultimo.cantidad) || 0)) / bandejasHasta : 0;
      if (medido > 0) { litrosBandeja = medido; litrosOrigen = `recuento del ${f.split('-').reverse().join('/')}`; }
    }
    if (!litrosBandeja) litrosBandeja = totalBandejas > 0 ? litrosComprados / totalBandejas : 0;
  }

  // ---------- Envase y etiquetas de cada producto ----------
  const envases = materiales.filter((m) => m.tipo === 'envase' && m.activo !== false);
  const etiquetaDefecto = materiales.find((m) => m.tipo === 'etiqueta' && m.por_defecto && m.activo !== false) || null;
  const envaseDe = (p) => {
    if (!p) return null;
    if (p.envase_material_id) return matById.get(p.envase_material_id) || null;
    if (p.envase_material_id === 0) return null;
    const fg = Number(p.formato_gramos) || 0;
    if (!fg || p.unidad === 'g' || p.unidad === 'kg') return null; // granel
    return envases.find((m) => lista(m.formatos_gramos).map(Number).includes(fg)) || null;
  };
  const etiquetasDe = (p) => {
    const env = envaseDe(p);
    const mat = p?.etiqueta_material_id ? matById.get(p.etiqueta_material_id) : etiquetaDefecto;
    const n = p?.etiquetas_por_unidad !== null && p?.etiquetas_por_unidad !== undefined && p?.etiquetas_por_unidad !== '' ? Number(p.etiquetas_por_unidad) : env ? 1 : 0;
    return mat && n > 0 ? { mat, n } : null;
  };

  // ---------- Movimientos por material ----------
  const movs = {}; // material_id → [{fecha, tipo:'compra'|'consumo'|'recuento', cantidad, coste?, variedad, producto_id, estimada}]
  const push = (mid, m) => { (movs[mid] = movs[mid] || []).push(m); };
  for (const c of comprasValoradas) {
    const mat = matById.get(c.material_id);
    if (!mat) continue;
    push(mat.id, { fecha: c.fecha, orden: 0, tipo: 'compra', cantidad: c.cantidad, coste: c.coste, gasto_id: c.gasto_id });
    if (mat.tipo === 'mercaderia' || mat.tipo === 'otro') {
      const vids = lista(mat.variedad_ids);
      push(mat.id, { fecha: c.fecha, orden: 1, tipo: 'consumo', cantidad: c.cantidad, variedad: vids.length ? nombreVar(vids[0]) : null });
    }
  }
  const semillaDeVariedad = {};
  for (const m of materiales.filter((x) => x.tipo === 'semilla')) for (const vid of lista(m.variedad_ids)) semillaDeVariedad[vid] = semillaDeVariedad[vid] || m;
  const sustrato = materiales.find((m) => m.tipo === 'sustrato' && m.por_defecto) || materiales.find((m) => m.tipo === 'sustrato');
  const sinSemilla = {};
  for (const s of siembras) {
    const nombre = nombreVar(s.variedad_id);
    const siembra = s;
    const sem = semillaDeVariedad[s.variedad_id];
    const g = (gSem[s.variedad_id]?.g || 0) * s.bandejas;
    if (sem && g > 0) push(sem.id, { fecha: s.fecha, orden: 1, tipo: 'consumo', cantidad: g, variedad: nombre, estimada: s.estimada || gSem[s.variedad_id]?.estimado, siembra });
    else if (!sem) sinSemilla[nombre] = (sinSemilla[nombre] || 0) + s.bandejas;
    if (sustrato && litrosBandeja > 0) push(sustrato.id, { fecha: s.fecha, orden: 1, tipo: 'consumo', cantidad: s.bandejas * litrosBandeja, variedad: nombre, estimada: s.estimada || litrosCalibrado, siembra });
  }
  const unidadesProducto = {};
  for (const e of entregas) {
    const p = prodById.get(e.producto_id);
    const n = Number(e.cantidad) || 0;
    if (!p || !n) continue;
    const vnom = nombreVar(p.variedad_id);
    const env = envaseDe(p);
    if (env) push(env.id, { fecha: e.fecha, orden: 1, tipo: 'consumo', cantidad: n, variedad: vnom, producto_id: p.id });
    const et = etiquetasDe(p);
    if (et) push(et.mat.id, { fecha: e.fecha, orden: 1, tipo: 'consumo', cantidad: n * et.n, variedad: vnom, producto_id: p.id });
    const k = `${mesDe(e.fecha)}|${p.id}`;
    unidadesProducto[k] = (unidadesProducto[k] || 0) + n;
  }
  for (const r of recuentos) if (matById.get(r.material_id)) push(r.material_id, { fecha: String(r.fecha).slice(0, 10), orden: 2, tipo: 'recuento', cantidad: Number(r.cantidad) || 0 });

  // ---------- FIFO ----------
  const cultivoMes = {};   // mes → variedad → { semillas, sustrato, mercaderia, ajustes }
  const envaseMes = {};    // mes → producto_id → { envases, etiquetas, ajustes }
  const otrosMes = {};     // mes → € sin atribuir (otros aprovisionamientos, ajustes sin consumo previo)
  const consumoTipoMes = {}; // mes → tipo → €
  const comprasMes = {};   // mes → €
  const porMaterial = [];
  const sumar = (obj, mes, k1, k2, v) => { obj[mes] = obj[mes] || {}; const o = (obj[mes][k1] = obj[mes][k1] || {}); o[k2] = (o[k2] || 0) + v; };
  const campoCultivo = { semilla: 'semillas', sustrato: 'sustrato', mercaderia: 'mercaderia' };

  for (const mat of materiales) {
    const ms = (movs[mat.id] || []).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || a.orden - b.orden);
    const capas = []; // { cantidad, unitario }
    let deficit = 0; let ultimoUnitario = null;
    const proximoUnitario = (desde) => { const c = ms.find((m, i) => i > desde && m.tipo === 'compra' && m.cantidad > 0); return c ? c.coste / c.cantidad : null; };
    const res = { material: mat, comprado: 0, costeComprado: 0, consumido: 0, costeConsumido: 0, consumidoEstimado: 0, ajuste: 0, costeAjuste: 0, ultimoRecuento: null, deficitMax: 0 };
    let desdeRecuento = []; // consumos desde el último recuento (para repartir el ajuste)
    const sacar = (cant, idx) => { // devuelve coste FIFO
      let resto = cant, coste = 0;
      while (resto > 1e-9 && capas.length) {
        const c = capas[0]; const q = Math.min(c.cantidad, resto);
        coste += q * c.unitario; c.cantidad -= q; resto -= q;
        if (c.cantidad <= 1e-9) capas.shift();
      }
      if (resto > 1e-9) { // sin stock: se valora al precio de la siguiente compra (o la última conocida)
        const u = proximoUnitario(idx) ?? ultimoUnitario ?? 0;
        coste += resto * u; deficit += resto; res.deficitMax = Math.max(res.deficitMax, deficit);
      }
      return coste;
    };
    const imputar = (m, mes, coste, esAjuste = false) => {
      const tipo = mat.tipo;
      consumoTipoMes[mes] = consumoTipoMes[mes] || {};
      consumoTipoMes[mes][esAjuste ? 'ajustes' : tipo] = (consumoTipoMes[mes][esAjuste ? 'ajustes' : tipo] || 0) + coste;
      if (m.siembra) m.siembra.coste += coste; // coste de cultivo de cada lote (para el coste por gramo producido)
      if (TIPOS_MATERIAL[tipo]?.cultivo && m.variedad) sumar(cultivoMes, mes, m.variedad, esAjuste ? 'ajustes' : campoCultivo[tipo], coste);
      else if ((tipo === 'envase' || tipo === 'etiqueta') && m.producto_id) sumar(envaseMes, mes, m.producto_id, esAjuste ? 'ajustes' : tipo === 'envase' ? 'envases' : 'etiquetas', coste);
      else otrosMes[mes] = (otrosMes[mes] || 0) + coste;
    };
    ms.forEach((m, idx) => {
      const mes = mesDe(m.fecha);
      if (m.tipo === 'compra') {
        res.comprado += m.cantidad; res.costeComprado += m.coste;
        comprasMes[mes] = (comprasMes[mes] || 0) + m.coste;
        if (m.cantidad <= 0) return;
        const u = m.coste / m.cantidad; ultimoUnitario = u;
        const cubre = Math.min(deficit, m.cantidad); deficit -= cubre; // lo consumido sin stock se paga con esta compra
        if (m.cantidad - cubre > 1e-9) capas.push({ cantidad: m.cantidad - cubre, unitario: u });
      } else if (m.tipo === 'consumo') {
        const coste = sacar(m.cantidad, idx);
        res.consumido += m.cantidad; res.costeConsumido += coste;
        if (m.estimada) res.consumidoEstimado += m.cantidad;
        imputar(m, mes, coste);
        desdeRecuento.push({ ...m, coste });
      } else if (m.tipo === 'recuento') {
        const teorico = capas.reduce((t, c) => t + c.cantidad, 0) - deficit;
        const dif = teorico - m.cantidad; // >0: se gastó más de lo previsto (merma)
        res.ultimoRecuento = { fecha: m.fecha, cantidad: m.cantidad, teorico, diferencia: dif };
        if (Math.abs(dif) > 1e-9) {
          let coste;
          if (dif > 0) coste = sacar(dif, idx);
          else { const u = ultimoUnitario ?? proximoUnitario(idx) ?? 0; coste = dif * u; const sobra = -dif; const cubre = Math.min(deficit, sobra); deficit -= cubre; if (sobra - cubre > 1e-9) capas.unshift({ cantidad: sobra - cubre, unitario: u }); }
          res.ajuste += dif; res.costeAjuste += coste;
          // Reparto del ajuste como el consumo desde el recuento anterior
          const base = desdeRecuento.reduce((t, x) => t + x.cantidad, 0);
          if (base > 0) desdeRecuento.forEach((x) => imputar(x, mes, coste * (x.cantidad / base), true));
          else imputar({}, mes, coste, true);
        }
        desdeRecuento = [];
      }
    });
    const stock = capas.reduce((t, c) => t + c.cantidad, 0) - deficit;
    const valorStock = capas.reduce((t, c) => t + c.cantidad * c.unitario, 0) - deficit * (ultimoUnitario || 0);
    porMaterial.push({ ...res, stock, valorStock, costeUnitario: capas[0]?.unitario ?? ultimoUnitario, deficit });
    if (deficit > 1e-6) avisos.push({ tipo: 'stock_negativo', material: mat.nombre, cantidad: deficit, unidad: mat.unidad });
  }

  // Coste de envase y etiqueta por unidad entregada (mes, producto)
  const costeEnvaseUnidad = {};
  for (const [mes, porProd] of Object.entries(envaseMes)) {
    costeEnvaseUnidad[mes] = {};
    for (const [pid, o] of Object.entries(porProd)) {
      const n = unidadesProducto[`${mes}|${pid}`] || 0;
      const total = (o.envases || 0) + (o.etiquetas || 0) + (o.ajustes || 0);
      if (n > 0) costeEnvaseUnidad[mes][pid] = total / n;
    }
  }
  // Coste de cultivo por gramo producido de cada variedad en cada mes: lotes sembrados ese mes y el
  // anterior (lo que se cosecha y vende ese mes) ÷ gramos esperados; si no hay, la media de la variedad.
  const costeGramo = {}; // mes → variedad → €/g
  const porVar = {};
  for (const s of siembras) { const n = nombreVar(s.variedad_id); (porVar[n] = porVar[n] || []).push(s); }
  const mesAnterior = (m) => { let [y, mm] = m.split('-').map(Number); mm--; if (!mm) { mm = 12; y--; } return `${y}-${String(mm).padStart(2, '0')}`; };
  const mesesTodos = [...new Set([...siembras.map((s) => mesDe(s.fecha)), ...entregas.map((e) => mesDe(e.fecha))])].sort();
  const mediaVar = {};
  for (const [n, ss] of Object.entries(porVar)) { const g = ss.reduce((t, s) => t + s.gramos, 0); mediaVar[n] = g > 0 ? ss.reduce((t, s) => t + s.coste, 0) / g : 0; }
  const costeGramoGeneral = {}; // mes → €/g de todo lo sembrado (para mezclas y variedades sin lotes propios)
  for (const m of mesesTodos) {
    const vent = siembras.filter((s) => [m, mesAnterior(m)].includes(mesDe(s.fecha)));
    const g = vent.reduce((t, s) => t + s.gramos, 0);
    costeGramoGeneral[m] = g > 0 ? vent.reduce((t, s) => t + s.coste, 0) / g : null;
    costeGramo[m] = {};
    for (const [n, ss] of Object.entries(porVar)) {
      const vent = ss.filter((s) => [m, mesAnterior(m)].includes(mesDe(s.fecha)));
      const g = vent.reduce((t, s) => t + s.gramos, 0);
      costeGramo[m][n] = g > 0 ? vent.reduce((t, s) => t + s.coste, 0) / g : mediaVar[n];
    }
  }

  for (const [nombre, b] of Object.entries(sinSemilla)) avisos.push({ tipo: 'sin_semilla', variedad: nombre, bandejas: b });
  const estimadas = Object.entries(gSem).filter(([, x]) => x.estimado && x.g > 0).map(([id, x]) => ({ variedad: nombreVar(Number(id)), g: x.g }));

  return {
    porMaterial: porMaterial.sort((a, b) => String(a.material.tipo).localeCompare(String(b.material.tipo)) || String(a.material.nombre).localeCompare(String(b.material.nombre))),
    cultivoMes, envaseMes, otrosMes, consumoTipoMes, comprasMes, costeEnvaseUnidad, gastosConLineas, costeGramo, costeGramoMedio: mediaVar, costeGramoGeneral,
    parametros: { litrosBandeja, litrosCalibrado, litrosOrigen, factorBandeja, inicioLotes, totalBandejas, gramosSemilla: gSem, semillasEstimadas: estimadas },
    avisos,
  };
}
