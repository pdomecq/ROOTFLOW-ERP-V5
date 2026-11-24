// V125: impuestos y cierre contable (cálculo puro, sin React ni Supabase) para poder probarlo en Node con datos reales.
//  · periodosIVA(): meses o trimestres del año (el IVA puede pasar a mensual desde un mes: REDEME) y su plazo.
//  · libroExpedidas() / libroRecibidas(): libros registro de IVA (facturas emitidas, tickets TPV y facturas de gasto).
//  · modelo303(), modelo111y115(), resumenAnual() (390, 180, 190), modelo347(), impuestoSociedades().
//  · saldosCuentas(), cuentasAnuales() (balance y PyG abreviados), amortizacionAnual(), asientosCierre().
// Las casillas siguen los modelos vigentes de la AEAT: compruébalas al pasarlas al formulario.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const dia = (f) => String(f || '').slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');
const finMes = (y, m) => new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
export const UMBRAL_347 = 3005.06;
export const UMBRAL_BIEN_INVERSION = 3005.06; // IVA: bienes de inversión de más de 3.005,06 € (art. 108 LIVA)
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ==================== PERIODOS Y PLAZOS ====================
/** Plazo de presentación de un modelo periódico (303, 111, 115) de un periodo que termina en (anio, mesFin) */
export function plazoPeriodo(anio, mesFin, mensual) {
  if (mesFin === 12) return `${anio + 1}-01-30`;
  // V127: el IVA mensual del REDEME obliga al SII, y con SII el 303 se presenta en los 30 primeros días del mes
  // siguiente (el de enero, hasta el último día de febrero)
  if (mensual) return mesFin === 1 ? finMes(anio, 2) : `${anio}-${pad(mesFin + 1)}-30`;
  return `${anio}-${pad(mesFin + 1)}-20`;
}

/** Periodos del IVA de un año. mensualDesde = 'AAAA-MM' (alta en el REDEME) o '' (siempre trimestral) */
export function periodosIVA(anio, mensualDesde = '') {
  const out = [];
  for (let t = 1; t <= 4; t++) {
    const m1 = (t - 1) * 3 + 1;
    const mensual = mensualDesde && `${anio}-${pad(m1)}` >= mensualDesde;
    if (!mensual) {
      out.push({ clave: `${anio}-T${t}`, tipo: 'trimestral', anio, desde: `${anio}-${pad(m1)}-01`, hasta: finMes(anio, m1 + 2), label: `${t}T ${anio}`, plazo: plazoPeriodo(anio, m1 + 2, false), ultimo: t === 4 });
      continue;
    }
    for (let m = m1; m <= m1 + 2; m++) {
      out.push({ clave: `${anio}-${pad(m)}`, tipo: 'mensual', anio, desde: `${anio}-${pad(m)}-01`, hasta: finMes(anio, m), label: `${MESES[m - 1]} ${anio}`, plazo: plazoPeriodo(anio, m, true), ultimo: m === 12 });
    }
  }
  return out;
}

/** 111 y 115 siguen siendo trimestrales (solo las grandes empresas los presentan cada mes, aunque se esté en el REDEME) */
export const periodosRetenciones = (anio) => periodosIVA(anio, '');

// ==================== LIBROS REGISTRO DE IVA ====================
const esNumeroAnulado = (f) => f.tipo === 'anulada' && !(Number(f.total) || 0);
const esRectificativaF = (f) => f.tipo === 'rectificativa' || f.estado === 'rectificativa' || /^R-/.test(String(f.id));

/**
 * Facturas expedidas: facturas de venta (completas F1 y rectificativas R1) y tickets del TPV (F2, simplificadas).
 * Las anuladas sí cuentan: su rectificativa (con importes negativos) es la que las deshace.
 */
