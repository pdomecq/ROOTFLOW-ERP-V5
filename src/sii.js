// V127: SII (Suministro Inmediato de Información del IVA). Cálculo puro, sin React ni Supabase, para probarlo en Node.
// Con el IVA mensual (REDEME) hay que mandar a la AEAT cada factura emitida y recibida en 4 días hábiles.
//  · plazoSII(): último día para enviar una factura (4 días hábiles, sin sábados, domingos ni festivos nacionales,
//    y nunca después del día 15 del mes siguiente).
//  · registroEmitida() / registroRecibida(): datos de cada factura en el formato del SII, desde las filas de los
//    libros de IVA de fiscal.js. Devuelven { registro, errores } (sin errores = se puede enviar).
//  · xmlEmitidas() / xmlRecibidas(): el mensaje SOAP (SuministroLR, versión 1.1) para un lote de facturas.
//  · leerRespuesta(): estado de cada factura en la respuesta de la AEAT (Correcto, AceptadoConErrores, Incorrecto).
// Esquemas: https://www.agenciatributaria.es → SII → Información técnica (SuministroLR.xsd y SuministroInformacion.xsd).

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pad = (n) => String(n).padStart(2, '0');
const dia = (f) => String(f || '').slice(0, 10);
export const VERSION_SII = '1.1';
const NS_LR = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/ssii/fact/ws/SuministroLR.xsd';
const NS_SII = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/ssii/fact/ws/SuministroInformacion.xsd';
export const ENDPOINTS_SII = {
  pruebas: { emitidas: 'https://prewww1.aeat.es/wlpl/SSII-FACT/ws/fe/SiiFactFEV1SOAP', recibidas: 'https://prewww1.aeat.es/wlpl/SSII-FACT/ws/fr/SiiFactFRV1SOAP' },
  produccion: { emitidas: 'https://www1.agenciatributaria.gob.es/wlpl/SSII-FACT/ws/fe/SiiFactFEV1SOAP', recibidas: 'https://www1.agenciatributaria.gob.es/wlpl/SSII-FACT/ws/fr/SiiFactFRV1SOAP' },
};

// ==================== PLAZOS ====================
// Festivos nacionales (los autonómicos y locales no cuentan para el SII)
const FESTIVOS = new Set([
  '2026-01-01', '2026-01-06', '2026-04-03', '2026-05-01', '2026-08-15', '2026-10-12', '2026-11-01', '2026-12-06', '2026-12-08', '2026-12-25',
  '2027-01-01', '2027-01-06', '2027-03-26', '2027-05-01', '2027-08-15', '2027-10-12', '2027-11-01', '2027-12-06', '2027-12-08', '2027-12-25',
  '2028-01-01', '2028-01-06', '2028-04-14', '2028-05-01', '2028-08-15', '2028-10-12', '2028-11-01', '2028-12-06', '2028-12-08', '2028-12-25',
]);
const esHabil = (iso) => { const d = new Date(`${iso}T12:00:00Z`).getUTCDay(); return d !== 0 && d !== 6 && !FESTIVOS.has(iso); };
const masDias = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Último día para enviar: 4 días hábiles desde la fecha (expedición o registro), y como tarde el día 15 del mes siguiente */
export function plazoSII(fecha) {
  let f = dia(fecha), n = 0;
  while (n < 4) { f = masDias(f, 1); if (esHabil(f)) n++; }
  const [y, m] = dia(fecha).split('-').map(Number);
  const tope = m === 12 ? `${y + 1}-01-15` : `${y}-${pad(m + 1)}-15`;
  return f < tope ? f : tope;
}

