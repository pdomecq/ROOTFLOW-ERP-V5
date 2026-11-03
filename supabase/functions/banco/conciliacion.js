// V91: conciliación de los movimientos del banco con las facturas emitidas (cálculo puro, sin Supabase).
// La usa la Edge Function `banco` (Deno) y se prueba en Node con datos reales.
//
// Para cada ingreso todavía sin conciliar decide:
//   'auto'       → se marca la factura como cobrada (fecha de cobro = fecha valor) con su asiento 572/430
//   'ya_cobrada' → la factura ya estaba cobrada en el ERP: solo se enlaza (y se corrige la fecha de cobro)
//   'sugerido'   → hay candidata pero no es seguro (importe distinto, pago con tarjeta, solo coincide el importe):
//                  se confirma con un clic en el ERP
//   'otro'       → no es un cobro de cliente (aportación de socio, traspaso de la tarjeta, bonificación…)
//   'sin_casar'  → ingreso sin factura candidata
// Seguro = el concepto trae el número de factura y el importe cuadra, o el pagador es el cliente
// (por nombre o por un alias aprendido al confirmar a mano) y el importe cuadra con una o varias de sus facturas.

const r2 = (x) => Math.round((parseFloat(x) || 0) * 100) / 100;
const iguales = (a, b) => Math.abs(r2(a) - r2(b)) <= 0.01;
const dias = (a, b) => Math.round((Date.parse(`${String(a).slice(0, 10)}T12:00:00Z`) - Date.parse(`${String(b).slice(0, 10)}T12:00:00Z`)) / 86400000);

export const ESTADOS_PENDIENTE = ['pendiente', 'vencida'];
const esFacturaDeVenta = (f) => f && f.tipo !== 'anulada' && f.tipo !== 'rectificativa' && !/^R-/.test(String(f.id)) && r2(f.total) > 0;

// Ingresos que no son cobros de clientes (STRIPE = transferencia semanal de Stripe: esos cobros ya se casan por el webhook)
const RE_OTRO = /STRIPE|APORTACI|FONDOS PROPIOS|TRASPASO DESDE TARJ|ABO\.? POR TRASPASO|CASHBACK|PROMOCI[OÓ]N COMERCIAL|ANULACI[OÓ]N ADEUDO|BONIF/;
const RE_TPV = /REMESA DE COMERCIOS|LIQUIDACI[OÓ]N REMESA|TPV/;

export const normalizar = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const SOBRA = new Set(['SL', 'SLL', 'SLU', 'SA', 'S', 'L', 'U', 'SC', 'SCA', 'CB', 'DE', 'DEL', 'LA', 'LAS', 'EL', 'LOS', 'Y', 'E', 'SOCIEDAD', 'LIMITADA', 'TRANSFERENCIAS', 'TRANSFERENCIA', 'RECIBIDA', 'EUROS']);
export const tokens = (t) => normalizar(t).split(' ').filter((w) => w.length >= 3 && !SOBRA.has(w));

// Números de factura en el concepto: "F-2026-0015", "Fact n. F2026-0014", "FACTURA 10", "factura F-2026-0009"
export function referenciasFactura(concepto, anioMov) {
  const t = normalizar(concepto).replace(/ /g, ' ');
  const out = [];
  const conAnio = /\bF\s?(20\d{2})\s?0*(\d{1,4})\b/g; // tras normalizar, "F-2026-0015" → "F 2026 0015"
  let m;
  while ((m = conAnio.exec(t))) out.push({ anio: Number(m[1]), n: Number(m[2]) });
  if (!out.length) {
    const sinAnio = /\bFACT(?:URA)?\s+(?:N[Oº]?\s+)?0*(\d{1,4})\b/g;
    while ((m = sinAnio.exec(t))) out.push({ anio: null, n: Number(m[1]) });
  }
  return out.map((r) => ({ ...r, anio: r.anio || anioMov }));
}
const idFactura = (anio, n) => `F-${anio}-${String(n).padStart(4, '0')}`;

// ¿El pagador es este cliente? 'alias' (aprendido), 'fuerte' (nombre), 'debil' (comparten una palabra)
export function coincidenciaCliente(contraparte, cliente, alias = []) {
  const c = normalizar(contraparte);
  if (!c) return null;
  if (alias.some((a) => a.cliente_id === cliente.id && normalizar(a.contraparte) === c)) return 'alias';
  const tc = new Set(tokens(contraparte));
  const tn = tokens(cliente.nombre);
  if (!tn.length) return null;
  const comunes = tn.filter((w) => tc.has(w)).length;
  if (comunes === tn.length || (comunes >= 2 && comunes >= tn.length - 1)) return 'fuerte';
  const cif = normalizar(cliente.cif).replace(/ /g, '');
  if (cif.length >= 8 && normalizar(contraparte).replace(/ /g, '').includes(cif)) return 'fuerte';
  return comunes >= 1 ? 'debil' : null;
}