export function libroExpedidas({ facturas = [], clientes = [], recibosTpv = [], desde, hasta }) {
  const cli = new globalThis.Map(clientes.map((c) => [c.id, c]));
  const filas = [];
  for (const f of facturas) {
    const fecha = dia(f.fecha);
    if (fecha < desde || fecha > hasta || esNumeroAnulado(f)) continue;
    const c = cli.get(f.cliente_id);
    const base = r2(f.base_imponible ?? f.subtotal);
    const cuota = r2(f.iva);
    filas.push({
      fecha, numero: f.id, tipoFactura: esRectificativaF(f) ? 'R1' : 'F1', rectifica: f.factura_rectificada_id || null,
      cliente: c?.nombre?.trim() || f.cliente_nombre || '—', nif: (c?.cif || '').trim(), cp: c?.codigo_postal || '', cliente_id: f.cliente_id,
      base, tipo: Number(f.iva_porcentaje) || (base ? Math.round((cuota / base) * 1000) / 10 : 4), cuota,
      reTipo: r2(f.re_importe) ? (Number(f.re_porcentaje) || 0.5) : 0, reCuota: r2(f.re_importe), total: r2(f.total),
      estado: f.estado,
    });
  }
  for (const r of recibosTpv) {
    const fecha = dia(r.fecha);
    if (fecha < desde || fecha > hasta) continue;
    const total = r2(r.importe);
    const tipo = r.iva_tipo === 'general' ? 21 : r.iva_tipo === 'reducido' ? 10 : 4;
    const base = r.base_imponible != null ? r2(r.base_imponible) : r2(total / (1 + tipo / 100));
    filas.push({ fecha, numero: `TPV-${r.id}`, tipoFactura: 'F2', rectifica: null, cliente: r.cliente_nombre || 'Venta directa', nif: '', cp: '', cliente_id: null, base, tipo, cuota: r.iva_importe != null ? r2(r.iva_importe) : r2(total - base), reTipo: 0, reCuota: 0, total, estado: 'ticket' });
  }
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || String(a.numero).localeCompare(String(b.numero)));
}

/**
 * Facturas recibidas (gastos con IVA, también los exentos para que el libro esté completo).
 * desglose(g) = desgloseGasto del ERP. avisos: sin factura adjunta (sin ella no se puede deducir el IVA) y proveedores
 * de otro país de la UE (adquisición intracomunitaria: se autoliquida, no se paga IVA extranjero).
 */
export function libroRecibidas({ gastos = [], proveedores = [], categorias = {}, desglose, desde, hasta }) {
  const prov = new globalThis.Map(proveedores.map((p) => [p.id, p]));
  const filas = [];
  for (const g of gastos) {
    const fecha = dia(g.fecha);
    if (fecha < desde || fecha > hasta || !Number(g.importe)) continue; // los abonos del proveedor (importe negativo) también
    const d = desglose(g);
    const p = prov.get(g.proveedor_id);
    const nif = String(p?.cif || '').trim().toUpperCase();
    const capex = !!g.es_capex || categorias[g.categoria]?.tipo === 'capex';
    const intracom = /^[A-Z]{2}/.test(nif) && !/^ES/.test(nif) && /^(AT|BE|BG|CY|CZ|DE|DK|EE|EL|GR|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)/.test(nif);
    filas.push({
      fecha, gasto_id: g.id, numero: g.numero_factura || '', proveedor: p?.nombre || g.proveedor || '—', nif, proveedor_id: g.proveedor_id || null,
      concepto: g.concepto || '', categoria: g.categoria, cuenta: categorias[g.categoria]?.cuenta || '',
      base: r2(d.base), tipo: d.ivaPct, cuota: r2(d.iva), retencionPct: d.retencionPct || 0, retencion: r2(d.retencion),
      total: r2(d.totalFactura), pagado: r2(d.aPagar), inversion: capex && r2(d.base) >= UMBRAL_BIEN_INVERSION,
      sinFactura: !g.factura_url && !g.numero_factura, intracom, alquiler: g.categoria === 'alquiler', abono: Number(g.importe) < 0,
    });
  }
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.gasto_id || 0) - (b.gasto_id || 0));
}

// ==================== MODELO 303 ====================
const TIPOS_DEVENGADO = { 4: ['01', '02', '03'], 10: ['04', '05', '06'], 21: ['07', '08', '09'] };
const TIPOS_RE = { 0.5: ['16', '17', '18'], 1.4: ['19', '20', '21'], 5.2: ['22', '23', '24'] };