// ==================== REGISTROS ====================
const fechaSII = (iso) => { const [y, m, d] = dia(iso).split('-'); return `${d}-${m}-${y}`; };
const limpiaNif = (x) => String(x || '').toUpperCase().replace(/[\s.\-]/g, '');
const PAISES_UE = /^(AT|BE|BG|CY|CZ|DE|DK|EE|EL|GR|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)/;
/** NIF español (DNI, NIE o CIF) con la letra de control correcta */
export function nifValido(nif) {
  const x = limpiaNif(nif).replace(/^ES/, '');
  if (/^[0-9]{8}[A-Z]$/.test(x)) return 'TRWAGMYFPDXBNJZSQVHLCKE'[Number(x.slice(0, 8)) % 23] === x[8];
  if (/^[XYZ][0-9]{7}[A-Z]$/.test(x)) return 'TRWAGMYFPDXBNJZSQVHLCKE'[Number('XYZ'.indexOf(x[0]) + x.slice(1, 8)) % 23] === x[8];
  if (/^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(x)) {
    const dig = x.slice(1, 8).split('').map(Number);
    let suma = 0;
    dig.forEach((d, i) => { if (i % 2 === 0) { const t = d * 2; suma += Math.floor(t / 10) + (t % 10); } else suma += d; });
    const control = (10 - (suma % 10)) % 10;
    return x[8] === String(control) || x[8] === 'JABCDEFGHI'[control];
  }
  return false;
}
/** Identificación de la otra parte: NIF español o, si es de otro país, IDOtro (02 = NIF-IVA comunitario) */
export function idContraparte(nif) {
  const x = limpiaNif(nif);
  if (!x) return null;
  if (PAISES_UE.test(x)) return { otro: { pais: x.slice(0, 2) === 'EL' ? 'GR' : x.slice(0, 2), tipo: '02', id: x } };
  return { nif: x.replace(/^ES/, '') };
}
const periodoDe = (fecha) => ({ ejercicio: dia(fecha).slice(0, 4), periodo: dia(fecha).slice(5, 7) });

/**
 * Factura emitida (fila de libroExpedidas). titular = { nif, nombre }.
 * F1 completa · F2 simplificada (ticket) · R1 rectificativa por diferencias (importes negativos)
 */
export function registroEmitida(f, titular) {
  const errores = [];
  const cp = f.tipoFactura === 'F2' ? null : idContraparte(f.nif);
  if (f.tipoFactura !== 'F2') {
    if (!cp) errores.push(`Falta el NIF del cliente ${f.cliente}`);
    else if (cp.nif && !nifValido(cp.nif)) errores.push(`El NIF del cliente ${f.cliente} (${cp.nif}) no es válido`);
  }
  if (!f.numero) errores.push('Falta el número de factura');
  const desglose = [{ tipo: f.tipo, base: r2(f.base), cuota: r2(f.cuota), ...(f.reCuota ? { reTipo: f.reTipo, reCuota: r2(f.reCuota) } : {}) }];
  const registro = {
    libro: 'emitidas', ...periodoDe(f.fecha),
    numero: String(f.numero), fecha: f.fecha, tipoFactura: f.tipoFactura,
    rectificada: f.tipoFactura === 'R1' ? (f.rectifica ? { numero: f.rectifica, fecha: f.fechaRectificada || null } : null) : null,
    total: r2(f.total), descripcion: f.tipoFactura === 'F2' ? 'Venta directa de microbrotes' : 'Venta de microbrotes',
    contraparte: cp ? { nombre: f.cliente, ...cp } : null, desglose,
  };
  if (registro.tipoFactura === 'R1' && !registro.rectificada) errores.push('Rectificativa sin la factura que rectifica');
  return { registro, errores };
}

/** Factura recibida (fila de libroRecibidas). La fecha de registro contable es la del gasto (o la de hoy si es posterior) */
export function registroRecibida(g, { fechaRegistro } = {}) {
  const errores = [];
  const cp = idContraparte(g.nif);
  if (!cp) errores.push(`Falta el NIF de ${g.proveedor}`);
  else if (cp.nif && !nifValido(cp.nif)) errores.push(`El NIF de ${g.proveedor} (${cp.nif}) no es válido`);
  if (!g.numero) errores.push(`Falta el número de la factura de ${g.proveedor}`);
  if (g.sinFactura) errores.push('No hay factura adjunta');
  const intracom = !!cp?.otro;
  const registro = {
    libro: 'recibidas', ...periodoDe(g.fecha),
    numero: String(g.numero || ''), fecha: g.fecha, tipoFactura: g.abono ? 'R1' : 'F1',
    total: r2(g.total), descripcion: String(g.concepto || 'Compra').slice(0, 500),
    contraparte: cp ? { nombre: g.proveedor, ...cp } : null,
    clave: intracom ? '09' : '01', // 09 = adquisición intracomunitaria
    desglose: [{ tipo: g.tipo, base: r2(g.base), cuota: r2(g.cuota) }],
    cuotaDeducible: r2(g.cuota), fechaRegistro: fechaRegistro || g.fecha, inversion: !!g.inversion,
  };
  if (intracom) errores.push('Proveedor de otro país de la UE: revisa con la gestoría cómo declararla (autoliquidación) antes de enviarla');
  return { registro, errores };
}

