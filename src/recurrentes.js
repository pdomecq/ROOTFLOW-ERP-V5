// V90: calendario de entregas de los pedidos recurrentes (cálculo puro, sin React ni Supabase).
// Un recurrente entrega un día de la semana fijo (dia_semana = Date.getDay(): 0 domingo … 6 sábado)
// cada 1, 2 o 4 semanas desde su primera entrega (fecha_inicio), hasta fecha_fin si la tiene.
// proxima_ejecucion = la próxima entrega que falta por generar. El pedido de cada entrega se genera
// dias_antelacion días antes (para preparar y repartir); la planificación de siembras ya mira los
// recurrentes directamente, así que no hace falta generarlos con más antelación.

export const FRECUENCIAS_RECURRENTE = {
  semanal: { label: 'Cada semana', dias: 7 },
  quincenal: { label: 'Cada 2 semanas', dias: 14 },
  mensual: { label: 'Cada 4 semanas', dias: 28 },
};
export const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const aFecha = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
const aISO = (d) => d.toISOString().slice(0, 10);
export const sumarDias = (iso, n) => { const d = aFecha(iso); d.setUTCDate(d.getUTCDate() + n); return aISO(d); };
export const diaDeSemana = (iso) => aFecha(iso).getUTCDay();
export const pasoDias = (frecuencia) => FRECUENCIAS_RECURRENTE[frecuencia]?.dias || 7;

// Primera fecha ≥ desde que cae en ese día de la semana
export function primeraEntrega(diaSemana, desde) {
  let d = String(desde).slice(0, 10);
  for (let i = 0; i < 7 && diaDeSemana(d) !== Number(diaSemana); i++) d = sumarDias(d, 1);
  return d;
}

// Próxima entrega a partir de hoy siguiendo el ritmo del recurrente (sin saltarse el ciclo quincenal/mensual)
export function proximaEntregaDesde(pr, hoy) {
  const paso = pasoDias(pr.frecuencia);
  let d = pr.proxima_ejecucion || pr.fecha_inicio || primeraEntrega(pr.dia_semana, hoy);
  d = String(d).slice(0, 10);
  if (diaDeSemana(d) !== Number(pr.dia_semana)) d = primeraEntrega(pr.dia_semana, d);
  while (d < hoy) d = sumarDias(d, paso);
  return d;
}

/**
 * Entregas cuyo pedido toca generar ya.
 * @returns { fechas: ['AAAA-MM-DD'], nuevaProxima, terminado }
 *   fechas: entregas entre hoy y hoy + dias_antelacion (y ≤ fecha_fin); nuevaProxima: la siguiente que queda
 *   pendiente; terminado: ya no quedan entregas (pasó fecha_fin).
 */
export function entregasAGenerar(pr, hoy, { forzarSiguiente = false } = {}) {
  const paso = pasoDias(pr.frecuencia);
  const antelacion = Math.max(0, Number(pr.dias_antelacion ?? 2));
  const fin = pr.fecha_fin ? String(pr.fecha_fin).slice(0, 10) : null;
  const limite = sumarDias(hoy, antelacion);
  let d = proximaEntregaDesde(pr, hoy);
  const fechas = [];
  while ((d <= limite || (forzarSiguiente && !fechas.length)) && (!fin || d <= fin) && fechas.length < 10) {
    fechas.push(d);
    d = sumarDias(d, paso);
  }
  return { fechas, nuevaProxima: d, terminado: !!fin && d > fin };
}

// Próximas n entregas (para enseñarlas en pantalla y para la planificación)
export function proximasEntregas(pr, hoy, n = 4) {
  const paso = pasoDias(pr.frecuencia);
  const fin = pr.fecha_fin ? String(pr.fecha_fin).slice(0, 10) : null;
  const out = [];
  let d = proximaEntregaDesde(pr, hoy);
  while (out.length < n && (!fin || d <= fin)) { out.push(d); d = sumarDias(d, paso); }
  return out;
}