// Subconjunto de facturas (las más antiguas primero) que suma exactamente el importe; null si no hay o hay varios
function subconjuntoExacto(facturas, importe) {
  const lista = facturas.slice(0, 8);
  const soluciones = [];
  for (let mask = 1; mask < 1 << lista.length; mask++) {
    const sel = lista.filter((_, i) => mask & (1 << i));
    if (iguales(sel.reduce((s, f) => s + r2(f.total), 0), importe)) soluciones.push(sel);
    if (soluciones.length > 1) break;
  }
  if (soluciones.length === 1) return soluciones[0];
  // Varias soluciones con el mismo importe (p. ej. 3 facturas de 62,40 €): se cobran las más antiguas
  if (soluciones.length > 1 && facturas.every((f) => iguales(f.total, facturas[0].total))) {
    const k = Math.round(r2(importe) / r2(facturas[0].total));
    if (k >= 1 && k <= facturas.length && iguales(k * r2(facturas[0].total), importe)) return facturas.slice(0, k);
  }
  return null;
}

/**
 * @param movimientos [{ id, fecha, fecha_valor, importe, concepto, contraparte, estado, factura_ids }]
 * @param facturas    [{ id, cliente_id, fecha, total, estado, tipo, fecha_cobro }]
 * @param clientes    [{ id, nombre, cif }]
 * @param alias       [{ contraparte, cliente_id }]
 * @returns [{ movimiento_id, decision, factura_ids, cliente_id, motivo, fecha_cobro, corregir_fecha }]
 *   corregir_fecha: la factura ya estaba cobrada y el banco demuestra la fecha real del cobro
 */
