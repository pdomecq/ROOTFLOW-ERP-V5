// V127: envío al SII de la AEAT (función de Vercel, Node). El ERP prepara el XML con src/sii.js y lo manda aquí;
// esta función lo envía con el certificado electrónico de la empresa (conexión con certificado de cliente) y guarda
// el resultado de cada factura en la tabla sii_envios.
//
// Variables de entorno en Vercel (Project → Settings → Environment Variables), que pone Peri, nunca en el código:
//   SII_CERT_P12            el certificado (.p12/.pfx) en base64
//   SII_CERT_PASSWORD       su contraseña
//   SII_PRODUCCION          'si' para permitir los envíos reales (si no, solo el entorno de pruebas de la AEAT)
//   SUPABASE_SERVICE_ROLE_KEY  clave service_role de Supabase (para comprobar el usuario y guardar los resultados)
//   VITE_SUPABASE_URL       (ya existe)
//
// POST JSON con cabecera Authorization: Bearer <sesión del ERP>
//   { accion: 'estado' }                                         → si el certificado está puesto y se puede leer
//   { accion: 'enviar', libro: 'emitidas'|'recibidas', entorno: 'pruebas'|'produccion', xml, refs: [{ tipo, id, numero, periodo }], tipoComunicacion }

import https from 'node:https';
import tls from 'node:tls';
import { createClient } from '@supabase/supabase-js';
import { ENDPOINTS_SII, leerRespuesta } from '../src/sii.js';

const env = (k) => process.env[k] || '';

function certificado() {
  const b64 = env('SII_CERT_P12');
  if (!b64) return { error: 'Falta el certificado (variable SII_CERT_P12 en Vercel)' };
  const pfx = Buffer.from(b64, 'base64');
  try {
    tls.createSecureContext({ pfx, passphrase: env('SII_CERT_PASSWORD') });
  } catch (e) {
    return { error: `El certificado no se puede abrir (¿contraseña?): ${e.message}` };
  }
  return { pfx, passphrase: env('SII_CERT_PASSWORD') };
}

function enviarSoap(url, xml, cert) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST', pfx: cert.pfx, passphrase: cert.passphrase, timeout: 25000,
      headers: { 'Content-Type': 'text/xml; charset=UTF-8', SOAPAction: '""', 'Content-Length': Buffer.byteLength(xml) },
    }, (res) => {
      let datos = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { datos += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: datos }));
    });
    req.on('timeout', () => req.destroy(new Error('La AEAT no contesta (tiempo agotado)')));
    req.on('error', reject);
    req.write(xml);
    req.end();
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  const supabase = createClient(env('VITE_SUPABASE_URL') || env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  if (!env('SUPABASE_SERVICE_ROLE_KEY')) return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel' });
  // Solo usuarios activos del ERP
  const jwt = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: u } = jwt ? await supabase.auth.getUser(jwt) : { data: null };
  const email = u?.user?.email || '';
  if (!email.endsWith('@rootflow.es')) return res.status(401).json({ error: 'Solo para usuarios del ERP' });
  const { data: perfil } = await supabase.from('user_profiles').select('activo').eq('email', email).maybeSingle();
  if (perfil && perfil.activo === false) return res.status(403).json({ error: 'Usuario desactivado' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const cert = certificado();
  if (body.accion === 'estado') return res.json({ ok: !cert.error, error: cert.error || null, produccion: env('SII_PRODUCCION') === 'si' });
  if (body.accion !== 'enviar') return res.status(400).json({ error: 'Acción no válida' });
  if (cert.error) return res.status(400).json({ error: cert.error });
  const libro = body.libro === 'recibidas' ? 'recibidas' : 'emitidas';
  const entorno = body.entorno === 'produccion' ? 'produccion' : 'pruebas';
  if (entorno === 'produccion' && env('SII_PRODUCCION') !== 'si') return res.status(400).json({ error: 'Los envíos reales no están activados (SII_PRODUCCION=si en Vercel). Prueba antes en el entorno de pruebas.' });
  const xml = String(body.xml || '');
  if (!xml.includes('SuministroLRFacturas') || xml.length > 900000) return res.status(400).json({ error: 'XML no válido' });

  let r;
  try {
    r = await enviarSoap(ENDPOINTS_SII[entorno][libro], xml, cert);
  } catch (e) {
    return res.status(502).json({ error: `No se pudo conectar con la AEAT: ${e.message}` });
  }
  const resp = leerRespuesta(r.body || '');
  if (!resp.estadoEnvio) resp.estadoEnvio = r.status >= 400 ? 'Error' : 'Desconocido';
  if (resp.estadoEnvio === 'Error' && !resp.fallo) resp.fallo = `HTTP ${r.status}: ${(r.body || '').slice(0, 300)}`;

  // Resultado de cada factura (por su número; si la AEAT rechaza todo el envío, el error va en todas)
  const filas = (Array.isArray(body.refs) ? body.refs : []).map((ref) => {
    const l = resp.lineas.find((x) => x.numero === String(ref.numero));
    return {
      libro, ref_tipo: String(ref.tipo || ''), ref_id: String(ref.id ?? ''), numero: String(ref.numero || ''), periodo: String(ref.periodo || ''),
      entorno, tipo_comunicacion: body.tipoComunicacion === 'A1' ? 'A1' : 'A0',
      estado: l?.estado || (resp.estadoEnvio === 'Correcto' ? 'Correcto' : resp.fallo ? 'Error' : 'Incorrecto'),
      codigo: l?.codigo || null, descripcion: l?.descripcion || resp.fallo || null, csv: resp.csv || null, enviado_por: email,
    };
  });
  if (filas.length) {
    const { error } = await supabase.from('sii_envios').insert(filas);
    if (error) resp.avisoGuardado = `Enviado, pero no se pudo guardar el resultado: ${error.message}`;
  }
  return res.json(resp);
}