/** Casillas del 303 de un periodo. aCompensarAntes = cuotas a compensar de periodos anteriores (casilla 110) */
export function modelo303({ expedidas = [], recibidas = [], aCompensarAntes = 0, ultimo = false }) {
  const c = {};
  const suma = (k, v) => { c[k] = r2((c[k] || 0) + v); };
  for (const f of expedidas) {
    if (f.tipoFactura === 'R1') { suma('14', f.base); suma('15', f.cuota + f.reCuota); continue; } // modificación de bases y cuotas
    const cas = TIPOS_DEVENGADO[f.tipo] || TIPOS_DEVENGADO[4];
    suma(cas[0], f.base); c[cas[1]] = f.tipo; suma(cas[2], f.cuota);
    if (f.reCuota) { const re = TIPOS_RE[f.reTipo] || TIPOS_RE[0.5]; suma(re[0], f.base); c[re[1]] = f.reTipo; suma(re[2], f.reCuota); }
  }
  c['27'] = r2(['03', '06', '09', '15', '18', '21', '24'].reduce((t, k) => t + (c[k] || 0), 0));
  for (const g of recibidas) {
    if (!g.cuota) continue;
    if (g.abono) { suma('40', g.base); suma('41', g.cuota); } // rectificación de deducciones (abonos de proveedores)
    else if (g.inversion) { suma('30', g.base); suma('31', g.cuota); } else { suma('28', g.base); suma('29', g.cuota); }
  }
  c['45'] = r2((c['29'] || 0) + (c['31'] || 0) + (c['33'] || 0) + (c['35'] || 0) + (c['37'] || 0) + (c['39'] || 0) + (c['41'] || 0));
  c['46'] = r2(c['27'] - c['45']);
  c['64'] = c['46']; c['65'] = 100; c['66'] = c['46'];
  c['110'] = r2(aCompensarAntes);
  // En el último periodo (o cada mes en el REDEME) se aplica todo lo pendiente para pedir su devolución
  const aplicar = ultimo ? c['110'] : c['66'] > 0 ? Math.min(c['66'], c['110']) : 0;
  c['78'] = r2(aplicar);
  c['87'] = r2(c['110'] - aplicar);
  c['69'] = r2(c['66'] - aplicar);
  c['71'] = c['69'];
  // Resultado negativo: a compensar en los siguientes periodos, o a devolver en el último (o cada mes si se está en el REDEME)
  const negativo = c['71'] < 0 ? -c['71'] : 0;
  const resultado = c['71'] > 0 ? 'ingresar' : negativo ? (ultimo ? 'devolver' : 'compensar') : 'cero';
  return { casillas: c, resultado, importe: c['71'], aCompensarDespues: r2(c['87'] + (resultado === 'compensar' ? negativo : 0)) };
}

/** Cadena de 303 del año (lleva lo pendiente de compensar de un periodo al siguiente). redeme: devolución cada mes */
export function modelos303Anio({ periodos, expedidas, recibidas, aCompensarInicial = 0, redemeDesde = '' }) {
  let pendiente = r2(aCompensarInicial);
  return periodos.map((p) => {
    const ex = expedidas.filter((f) => f.fecha >= p.desde && f.fecha <= p.hasta);
    const re = recibidas.filter((g) => g.fecha >= p.desde && g.fecha <= p.hasta);
    const enRedeme = p.tipo === 'mensual' && redemeDesde && p.clave >= redemeDesde;
    const m = modelo303({ expedidas: ex, recibidas: re, aCompensarAntes: pendiente, ultimo: p.ultimo || enRedeme });
    pendiente = m.resultado === 'devolver' ? 0 : m.aCompensarDespues;
    return { ...p, ...m, nExpedidas: ex.length, nRecibidas: re.length };
  });
}

// ==================== 111 Y 115 ====================
export function modelo111y115(recibidas) {
  const alq = recibidas.filter((g) => g.retencion > 0 && g.alquiler);
  const pro = recibidas.filter((g) => g.retencion > 0 && !g.alquiler);
  const perceptores = (ls) => new Set(ls.map((g) => g.nif || g.proveedor)).size;
  return {
    m115: { '01': perceptores(alq), '02': r2(alq.reduce((t, g) => t + g.base, 0)), '03': r2(alq.reduce((t, g) => t + g.retencion, 0)), lista: alq },
    m111: { '07': perceptores(pro), '08': r2(pro.reduce((t, g) => t + g.base, 0)), '09': r2(pro.reduce((t, g) => t + g.retencion, 0)), lista: pro },
  };
}