// ==================== XML ====================
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n) => r2(n).toFixed(2);
const tag = (n, v) => (v === undefined || v === null || v === '' ? '' : `<sii:${n}>${typeof v === 'string' ? v : esc(v)}</sii:${n}>`);
const xmlContraparte = (c) => !c ? '' : `<sii:Contraparte>${tag('NombreRazon', esc(String(c.nombre || '').slice(0, 120)))}${c.nif ? tag('NIF', esc(c.nif)) : `<sii:IDOtro>${tag('CodigoPais', c.otro.pais)}${tag('IDType', c.otro.tipo)}${tag('ID', esc(c.otro.id))}</sii:IDOtro>`}</sii:Contraparte>`;
const xmlCabecera = (titular, tipoComunicacion = 'A0') => `<sii:Cabecera>${tag('IDVersionSii', VERSION_SII)}<sii:Titular>${tag('NombreRazon', esc(titular.nombre))}${tag('NIF', esc(titular.nif))}</sii:Titular>${tag('TipoComunicacion', tipoComunicacion)}</sii:Cabecera>`;
const sobre = (cuerpo) => `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:siiLR="${NS_LR}" xmlns:sii="${NS_SII}"><soapenv:Header/><soapenv:Body>${cuerpo}</soapenv:Body></soapenv:Envelope>`;
const xmlPeriodo = (r) => `<sii:PeriodoLiquidacion>${tag('Ejercicio', r.ejercicio)}${tag('Periodo', r.periodo)}</sii:PeriodoLiquidacion>`;

/** tipoComunicacion: A0 = alta, A1 = modificación de una ya enviada */
export function xmlEmitidas(registros, titular, tipoComunicacion = 'A0') {
  const regs = registros.map((r) => {
    const detalle = r.desglose.map((d) => `<sii:DetalleIVA>${tag('TipoImpositivo', num(d.tipo))}${tag('BaseImponible', num(d.base))}${tag('CuotaRepercutida', num(d.cuota))}${d.reCuota ? tag('TipoRecargoEquivalencia', num(d.reTipo)) + tag('CuotaRecargoEquivalencia', num(d.reCuota)) : ''}</sii:DetalleIVA>`).join('');
    const rect = r.tipoFactura === 'R1' ? `${tag('TipoRectificativa', 'I')}${r.rectificada ? `<sii:FacturasRectificadas><sii:IDFacturaRectificada>${tag('NumSerieFacturaEmisor', esc(r.rectificada.numero))}${tag('FechaExpedicionFacturaEmisor', r.rectificada.fecha ? fechaSII(r.rectificada.fecha) : null)}</sii:IDFacturaRectificada></sii:FacturasRectificadas>` : ''}` : '';
    return `<siiLR:RegistroLRFacturasEmitidas>${xmlPeriodo(r)}<siiLR:IDFactura><sii:IDEmisorFactura>${tag('NIF', esc(titular.nif))}</sii:IDEmisorFactura>${tag('NumSerieFacturaEmisor', esc(r.numero))}${tag('FechaExpedicionFacturaEmisor', fechaSII(r.fecha))}</siiLR:IDFactura><siiLR:FacturaExpedida>${tag('TipoFactura', r.tipoFactura)}${rect}${tag('ClaveRegimenEspecialOTrascendencia', '01')}${tag('ImporteTotal', num(r.total))}${tag('DescripcionOperacion', esc(r.descripcion))}${xmlContraparte(r.contraparte)}<sii:TipoDesglose><sii:DesgloseFactura><sii:Sujeta><sii:NoExenta>${tag('TipoNoExenta', 'S1')}<sii:DesgloseIVA>${detalle}</sii:DesgloseIVA></sii:NoExenta></sii:Sujeta></sii:DesgloseFactura></sii:TipoDesglose></siiLR:FacturaExpedida></siiLR:RegistroLRFacturasEmitidas>`;
  }).join('');
  return sobre(`<siiLR:SuministroLRFacturasEmitidas>${xmlCabecera(titular, tipoComunicacion)}${regs}</siiLR:SuministroLRFacturasEmitidas>`);
}

