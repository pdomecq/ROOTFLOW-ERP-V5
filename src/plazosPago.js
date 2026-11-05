// V99: vencimiento de las facturas de venta. Los microbrotes son productos frescos y perecederos: el plazo de
// pago NO puede pasar de 30 días desde la ENTREGA de la mercancía (Ley 3/2004 art. 4, en la redacción de la
// Ley 15/2010, y Ley 12/2013 de la cadena alimentaria art. 14 bis). Rootflow cobra a 15 días por defecto.
// Si la factura agrupa varias entregas (semanal, quincenal o mensual), manda la primera entrega: la factura
// tiene que vencer como tarde 30 días después de ella, aunque eso deje menos de 15 días desde la factura.

export const PLAZO_PAGO_DEFECTO = 15;
export const PLAZO_MAX_PERECEDEROS = 30;

const iso = (x) => (x ? String(x).slice(0, 10) : null);
const sumarDias = (f, d) => { const t = new Date(`${f}T12:00:00Z`); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };

// Días de plazo de un cliente (su ficha, sin pasar del máximo legal)
export const plazoCliente = (cliente) => {
  const n = parseInt(cliente?.plazo_pago_dias, 10);
  return Math.min(PLAZO_MAX_PERECEDEROS, n > 0 ? n : PLAZO_PAGO_DEFECTO);
};

/**
 * Fecha de vencimiento (AAAA-MM-DD).
 * fechaFactura: fecha de emisión · cliente: su ficha · primeraEntrega: fecha de la entrega más antigua que
 * incluye la factura (o la entrega prevista si se factura antes de entregar).
 */
export function fechaVencimientoFactura(fechaFactura, cliente, primeraEntrega = null) {
  const f = iso(fechaFactura) || new Date().toISOString().slice(0, 10);
  let v = sumarDias(f, plazoCliente(cliente));
  const e = iso(primeraEntrega);
  if (e) {
    const limite = sumarDias(e, PLAZO_MAX_PERECEDEROS);
    if (limite < v) v = limite;
  }
  return v < f ? f : v; // nunca antes de la propia factura
}