// ==================== RESÚMENES ANUALES ====================
export function resumenAnual({ expedidas, recibidas, cadena303 }) {
  const porPerceptor = (ls) => Object.values(ls.reduce((o, g) => {
    const k = g.nif || g.proveedor;
    o[k] = o[k] || { nif: g.nif, nombre: g.proveedor, base: 0, retencion: 0, n: 0 };
    o[k].base = r2(o[k].base + g.base); o[k].retencion = r2(o[k].retencion + g.retencion); o[k].n++;
    return o;
  }, {}));
  const m303 = modelo303({ expedidas, recibidas });
  return {
    m390: {
      baseVentas: r2(expedidas.reduce((t, f) => t + f.base, 0)), cuotaVentas: m303.casillas['27'],
      baseCompras: r2(recibidas.filter((g) => g.cuota).reduce((t, g) => t + g.base, 0)), cuotaDeducible: m303.casillas['45'],
      volumenOperaciones: r2(expedidas.reduce((t, f) => t + f.base, 0)),
      ingresado: r2(cadena303.filter((p) => p.resultado === 'ingresar').reduce((t, p) => t + p.importe, 0)),
      aDevolver: r2(cadena303.filter((p) => p.resultado === 'devolver').reduce((t, p) => t - p.importe, 0)),
      aCompensarFinal: cadena303.length ? cadena303[cadena303.length - 1].aCompensarDespues : 0,
    },
    m180: porPerceptor(recibidas.filter((g) => g.retencion > 0 && g.alquiler)),
    m190: porPerceptor(recibidas.filter((g) => g.retencion > 0 && !g.alquiler)),
  };
}

/** 347: clientes (clave B) y proveedores (clave A) con más de 3.005,06 € en el año (IVA incluido), por trimestre */
export function modelo347({ expedidas, recibidas }) {
  const tri = (f) => Math.floor((Number(f.slice(5, 7)) - 1) / 3);
  const acumular = (o, clave, k, nombre, nif, cp, fecha, importe) => {
    const id = `${clave}|${k}`;
    o[id] = o[id] || { clave, nif, nombre, provincia: String(cp || '').slice(0, 2), total: 0, trimestres: [0, 0, 0, 0] };
    o[id].total = r2(o[id].total + importe); o[id].trimestres[tri(fecha)] = r2(o[id].trimestres[tri(fecha)] + importe);
  };
  const o = {};
  for (const f of expedidas) if (f.tipoFactura !== 'F2') acumular(o, 'B', f.nif || `cli-${f.cliente_id}`, f.cliente, f.nif, f.cp, f.fecha, f.total);
  // Se excluyen las compras con retención (van en el 180 / 190) y las intracomunitarias (349)
  for (const g of recibidas) if (!g.retencion && !g.intracom) acumular(o, 'A', g.nif || `prov-${g.proveedor_id || g.proveedor}`, g.proveedor, g.nif, '', g.fecha, g.total);
  return Object.values(o).filter((x) => Math.abs(x.total) > UMBRAL_347).sort((a, b) => a.clave.localeCompare(b.clave) || b.total - a.total);
}

// ==================== CONTABILIDAD: SALDOS, AMORTIZACIÓN, IMPUESTO, CIERRE ====================
/** Saldo deudor (debe − haber) de cada cuenta en un rango de fechas */
export function saldosCuentas(asientos, lineas, { desde = '0000-00-00', hasta = '9999-12-31', excluirRefs = [] } = {}) {
  const fechaDe = new globalThis.Map(asientos.filter((a) => dia(a.fecha) >= desde && dia(a.fecha) <= hasta && !excluirRefs.some((p) => String(a.referencia || '').startsWith(p))).map((a) => [a.id, a]));
  const s = {};
  for (const l of lineas) {
    if (!fechaDe.has(l.asiento_id)) continue;
    s[l.cuenta] = r2((s[l.cuenta] || 0) + (Number(l.debe) || 0) - (Number(l.haber) || 0));
  }
  return s;
}
const sumaCuentas = (s, test) => r2(Object.entries(s).filter(([c]) => test(String(c))).reduce((t, [, v]) => t + v, 0));