export function xmlRecibidas(registros, titular, tipoComunicacion = 'A0') {
  const regs = registros.map((r) => {
    const detalle = r.desglose.map((d) => `<sii:DetalleIVA>${tag('TipoImpositivo', num(d.tipo))}${tag('BaseImponible', num(d.base))}${tag('CuotaSoportada', num(d.cuota))}</sii:DetalleIVA>`).join('');
    const emisor = r.contraparte?.nif ? tag('NIF', esc(r.contraparte.nif)) : r.contraparte ? `<sii:IDOtro>${tag('CodigoPais', r.contraparte.otro.pais)}${tag('IDType', r.contraparte.otro.tipo)}${tag('ID', esc(r.contraparte.otro.id))}</sii:IDOtro>` : '';
    return `<siiLR:RegistroLRFacturasRecibidas>${xmlPeriodo(r)}<siiLR:IDFactura><sii:IDEmisorFactura>${emisor}</sii:IDEmisorFactura>${tag('NumSerieFacturaEmisor', esc(r.numero))}${tag('FechaExpedicionFacturaEmisor', fechaSII(r.fecha))}</siiLR:IDFactura><siiLR:FacturaRecibida>${tag('TipoFactura', r.tipoFactura)}${r.tipoFactura === 'R1' ? tag('TipoRectificativa', 'I') : ''}${tag('ClaveRegimenEspecialOTrascendencia', r.clave)}${tag('ImporteTotal', num(r.total))}${tag('DescripcionOperacion', esc(r.descripcion))}<sii:DesgloseFactura><sii:DesgloseIVA>${detalle}</sii:DesgloseIVA></sii:DesgloseFactura>${xmlContraparte(r.contraparte)}${tag('FechaRegContable', fechaSII(r.fechaRegistro))}${tag('CuotaDeducible', num(r.cuotaDeducible))}</siiLR:FacturaRecibida></siiLR:RegistroLRFacturasRecibidas>`;
  }).join('');
  return sobre(`<siiLR:SuministroLRFacturasRecibidas>${xmlCabecera(titular, tipoComunicacion)}${regs}</siiLR:SuministroLRFacturasRecibidas>`);
}

// ==================== RESPUESTA ====================
const entre = (xml, nombre) => { const m = new RegExp(`<(?:\\w+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nombre}>`).exec(xml); return m ? m[1].trim() : null; };
const todos = (xml, nombre) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${nombre}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${nombre}>`, 'g'))].map((m) => m[1]);
/** { estadoEnvio, csv, lineas: [{ numero, estado, codigo, descripcion }], fallo } */
export function leerRespuesta(xml) {
  const fallo = entre(xml, 'faultstring');
  if (fallo) return { estadoEnvio: 'Error', fallo, lineas: [] };
  return {
    estadoEnvio: entre(xml, 'EstadoEnvio'), csv: entre(xml, 'CSV'),
    lineas: todos(xml, 'RespuestaLinea').map((l) => ({
      numero: entre(l, 'NumSerieFacturaEmisor'), estado: entre(l, 'EstadoRegistro'),
      codigo: entre(l, 'CodigoErrorRegistro'), descripcion: entre(l, 'DescripcionErrorRegistro'),
    })),
  };
}