export function conciliar(movimientos, facturas, clientes, alias = []) {
  const ventas = (facturas || []).filter(esFacturaDeVenta).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || String(a.id).localeCompare(String(b.id)));
  const porId = new Map(ventas.map((f) => [f.id, f]));
  // Facturas ya enlazadas a un movimiento conciliado: no se vuelven a usar
  const usadas = new Set();
  for (const m of movimientos || []) if (['conciliado', 'ya_cobrada'].includes(m.estado)) (m.factura_ids || []).forEach((id) => usadas.add(id));
  const libres = (filtro) => ventas.filter((f) => !usadas.has(f.id) && filtro(f));
  const out = [];
  const pendientesMov = (movimientos || [])
    .filter((m) => r2(m.importe) > 0 && (!m.estado || ['pendiente', 'sin_casar', 'sugerido'].includes(m.estado)))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || r2(a.importe) - r2(b.importe));

  for (const m of pendientesMov) {
    const fecha = String(m.fecha_valor || m.fecha).slice(0, 10);
    const texto = `${m.concepto || ''} ${m.contraparte || ''}`;
    const nt = normalizar(texto);
    const decidir = (decision, fs, motivo, extra = {}) => {
      if (['auto', 'ya_cobrada'].includes(decision)) fs.forEach((f) => usadas.add(f.id));
      out.push({ movimiento_id: m.id, decision, factura_ids: fs.map((f) => f.id), cliente_id: fs[0]?.cliente_id ?? extra.cliente_id ?? null, motivo, fecha_cobro: fecha, corregir_fecha: !!extra.corregirFecha });
    };
    if (RE_OTRO.test(nt)) { decidir('otro', [], 'No es un cobro de cliente (aportación, traspaso, bonificación…)'); continue; }
    const emitidaAntes = (f) => String(f.fecha) <= fecha;

    // 1) Número de factura en el concepto
    const refs = referenciasFactura(texto, Number(fecha.slice(0, 4)));
    const porRef = [];
    for (const r of refs) {
      let f = porId.get(idFactura(r.anio, r.n));
      if (!f && refs.length && !/F\s?20\d{2}/.test(nt)) f = porId.get(idFactura(r.anio - 1, r.n)); // "FACTURA 10" de diciembre cobrada en enero
      if (f && !usadas.has(f.id) && !porRef.includes(f)) porRef.push(f);
    }
    if (porRef.length) {
      const suma = porRef.reduce((s, f) => s + r2(f.total), 0);
      if (iguales(suma, m.importe)) {
        const pend = porRef.filter((f) => ESTADOS_PENDIENTE.includes(f.estado));
        if (pend.length === porRef.length) { decidir('auto', porRef, `El concepto dice ${porRef.map((f) => f.id).join(', ')} y el importe cuadra`); continue; }
        if (!pend.length) { decidir('ya_cobrada', porRef, `${porRef.map((f) => f.id).join(', ')} ya estaba cobrada en el ERP`, { corregirFecha: true }); continue; }
      }
      decidir('sugerido', porRef, `El concepto dice ${porRef.map((f) => f.id).join(', ')} (${r2(suma)} €) pero el ingreso es de ${r2(m.importe)} €`);
      continue;
    }

    // 2) El pagador es un cliente
    const conNivel = (clientes || []).map((c) => ({ c, nivel: coincidenciaCliente(`${m.contraparte || ''} ${m.concepto || ''}`, c, alias) })).filter((x) => x.nivel);
    const fuertes = conNivel.filter((x) => x.nivel !== 'debil');
    if (fuertes.length === 1) {
      const cli = fuertes[0].c;
      const pend = libres((f) => f.cliente_id === cli.id && ESTADOS_PENDIENTE.includes(f.estado) && emitidaAntes(f));
      const sel = subconjuntoExacto(pend, m.importe);
      if (sel) { decidir('auto', sel, `Pago de ${cli.nombre} por el importe de ${sel.map((f) => f.id).join(', ')}`); continue; }
      const cobradas = libres((f) => f.cliente_id === cli.id && f.estado === 'pagada' && iguales(f.total, m.importe) && (!f.fecha_cobro || Math.abs(dias(f.fecha_cobro, fecha)) <= 90));
      if (cobradas.length) { decidir('ya_cobrada', [cobradas[0]], `Pago de ${cli.nombre}: ${cobradas[0].id} ya estaba cobrada en el ERP`, { corregirFecha: true }); continue; }
      decidir('sugerido', pend.slice(0, 5), pend.length ? `Pago de ${cli.nombre} que no cuadra con sus facturas pendientes` : `Pago de ${cli.nombre} sin facturas pendientes`, { cliente_id: cli.id });
      continue;
    }

    // 3) Solo el importe (pagos con tarjeta o pagador desconocido)
    const exactasPend = libres((f) => ESTADOS_PENDIENTE.includes(f.estado) && iguales(f.total, m.importe) && emitidaAntes(f) && dias(fecha, f.fecha) <= 120);
    const exactasCobradas = libres((f) => f.estado === 'pagada' && iguales(f.total, m.importe) && f.fecha_cobro && Math.abs(dias(f.fecha_cobro, fecha)) <= 10);
    const cobradaEseDia = exactasCobradas.filter((f) => Math.abs(dias(f.fecha_cobro, fecha)) <= 3);
    if (cobradaEseDia.length === 1) { decidir('ya_cobrada', cobradaEseDia, `Mismo importe que ${cobradaEseDia[0].id}, cobrada en el ERP el ${cobradaEseDia[0].fecha_cobro}`); continue; }
    if (exactasCobradas.length === 1 && !exactasPend.length) { decidir('ya_cobrada', exactasCobradas, `Mismo importe que ${exactasCobradas[0].id}, cobrada en el ERP el ${exactasCobradas[0].fecha_cobro}`); continue; }
    const debiles = new Set(conNivel.map((x) => x.c.id));
    const candidatas = [...exactasPend].sort((a, b) => (debiles.has(b.cliente_id) ? 1 : 0) - (debiles.has(a.cliente_id) ? 1 : 0));
    if (candidatas.length) {
      const clientesDistintos = new Set(candidatas.map((f) => f.cliente_id)).size;
      decidir('sugerido', candidatas.slice(0, 5), `${RE_TPV.test(nt) ? 'Pago con tarjeta' : 'Ingreso'} del mismo importe que ${candidatas.length === 1 ? candidatas[0].id : `${candidatas.length} facturas${clientesDistintos > 1 ? ' de varios clientes' : ''}`}`);
      continue;
    }
    decidir('sin_casar', [], RE_TPV.test(nt) ? 'Pago con tarjeta sin factura del mismo importe (¿venta sin factura?)' : 'Ingreso sin factura candidata');
  }
  return out;
}

// Huella para no meter dos veces el mismo movimiento (al sincronizar y al subir el extracto)
export const claveMovimiento = (m) => `${String(m.fecha).slice(0, 10)}|${r2(m.importe).toFixed(2)}`;
// De los movimientos nuevos, los que no estaban ya: por cada fecha+importe solo entran los que sobran
export function movimientosNuevos(existentes, entrantes) {
  const cuenta = {};
  (existentes || []).forEach((m) => { const k = claveMovimiento(m); cuenta[k] = (cuenta[k] || 0) + 1; });
  const vistos = {};
  return (entrantes || []).filter((m) => {
    const k = claveMovimiento(m);
    vistos[k] = (vistos[k] || 0) + 1;
    return vistos[k] > (cuenta[k] || 0);
  });
}