export const resultadoContable = (s) => r2(-sumaCuentas(s, (c) => /^[67]/.test(c)));

/** Dotación a la amortización del año: lineal por días desde la compra, con la vida útil de cada inversión */
const CUENTA_AMORT = { '210': '2810', '211': '2811', '212': '2812', '213': '2813', '214': '2814', '215': '2815', '216': '2816', '217': '2817', '218': '2818', '219': '2819' };
export function amortizacionAnual({ gastos = [], categorias = {}, desglose, anio, vidaUtil }) {
  const ini = Date.UTC(anio, 0, 1), fin = Date.UTC(anio, 11, 31) + 86400000;
  const filas = [];
  for (const g of gastos) {
    const cat = categorias[g.categoria];
    if (!(g.es_capex || cat?.tipo === 'capex') || !(Number(g.importe) > 0)) continue;
    const base = r2(desglose(g).base);
    const anios = Number(vidaUtil(g)) || 10;
    const alta = Date.parse(`${dia(g.fecha)}T00:00:00Z`);
    const finVida = alta + anios * 365.25 * 86400000;
    const dias = Math.max(0, (Math.min(fin, finVida) - Math.max(ini, alta)) / 86400000);
    const cuota = r2(base / anios / 365.25 * dias);
    if (cuota > 0) filas.push({ gasto_id: g.id, concepto: g.concepto, fecha: dia(g.fecha), cuenta: cat?.cuenta || '219', cuentaAmort: CUENTA_AMORT[cat?.cuenta] || '2819', base, anios, cuota });
  }
  const porCuenta = {};
  for (const f of filas) porCuenta[f.cuentaAmort] = r2((porCuenta[f.cuentaAmort] || 0) + f.cuota);
  return { filas, porCuenta, total: r2(filas.reduce((t, f) => t + f.cuota, 0)) };
}

/** Impuesto sobre Sociedades (estimación del 200). tipo 15 % = entidad de nueva creación (primer año con base positiva y el siguiente) */
export function impuestoSociedades({ resultadoAntes, binPendientes = 0, tipo = 15, retenciones = 0, pagosFraccionados = 0 }) {
  const base = r2(resultadoAntes);
  const compensable = base > 0 ? Math.min(base, r2(binPendientes)) : 0; // simplificado: sin el límite del 70 % (solo aplica a más de 1 M€)
  const baseImponible = r2(base - compensable);
  const cuota = baseImponible > 0 ? r2(baseImponible * tipo / 100) : 0;
  return { resultadoAntes: base, compensable, baseImponible, tipo, cuota, aPagar: r2(cuota - retenciones - pagosFraccionados), binNueva: base < 0 ? r2(-base) : 0, binRestante: r2(binPendientes - compensable + (base < 0 ? -base : 0)) };
}

/**
 * Asientos de fin de ejercicio a partir de los saldos del año (ya con amortización e impuesto):
 *  REG-AAAA: los gastos (6) y los ingresos (7) a la 129. CIE-AAAA: cierra todas las cuentas. APE-(AAAA+1): las reabre.
 */
