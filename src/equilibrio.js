// V118: punto de equilibrio (cálculo puro, sin React ni Supabase) para poder probarlo en Node.
// Con el ritmo real de los últimos meses (ventas y kg entregados, costes de Rentabilidad) dice cuántos kg al mes
// hay que vender para no perder dinero, cuántos para pagar sueldos a los socios, cuánto rinde cada bandeja y
// qué pasaría a distintos volúmenes.
//  · ventanaEquilibrio(hoy, meses): los N meses cerrados antes del mes de hoy.
//  · calcularEquilibrio(d): todas las cifras del panel.

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function ventanaEquilibrio(hoy, meses = 3) {
  const [y, m] = String(hoy).slice(0, 10).split('-').map(Number);
  const ini = new Date(Date.UTC(y, m - 1 - meses, 1));
  const fin = new Date(Date.UTC(y, m - 1, 0));
  return { desde: ini.toISOString().slice(0, 10), hasta: fin.toISOString().slice(0, 10), meses };
}

/**
 * d: { meses, ventas (base sin IVA de lo entregado), kg (vendidos, sin entregas gratis), materiales, variables, estructura,
 *      bandejas (sembradas en la ventana), sueldoSocio, socios, objetivoG (g por bandeja), topCliente: { nombre, ventas } }
 */
export function calcularEquilibrio(d) {
  const meses = Math.max(1, Number(d.meses) || 1);
  const ventas = Number(d.ventas) || 0, kg = Number(d.kg) || 0;
  const ventasMes = ventas / meses, kgMes = kg / meses;
  const eurKg = kg > 0 ? ventas / kg : null;
  const varKg = kg > 0 ? ((Number(d.materiales) || 0) + (Number(d.variables) || 0)) / kg : null;
  const contribKg = eurKg != null ? eurKg - varKg : null;
  const contribPct = eurKg ? contribKg / eurKg : null;
  const fijosMes = (Number(d.estructura) || 0) / meses;
  const sueldosMes = (Number(d.socios) || 0) * (Number(d.sueldoSocio) || 0);
  const ok = contribKg != null && contribKg > 0;
  const kgEq = ok ? fijosMes / contribKg : null;
  const kgEqSueldos = ok ? (fijosMes + sueldosMes) / contribKg : null;
  const ebitdaMes = ok ? kgMes * contribKg - fijosMes : (ventasMes - fijosMes - ((Number(d.materiales) || 0) + (Number(d.variables) || 0)) / meses);
  const bandejas = Number(d.bandejas) || 0;
  const bandejasMes = bandejas / meses;
  const gBandeja = bandejas > 0 && kg > 0 ? (kg * 1000) / bandejas : null;
  const objetivoG = Number(d.objetivoG) || 250;
  const kgConObjetivo = bandejasMes > 0 ? (bandejasMes * objetivoG) / 1000 : null;
  // Kilos de más con las mismas bandejas: la semilla y el sustrato ya están pagados, así que suman casi todo su precio
  const extraObjetivo = eurKg != null && kgConObjetivo != null && kgConObjetivo > kgMes ? (kgConObjetivo - kgMes) * eurKg : 0;
  const gParaBandejas = gBandeja && gBandeja > 0 ? gBandeja : objetivoG;
  const escenario = (k, etiqueta) => ({
    etiqueta, kg: r2(k), ventas: eurKg != null ? r2(k * eurKg) : null,
    ebitda: ok ? r2(k * contribKg - fijosMes) : null,
    trasSueldos: ok ? r2(k * contribKg - fijosMes - sueldosMes) : null,
    bandejasMes: Math.ceil((k * 1000) / gParaBandejas),
  });
  const escenarios = [];
  if (kgMes > 0) escenarios.push(escenario(kgMes, 'Ahora'));
  if (kgEq != null) escenarios.push(escenario(kgEq, 'Sin pérdidas'));
  for (const k of [50, 100]) if (!escenarios.some((e) => Math.abs(e.kg - k) < 5)) escenarios.push(escenario(k, `${k} kg`));
  if (kgEqSueldos != null && sueldosMes > 0) escenarios.push(escenario(kgEqSueldos, 'Con sueldos'));
  escenarios.sort((a, b) => a.kg - b.kg);
  const top = d.topCliente && ventas > 0 ? { nombre: d.topCliente.nombre, pct: (Number(d.topCliente.ventas) || 0) / ventas } : null;
  return {
    meses, ventasMes: r2(ventasMes), kgMes: r2(kgMes), eurKg: eurKg != null ? r2(eurKg) : null, varKg: varKg != null ? r2(varKg) : null,
    contribKg: contribKg != null ? r2(contribKg) : null, contribPct, fijosMes: r2(fijosMes), sueldosMes: r2(sueldosMes),
    kgEq: kgEq != null ? r2(kgEq) : null, ventasEq: kgEq != null ? r2(kgEq * eurKg) : null,
    kgEqSueldos: kgEqSueldos != null ? r2(kgEqSueldos) : null, ventasEqSueldos: kgEqSueldos != null ? r2(kgEqSueldos * eurKg) : null,
    progreso: kgEq ? kgMes / kgEq : null, progresoSueldos: kgEqSueldos ? kgMes / kgEqSueldos : null,
    ebitdaMes: r2(ebitdaMes), margenNegativo: contribKg != null && contribKg <= 0,
    bandejasMes: r2(bandejasMes), gBandeja: gBandeja != null ? Math.round(gBandeja) : null, objetivoG,
    kgConObjetivo: kgConObjetivo != null ? r2(kgConObjetivo) : null, extraObjetivo: r2(extraObjetivo),
    escenarios, top,
  };
}