export function asientosCierre(saldos, anio) {
  const lin = (cuenta, saldo) => ({ cuenta, debe: saldo < 0 ? r2(-saldo) : 0, haber: saldo > 0 ? r2(saldo) : 0 });
  const reg = [];
  let resultado = 0;
  for (const [c, v] of Object.entries(saldos).sort()) {
    if (!/^[67]/.test(c) || Math.abs(v) < 0.005) continue;
    reg.push(lin(c, v)); resultado = r2(resultado + v);
  }
  if (reg.length) reg.push({ cuenta: '129', debe: resultado > 0 ? resultado : 0, haber: resultado < 0 ? -resultado : 0 }); // resultado > 0 = pérdida (saldo deudor)
  const tras = { ...saldos };
  for (const c of Object.keys(tras)) if (/^[67]/.test(c)) delete tras[c];
  tras['129'] = r2((tras['129'] || 0) + resultado);
  const cie = Object.entries(tras).filter(([, v]) => Math.abs(v) >= 0.005).sort().map(([c, v]) => lin(c, v));
  const ape = cie.map((l) => ({ cuenta: l.cuenta, debe: l.haber, haber: l.debe }));
  return {
    resultado: r2(-resultado),
    reg: { referencia: `REG-${anio}`, fecha: `${anio}-12-31`, concepto: `Regularización del ejercicio ${anio} (gastos e ingresos a resultados)`, lineas: reg },
    cie: { referencia: `CIE-${anio}`, fecha: `${anio}-12-31`, concepto: `Asiento de cierre del ejercicio ${anio}`, lineas: cie },
    ape: { referencia: `APE-${anio + 1}`, fecha: `${anio + 1}-01-01`, concepto: `Asiento de apertura del ejercicio ${anio + 1}`, lineas: ape },
  };
}

/**
 * Cuentas anuales abreviadas (modelos del Registro Mercantil) a partir de los saldos acumulados a una fecha.
 * Cada cuenta va al activo o al pasivo según su saldo (p. ej. la tarjeta 5201 con saldo deudor es un activo),
 * así el balance cuadra siempre que la contabilidad cuadre; si no, «descuadre» dice cuánto falta.
 */
export function cuentasAnuales(saldosAcum, saldosAnio) {
  const b = { intangible: 0, material: 0, financieroLP: 0, existencias: 0, clientes: 0, otrosDeudores: 0, efectivo: 0,
    capital: 0, reservas: 0, anteriores: 0, resultado: 0, subvenciones: 0, deudasLP: 0, deudasCP: 0, proveedores: 0, otrosAcreedores: 0 };
  const add = (k, v) => { b[k] = r2(b[k] + v); };
  for (const [c, v] of Object.entries(saldosAcum)) {
    if (Math.abs(v) < 0.005) continue;
    if (/^[67]/.test(c)) { add('resultado', -v); continue; }
    if (/^20|^280/.test(c)) { add('intangible', v); continue; }
    if (/^2[1-3]|^28[1-2]/.test(c)) { add('material', v); continue; }
    if (/^2/.test(c)) { add('financieroLP', v); continue; }
    if (/^3/.test(c)) { add('existencias', v); continue; }
    if (/^10/.test(c)) { add('capital', -v); continue; }
    if (/^11/.test(c)) { add('reservas', -v); continue; }
    if (/^12[01]/.test(c)) { add('anteriores', -v); continue; }
    if (c === '129') { add('resultado', -v); continue; }
    if (/^13/.test(c)) { add('subvenciones', -v); continue; }
    if (/^1/.test(c)) { add('deudasLP', -v); continue; }
    if (/^57/.test(c) && c !== '5721') { if (v > 0) add('efectivo', v); else add('deudasCP', -v); continue; }
    if (v > 0) add(/^43/.test(c) ? 'clientes' : 'otrosDeudores', v);
    else add(/^40/.test(c) ? 'proveedores' : /^5/.test(c) ? 'deudasCP' : 'otrosAcreedores', -v);
  }
  const activoNC = r2(b.intangible + b.material + b.financieroLP);
  const activoC = r2(b.existencias + b.clientes + b.otrosDeudores + b.efectivo);
  const fondosPropios = r2(b.capital + b.reservas + b.anteriores + b.resultado);
  const pasivoC = r2(b.deudasCP + b.proveedores + b.otrosAcreedores);
  const sumaActivo = r2(activoNC + activoC);
  const sumaPNP = r2(fondosPropios + b.subvenciones + b.deudasLP + pasivoC);
  const a = saldosAnio, ing = (re) => r2(-sumaCuentas(a, (c) => re.test(c)));
  const pyg = {
    cifraNegocios: ing(/^70/), aprovisionamientos: ing(/^6[01]/), otrosIngresos: ing(/^7[45]/), personal: ing(/^64/),
    otrosGastos: ing(/^6[25]|^63[1-4]/), amortizacion: ing(/^68/), otrosResultados: r2(ing(/^7[7-9]/) + ing(/^67/)),
  };
  pyg.explotacion = r2(pyg.cifraNegocios + pyg.aprovisionamientos + pyg.otrosIngresos + pyg.personal + pyg.otrosGastos + pyg.amortizacion + pyg.otrosResultados);
  pyg.ingresosFinancieros = ing(/^76/); pyg.gastosFinancieros = ing(/^66/);
  pyg.financiero = r2(pyg.ingresosFinancieros + pyg.gastosFinancieros);
  pyg.antesImpuestos = r2(pyg.explotacion + pyg.financiero);
  pyg.impuesto = ing(/^630/);
  pyg.resultado = r2(pyg.antesImpuestos + pyg.impuesto);
  return {
    balance: {
      activoNC: { total: activoNC, intangible: b.intangible, material: b.material, financieroLP: b.financieroLP },
      activoC: { total: activoC, existencias: b.existencias, clientes: b.clientes, otrosDeudores: b.otrosDeudores, efectivo: b.efectivo },
      sumaActivo,
      patrimonio: { total: r2(fondosPropios + b.subvenciones), fondosPropios, capital: b.capital, reservas: b.reservas, anteriores: b.anteriores, resultado: b.resultado, subvenciones: b.subvenciones },
      pasivoNC: { total: b.deudasLP, deudasLP: b.deudasLP },
      pasivoC: { total: pasivoC, deudasCP: b.deudasCP, proveedores: b.proveedores, otrosAcreedores: b.otrosAcreedores },
      sumaPNP, descuadre: r2(sumaActivo - sumaPNP), resultadoAnio: resultadoContable(saldosAnio),
    },
    pyg,
  };
}

/** Asientos que no cuadran (debe ≠ haber) */
export function asientosDescuadrados(asientos, lineas) {
  const s = {};
  for (const l of lineas) s[l.asiento_id] = r2((s[l.asiento_id] || 0) + (Number(l.debe) || 0) - (Number(l.haber) || 0));
  return asientos.filter((a) => Math.abs(s[a.id] || 0) >= 0.01).map((a) => ({ ...a, diferencia: s[a.id] }));
}

/** Calendario de obligaciones de un año (fiscales y mercantiles) */
export function calendarioObligaciones(anio, mensualDesde = '') {
  const out = [];
  for (const p of periodosIVA(anio, mensualDesde)) out.push({ fecha: p.plazo, modelo: '303', texto: `IVA ${p.label}`, periodo: p.clave });
  for (const p of periodosRetenciones(anio)) out.push({ fecha: p.plazo, modelo: '111 · 115', texto: `Retenciones ${p.label} (profesionales y alquiler)`, periodo: p.clave });
  // V127: con el SII todo el año (IVA mensual desde enero) no se presentan el 390 ni el 347
  const siiTodoElAnio = !!mensualDesde && mensualDesde <= `${anio}-01`;
  if (!siiTodoElAnio) out.push({ fecha: `${anio + 1}-01-30`, modelo: '390', texto: `Resumen anual de IVA ${anio}` });
  out.push({ fecha: `${anio + 1}-01-31`, modelo: '180 · 190', texto: `Resúmenes anuales de retenciones ${anio}` });
  if (!siiTodoElAnio) out.push({ fecha: `${anio + 1}-02-28`, modelo: '347', texto: `Operaciones con terceros de ${anio} (más de 3.005,06 €)` });
  out.push({ fecha: `${anio + 1}-03-31`, modelo: 'Cuentas', texto: `Formular las cuentas anuales de ${anio} (el administrador)` });
  out.push({ fecha: `${anio + 1}-04-30`, modelo: 'Registro', texto: `Legalizar los libros de ${anio} en el Registro Mercantil (diario, inventarios y cuentas anuales, actas y socios)` });
  out.push({ fecha: `${anio + 1}-06-30`, modelo: 'Junta', texto: `Junta general: aprobar las cuentas de ${anio} y el reparto del resultado` });
  out.push({ fecha: `${anio + 1}-07-25`, modelo: '200', texto: `Impuesto sobre Sociedades ${anio}` });
  out.push({ fecha: `${anio + 1}-07-30`, modelo: 'Depósito', texto: `Depositar las cuentas de ${anio} en el Registro Mercantil (1 mes desde la junta)` });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
