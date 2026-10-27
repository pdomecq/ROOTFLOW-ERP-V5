// ==================== V82 — ÁREA DE CLIENTE ====================
// Página pública para los restaurantes: /area-cliente?t=<clientes.portal_token>
// No usa la sesión del ERP ni lee tablas: todo pasa por la Edge Function portal-cliente,
// que con el token devuelve solo los datos de ese cliente.
import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt, ShoppingCart, Repeat, Send, Home, Printer, X, Loader2, AlertCircle,
  CheckCircle, Clock, XCircle, ChevronDown, ChevronRight, Plus, Trash2, LogOut, Mail, Phone, FileDown, Truck
} from 'lucide-react';
import { EMPRESA, LOGO_URL } from './empresa.js';

const FUNCION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portal-cliente`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const LS_TOKEN = 'rootflow_portal_token';

const eur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
const fecha = (d) => d ? new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const FRECUENCIAS = { semanal: 'Cada semana', quincenal: 'Cada 15 días', mensual: 'Cada mes' };
const ESTADO_PEDIDO = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-700' },
  en_preparacion: { label: 'Preparando', cls: 'bg-blue-100 text-blue-700' },
  enviado: { label: 'En reparto', cls: 'bg-purple-100 text-purple-700' },
  entregado: { label: 'Entregado', cls: 'bg-green-100 text-green-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-neutral-100 text-neutral-500' },
};
const ESTADO_FACTURA = {
  pendiente: { label: 'Pendiente de pago', cls: 'bg-amber-100 text-amber-700' },
  vencida: { label: 'Vencida', cls: 'bg-red-100 text-red-700' },
  pagada: { label: 'Pagada', cls: 'bg-green-100 text-green-700' },
  anulada: { label: 'Anulada', cls: 'bg-neutral-200 text-neutral-600' }, // V87
  rectificativa: { label: 'Rectificativa', cls: 'bg-purple-100 text-purple-700' }, // V87
};
const ESTADO_SOLICITUD = {
  pendiente: { label: 'En revisión', cls: 'bg-amber-100 text-amber-700', Icon: Clock },
  aprobada: { label: 'Aprobada', cls: 'bg-green-100 text-green-700', Icon: CheckCircle },
  rechazada: { label: 'No es posible', cls: 'bg-red-100 text-red-700', Icon: XCircle },
  cancelada: { label: 'Cancelada', cls: 'bg-neutral-100 text-neutral-500', Icon: XCircle },
};

const llamar = async (payload) => {
  const res = await fetch(FUNCION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify(payload),
  });
  let data = null;
  try { data = await res.json(); } catch { /* respuesta vacía */ }
  if (!res.ok) throw new Error(data?.error || `Error ${res.status}`);
  return data;
};

// V83: descarga el PDF de una factura o un albarán (lo genera la Edge Function)
const descargarPdf = async (token, tipo, id) => {
  const r = await llamar({ token, accion: 'pdf', tipo, id });
  const bytes = Uint8Array.from(atob(r.base64), ch => ch.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a');
  a.href = url; a.download = r.filename || `${tipo}-${id}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

const BotonPdf = ({ token, tipo, id, texto = 'PDF', className = '' }) => {
  const [cargando, setCargando] = useState(false);
  return (
    <button
      onClick={async (e) => { e.stopPropagation(); setCargando(true); try { await descargarPdf(token, tipo, id); } catch (err) { alert('❌ ' + err.message); } setCargando(false); }}
      disabled={cargando}
      className={`inline-flex items-center gap-1 text-xs font-semibold rounded-lg px-2 py-1 border border-neutral-300 hover:bg-neutral-100 disabled:opacity-50 ${className}`}
      title="Descargar PDF"
    >
      {cargando ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}{texto}
    </button>
  );
};

const leerToken = () => {
  const deUrl = new URLSearchParams(window.location.search).get('t');
  if (deUrl) return deUrl;
  try { return localStorage.getItem(LS_TOKEN) || ''; } catch { return ''; }
};

const Badge = ({ cls, children }) => <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
const Tarjeta = ({ className = '', children }) => <div className={`bg-white rounded-2xl border border-neutral-200 shadow-sm ${className}`}>{children}</div>;
const nombreLinea = (l) => [l.producto, l.formato_gramos ? `${l.formato_gramos} g` : null].filter(Boolean).join(' · ');

export default function AreaCliente() {
  const [token] = useState(leerToken);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState('resumen');
  const [facturaAbierta, setFacturaAbierta] = useState(null);
  const [formSolicitud, setFormSolicitud] = useState(null); // { recurrente | null }

  const cargar = async () => {
    if (!token) { setError('Para entrar necesitas el enlace personal que te enviamos por email.'); setCargando(false); return; }
    try {
      const d = await llamar({ token, accion: 'datos' });
      setDatos(d);
      setError('');
      try { localStorage.setItem(LS_TOKEN, token); } catch { /* sin almacenamiento */ }
    } catch (e) {
      setError(e.message);
    }
    setCargando(false);
  };

  useEffect(() => { document.title = 'Área de cliente · RootFlow'; cargar(); }, []);

  // Abrir directamente la factura del enlace del email (?factura=ID)
  useEffect(() => {
    if (!datos) return;
    const fid = new URLSearchParams(window.location.search).get('factura');
    if (fid) {
      const f = datos.facturas.find(x => String(x.id) === fid);
      if (f) { setTab('facturas'); setFacturaAbierta(f); }
    }
  }, [datos]);

  const salir = () => {
    try { localStorage.removeItem(LS_TOKEN); } catch { /* nada */ }
    window.location.href = window.location.pathname;
  };

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center bg-neutral-50"><Loader2 className="animate-spin text-orange-500" size={36} /></div>;
  }

  if (error || !datos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <Tarjeta className="max-w-md w-full p-8 text-center">
          <img src={LOGO_URL} alt="RootFlow" className="w-14 h-14 mx-auto mb-4" />
          <h1 className="text-xl font-black mb-2">Área de cliente</h1>
          <p className="text-neutral-600 mb-4 flex items-start gap-2 text-left"><AlertCircle size={18} className="text-orange-500 shrink-0 mt-0.5" />{error || 'No se han podido cargar tus datos.'}</p>
          <p className="text-sm text-neutral-500">¿No tienes el enlace? Escríbenos a <a className="text-orange-600 font-semibold" href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a> o llama al {EMPRESA.telefono}.</p>
        </Tarjeta>
      </div>
    );
  }

  const pendientesSolicitud = datos.solicitudes.filter(s => s.estado === 'pendiente').length;
  const tabs = [
    { id: 'resumen', label: 'Resumen', Icon: Home },
    { id: 'facturas', label: 'Facturas', Icon: Receipt, n: datos.facturas.length },
    { id: 'pedidos', label: 'Pedidos', Icon: ShoppingCart, n: datos.pedidos.length },
    { id: 'albaranes', label: 'Albaranes', Icon: Truck, n: (datos.albaranes || []).length }, // V83
    { id: 'recurrentes', label: 'Pedido fijo', Icon: Repeat },
    { id: 'solicitudes', label: 'Solicitudes', Icon: Send, n: pendientesSolicitud || null },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #factura-imprimir, #factura-imprimir * { visibility: visible !important; }
        #factura-imprimir { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border: none !important; }
        .no-print { display: none !important; }
      }`}</style>

      <header className="bg-white border-b border-neutral-200 no-print">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <a href="https://www.rootflow.es" className="flex items-center gap-2 min-w-0">
            <img src={LOGO_URL} alt="RootFlow" className="w-9 h-9" />
            <div className="min-w-0">
              <p className="font-black leading-tight">Root<span className="text-orange-500">Flow</span> <span className="font-semibold text-neutral-500">· Área de cliente</span></p>
              <p className="text-xs text-neutral-500 truncate">{datos.cliente.nombre}</p>
            </div>
          </a>
          <button onClick={salir} className="text-sm text-neutral-500 hover:text-neutral-900 flex items-center gap-1 shrink-0"><LogOut size={16} /><span className="hidden sm:inline">Salir</span></button>
        </div>
        <nav className="max-w-5xl mx-auto px-2 flex gap-1 overflow-x-auto">
          {tabs.map(({ id, label, Icon, n }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold border-b-2 whitespace-nowrap ${tab === id ? 'border-orange-500 text-orange-600' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}>
              <Icon size={16} />{label}{n ? <span className="text-xs bg-neutral-100 text-neutral-600 rounded-full px-1.5">{n}</span> : null}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 no-print">
        {tab === 'resumen' && <Resumen datos={datos} irA={setTab} abrirFactura={(f) => { setTab('facturas'); setFacturaAbierta(f); }} />}
        {tab === 'facturas' && <Facturas datos={datos} token={token} abrir={setFacturaAbierta} />}
        {tab === 'albaranes' && <Albaranes datos={datos} token={token} />}
        {tab === 'pedidos' && <Pedidos datos={datos} />}
        {tab === 'recurrentes' && <Recurrentes datos={datos} pedir={(r) => setFormSolicitud({ recurrente: r })} />}
        {tab === 'solicitudes' && <Solicitudes datos={datos} token={token} recargar={cargar} />}
      </main>

      <footer className="max-w-5xl mx-auto px-4 pb-8 text-xs text-neutral-400 no-print">
        {EMPRESA.nombre} · CIF {EMPRESA.cif} · <a href={`mailto:${EMPRESA.email}`} className="hover:text-orange-600"><Mail size={11} className="inline" /> {EMPRESA.email}</a> · <Phone size={11} className="inline" /> {EMPRESA.telefono}
      </footer>

      {facturaAbierta && <FacturaDetalle factura={facturaAbierta} cliente={datos.cliente} token={token} onClose={() => setFacturaAbierta(null)} />}
      {formSolicitud && (
        <FormSolicitud
          recurrente={formSolicitud.recurrente}
          catalogo={datos.catalogo}
          token={token}
          contactoDefecto={datos.cliente.contacto || ''}
          onClose={() => setFormSolicitud(null)}
          onEnviada={async () => { setFormSolicitud(null); await cargar(); setTab('solicitudes'); }}
        />
      )}
    </div>
  );
}

// ==================== RESUMEN ====================
function Resumen({ datos, irA, abrirFactura }) {
  const porPagar = datos.facturas.filter(f => f.estado === 'pendiente' || f.estado === 'vencida');
  const proximos = datos.pedidos.filter(p => ['pendiente', 'en_preparacion', 'enviado'].includes(p.estado));
  const tresMeses = new Date(); tresMeses.setMonth(tresMeses.getMonth() - 3);
  const consumo = {};
  datos.pedidos.filter(p => p.estado !== 'cancelado' && new Date(p.fecha) >= tresMeses).forEach(p => p.lineas.forEach(l => {
    const k = nombreLinea(l);
    consumo[k] = consumo[k] || { nombre: k, variedad: l.variedad, cantidad: 0, unidad: l.unidad };
    consumo[k].cantidad += l.cantidad;
  }));
  const top = Object.values(consumo).sort((a, b) => b.cantidad - a.cantidad);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Hola{datos.cliente.contacto ? `, ${datos.cliente.contacto}` : ''} 👋</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tarjeta className="p-4"><p className="text-xs text-neutral-500 uppercase font-semibold">Pendiente de pago</p><p className="text-2xl font-black mt-1">{eur(porPagar.reduce((s, f) => s + f.total, 0))}</p><p className="text-xs text-neutral-500">{porPagar.length} factura{porPagar.length === 1 ? '' : 's'}</p></Tarjeta>
        <Tarjeta className="p-4"><p className="text-xs text-neutral-500 uppercase font-semibold">Pedidos en curso</p><p className="text-2xl font-black mt-1">{proximos.length}</p><p className="text-xs text-neutral-500">{proximos[0] ? `Próxima entrega: ${fecha(proximos[proximos.length - 1].fecha_entrega)}` : 'Ninguno ahora mismo'}</p></Tarjeta>
        <Tarjeta className="p-4"><p className="text-xs text-neutral-500 uppercase font-semibold">Pedido fijo</p><p className="text-2xl font-black mt-1">{datos.recurrentes.filter(r => r.activo).length || '—'}</p><button onClick={() => irA('recurrentes')} className="text-xs text-orange-600 font-semibold">Ver o pedir ampliación →</button></Tarjeta>
      </div>

      {porPagar.length > 0 && (
        <Tarjeta className="p-4">
          <h2 className="font-bold mb-2">Facturas por pagar</h2>
          {porPagar.map(f => (
            <button key={f.id} onClick={() => abrirFactura(f)} className="w-full flex items-center justify-between py-2 border-t border-neutral-100 text-left hover:bg-neutral-50 px-1">
              <span><span className="font-semibold">{f.id}</span> <span className="text-sm text-neutral-500">· vence {fecha(f.fecha_vencimiento)}</span></span>
              <span className="font-bold">{eur(f.total)}</span>
            </button>
          ))}
        </Tarjeta>
      )}

      <Tarjeta className="p-4">
        <h2 className="font-bold mb-2">Lo que más pides (últimos 3 meses)</h2>
        {top.length === 0 ? <p className="text-sm text-neutral-500">Sin pedidos en los últimos 3 meses.</p> : (
          <table className="w-full text-sm">
            <tbody>
              {top.map(c => (
                <tr key={c.nombre} className="border-t border-neutral-100">
                  <td className="py-2"><p className="font-semibold">{c.nombre}</p>{c.variedad && <p className="text-xs text-neutral-500">{c.variedad}</p>}</td>
                  <td className="py-2 text-right font-bold whitespace-nowrap">{c.cantidad} {c.unidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>
    </div>
  );
}

// ==================== FACTURAS ====================
function Facturas({ datos, token, abrir }) {
  if (!datos.facturas.length) return <Tarjeta className="p-8 text-center text-neutral-500">Todavía no tienes facturas.</Tarjeta>;
  return (
    <Tarjeta className="divide-y divide-neutral-100">
      {datos.facturas.map(f => {
        const e = ESTADO_FACTURA[f.estado] || { label: f.estado, cls: 'bg-neutral-100 text-neutral-600' };
        return (
          <div key={f.id} onClick={() => abrir(f)} className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-neutral-50 cursor-pointer">
            <div className="min-w-0">
              <p className="font-bold">{f.id}</p>
              <p className="text-sm text-neutral-500">{fecha(f.fecha)}{f.periodo_desde ? ` · del ${fecha(f.periodo_desde)} al ${fecha(f.periodo_hasta)}` : ''}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="font-black">{eur(f.total)}</p>
                <Badge cls={e.cls}>{e.label}</Badge>
              </div>
              <BotonPdf token={token} tipo="factura" id={f.id} />
            </div>
          </div>
        );
      })}
    </Tarjeta>
  );
}

function FacturaDetalle({ factura: f, cliente, token, onClose }) {
  const sepa = cliente.sepa_activo && f.metodo_cobro === 'sepa_b2b';
  const plazo = f.plazo_pago_dias || cliente.plazo_pago_dias || 30;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 overflow-y-auto p-2 sm:p-6" onClick={onClose}>
      <div className="max-w-3xl mx-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-end gap-2 mb-2 no-print">
          <BotonPdf token={token} tipo="factura" id={f.id} texto="Descargar PDF" className="bg-orange-500 hover:bg-orange-600 text-white border-orange-500 text-sm px-4 py-2 rounded-xl" />
          <button onClick={() => window.print()} className="bg-white font-semibold rounded-xl px-4 py-2 flex items-center gap-2"><Printer size={16} /><span className="hidden sm:inline">Imprimir</span></button>
          <button onClick={onClose} className="bg-white rounded-xl px-3 py-2"><X size={18} /></button>
        </div>
        <div id="factura-imprimir" className="bg-white rounded-2xl p-5 sm:p-8 text-sm">
          <div className="flex justify-between items-start gap-4 mb-6">
            <div className="flex items-center gap-3">
              <img src={LOGO_URL} alt="" className="w-12 h-12" />
              <div><p className="text-xl font-black">Root<span className="text-orange-500">Flow</span></p><p className="text-xs text-neutral-500 uppercase tracking-wider">Hydroponics</p></div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-emerald-700">FACTURA</p>
              <p className="font-bold">{f.id}</p>
              <p className="text-neutral-500">Fecha: {fecha(f.fecha)}</p>
              <p className="text-neutral-500">Vencimiento: {fecha(f.fecha_vencimiento)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <div className="bg-neutral-50 rounded-xl p-3">
              <p className="text-xs text-neutral-400 uppercase font-bold mb-1">Emisor</p>
              <p className="font-bold">{EMPRESA.nombre}</p>
              <p>{EMPRESA.direccion}, {EMPRESA.cp} {EMPRESA.ciudad}</p>
              <p>CIF: {EMPRESA.cif}</p>
            </div>
            <div className="bg-neutral-50 rounded-xl p-3">
              <p className="text-xs text-neutral-400 uppercase font-bold mb-1">Cliente</p>
              <p className="font-bold">{cliente.nombre}</p>
              <p>{cliente.direccion}{cliente.codigo_postal || cliente.ciudad ? `, ${cliente.codigo_postal || ''} ${cliente.ciudad || ''}` : ''}</p>
              <p>CIF: {cliente.cif || '—'}</p>
            </div>
          </div>

          {f.concepto && <p className="mb-3 text-neutral-600">{f.concepto}</p>}

          <div className="overflow-x-auto">
            <table className="w-full mb-4">
              <thead><tr className="bg-emerald-700 text-white text-xs uppercase">
                <th className="text-left px-3 py-2">Descripción</th><th className="text-right px-3 py-2">Cant.</th><th className="text-right px-3 py-2">Precio</th><th className="text-right px-3 py-2">Importe</th>
              </tr></thead>
              <tbody>
                {f.grupos.map((g, gi) => (
                  <React.Fragment key={gi}>
                    {f.grupos.length > 1 && <tr className="bg-neutral-50"><td colSpan={4} className="px-3 py-1.5 text-xs font-bold text-neutral-500">{g.titulo}{g.fecha ? ` · ${fecha(g.fecha)}` : ''}</td></tr>}
                    {g.lineas.map((l, li) => (
                      <tr key={li} className="border-b border-neutral-100">
                        <td className="px-3 py-2">{nombreLinea(l)}</td>
                        <td className="px-3 py-2 text-right">{l.cantidad}</td>
                        <td className="px-3 py-2 text-right">{eur(l.precio_unitario)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{eur(l.subtotal)}</td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:w-72">
              <div className="flex justify-between py-1.5 border-b"><span>Subtotal</span><span>{eur(f.subtotal)}</span></div>
              {f.descuento_aplicado > 0 && <div className="flex justify-between py-1.5 border-b text-green-700"><span>Descuento</span><span>-{eur(f.descuento_aplicado)}</span></div>}
              {f.portes_importe > 0 && <div className="flex justify-between py-1.5 border-b"><span>Portes</span><span>{eur(f.portes_importe)}</span></div>}
              <div className="flex justify-between py-1.5 border-b"><span>Base imponible</span><span>{eur(f.base_imponible)}</span></div>
              <div className="flex justify-between py-1.5 border-b"><span>IVA ({f.iva_porcentaje}%)</span><span>{eur(f.iva)}</span></div>
              {f.recargo_equivalencia && <div className="flex justify-between py-1.5 border-b"><span>R.E. ({f.re_porcentaje}%)</span><span>{eur(f.re_importe)}</span></div>}
              <div className="flex justify-between py-2 text-lg font-black text-emerald-700 border-t-2 border-emerald-700"><span>TOTAL</span><span>{eur(f.total)}</span></div>
            </div>
          </div>

          <div className={`mt-5 p-3 rounded-xl border ${sepa ? 'bg-blue-50 border-blue-200' : 'bg-emerald-50 border-emerald-200'}`}>
            {f.estado === 'rectificativa' ? (
              <p>Factura rectificativa: anula por completo la factura <strong>{f.factura_rectificada_id || ''}</strong>{f.motivo_anulacion ? ` (${f.motivo_anulacion})` : ''}. Si ya la habías pagado, te devolvemos el importe o lo descontamos de tu próxima factura.</p>
            ) : f.estado === 'anulada' ? (
              <p className="font-semibold text-neutral-600">Factura anulada: no hay que pagarla.</p>
            ) : f.estado === 'pagada' ? (
              <p className="font-semibold text-green-700">✓ Pagada{f.fecha_cobro ? ` el ${fecha(f.fecha_cobro)}` : ''}. ¡Gracias!</p>
            ) : sepa ? (
              <p>Se cobrará por <strong>domiciliación SEPA B2B</strong> el {fecha(f.fecha_vencimiento)} en la cuenta del mandato firmado.</p>
            ) : (
              <div className="space-y-0.5">
                <p className="text-xs font-bold uppercase text-emerald-700">Pago por transferencia</p>
                <p><strong>Titular:</strong> {EMPRESA.nombre} · <strong>Banco:</strong> {EMPRESA.banco}</p>
                <p><strong>IBAN:</strong> <span className="font-mono">{EMPRESA.iban}</span> · <strong>BIC:</strong> <span className="font-mono">{EMPRESA.swift}</span></p>
                <p><strong>Concepto:</strong> {f.id}</p>
              </div>
            )}
            <p className="text-xs text-neutral-600 mt-2">Plazo de pago: {plazo} días desde la fecha de factura (Ley 15/2010, productos perecederos). El impago en plazo devengará intereses de demora conforme al art. 7 de la Ley 3/2004.</p>
          </div>
          <p className="text-center text-xs text-neutral-400 mt-6">{EMPRESA.nombre} · CIF {EMPRESA.cif} · {EMPRESA.direccion}, {EMPRESA.cp} {EMPRESA.ciudad} · {EMPRESA.telefono} · {EMPRESA.email}</p>
        </div>
      </div>
    </div>
  );
}

// ==================== ALBARANES (V83) ====================
function Albaranes({ datos, token }) {
  const [abierto, setAbierto] = useState(null);
  const lista = datos.albaranes || [];
  if (!lista.length) return <Tarjeta className="p-8 text-center text-neutral-500">Todavía no tienes albaranes.</Tarjeta>;
  return (
    <Tarjeta className="divide-y divide-neutral-100">
      {lista.map(a => {
        const open = abierto === a.id;
        return (
          <div key={a.id}>
            <div onClick={() => setAbierto(open ? null : a.id)} className="w-full p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-neutral-50">
              <div className="flex items-center gap-2 min-w-0">
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <div className="min-w-0">
                  <p className="font-bold">{a.id}</p>
                  <p className="text-sm text-neutral-500">{fecha(a.fecha)} · {a.lineas.length} producto{a.lineas.length === 1 ? '' : 's'}{a.numero_factura ? ` · factura ${a.numero_factura}` : ''}</p>
                </div>
              </div>
              <BotonPdf token={token} tipo="albaran" id={a.id} />
            </div>
            {open && (
              <div className="px-4 pb-4">
                <table className="w-full text-sm">
                  <tbody>
                    {a.lineas.map((l, i) => (
                      <tr key={i} className="border-t border-neutral-100">
                        <td className="py-1.5">{nombreLinea(l)}{l.variedad && <span className="text-xs text-neutral-500"> · {l.variedad}</span>}</td>
                        <td className="py-1.5 text-right font-semibold whitespace-nowrap">{l.cantidad} {l.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </Tarjeta>
  );
}

// ==================== PEDIDOS E HISTÓRICO ====================
function Pedidos({ datos }) {
  const [abierto, setAbierto] = useState(null);
  const [verTodos, setVerTodos] = useState(false);
  const pedidos = verTodos ? datos.pedidos : datos.pedidos.slice(0, 20);

  // Histórico mensual por producto (últimos 6 meses)
  const meses = useMemo(() => {
    const out = [];
    const d = new Date(); d.setDate(1);
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push({ key: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, label: m.toLocaleDateString('es-ES', { month: 'short' }) });
    }
    return out;
  }, []);
  const historico = useMemo(() => {
    const filas = {};
    datos.pedidos.filter(p => p.estado !== 'cancelado').forEach(p => {
      const mk = String(p.fecha_entrega || p.fecha).slice(0, 7);
      if (!meses.some(m => m.key === mk)) return;
      p.lineas.forEach(l => {
        const k = nombreLinea(l);
        filas[k] = filas[k] || { nombre: k, variedad: l.variedad, porMes: {} };
        filas[k].porMes[mk] = (filas[k].porMes[mk] || 0) + l.cantidad;
      });
    });
    return Object.values(filas).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [datos, meses]);

  return (
    <div className="space-y-4">
      <Tarjeta className="p-4">
        <h2 className="font-bold mb-2">Histórico de los últimos 6 meses</h2>
        {historico.length === 0 ? <p className="text-sm text-neutral-500">Sin pedidos en este periodo.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-neutral-500 uppercase"><th className="text-left py-1">Producto</th>{meses.map(m => <th key={m.key} className="text-right py-1 px-1">{m.label}</th>)}</tr></thead>
              <tbody>
                {historico.map(h => (
                  <tr key={h.nombre} className="border-t border-neutral-100">
                    <td className="py-1.5 pr-2"><p className="font-semibold">{h.nombre}</p>{h.variedad && <p className="text-xs text-neutral-500">{h.variedad}</p>}</td>
                    {meses.map(m => <td key={m.key} className="text-right px-1">{h.porMes[m.key] || <span className="text-neutral-300">·</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Tarjeta>

      <Tarjeta className="divide-y divide-neutral-100">
        {datos.pedidos.length === 0 && <p className="p-8 text-center text-neutral-500">Todavía no tienes pedidos.</p>}
        {pedidos.map(p => {
          const e = ESTADO_PEDIDO[p.estado] || { label: p.estado, cls: 'bg-neutral-100 text-neutral-600' };
          const open = abierto === p.id;
          return (
            <div key={p.id}>
              <button onClick={() => setAbierto(open ? null : p.id)} className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-neutral-50">
                <div className="flex items-center gap-2 min-w-0">
                  {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <div className="min-w-0">
                    <p className="font-bold">Pedido #{p.id}</p>
                    <p className="text-sm text-neutral-500">Entrega {fecha(p.fecha_entrega || p.fecha)} · {p.lineas.length} producto{p.lineas.length === 1 ? '' : 's'}</p>
                  </div>
                </div>
                <div className="text-right shrink-0"><p className="font-bold">{eur(p.total)}</p><Badge cls={e.cls}>{e.label}</Badge></div>
              </button>
              {open && (
                <div className="px-4 pb-4">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-neutral-500 uppercase"><th className="text-left py-1">Producto</th><th className="text-left py-1">Variedad</th><th className="text-right py-1">Cant.</th><th className="text-right py-1">Importe</th></tr></thead>
                    <tbody>
                      {p.lineas.map((l, i) => (
                        <tr key={i} className="border-t border-neutral-100">
                          <td className="py-1.5">{nombreLinea(l)}</td><td className="py-1.5 text-neutral-500">{l.variedad || '—'}</td>
                          <td className="py-1.5 text-right font-semibold">{l.cantidad} {l.unidad}</td><td className="py-1.5 text-right">{eur(l.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
        {!verTodos && datos.pedidos.length > 20 && <button onClick={() => setVerTodos(true)} className="w-full p-3 text-sm font-semibold text-orange-600">Ver los {datos.pedidos.length} pedidos</button>}
      </Tarjeta>
    </div>
  );
}

// ==================== PEDIDO FIJO (RECURRENTES) ====================
function Recurrentes({ datos, pedir }) {
  const activos = datos.recurrentes.filter(r => r.activo);
  return (
    <div className="space-y-4">
      <Tarjeta className="p-4 bg-orange-50 border-orange-200 text-sm">
        ¿Necesitas más cantidad o añadir variedades a tu pedido fijo? Envíanos la solicitud y te confirmamos en cuanto revisemos el espacio en cámara y la disponibilidad de cultivo. <strong>No se aplica automáticamente.</strong>
      </Tarjeta>
      {activos.length === 0 && (
        <Tarjeta className="p-6 text-center">
          <p className="text-neutral-600 mb-3">No tienes ningún pedido fijo activo.</p>
          <button onClick={() => pedir(null)} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-4 py-2">Solicitar un pedido fijo</button>
        </Tarjeta>
      )}
      {activos.map(r => (
        <Tarjeta key={r.id} className="p-4">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="font-bold text-lg">{r.nombre}</p>
              <p className="text-sm text-neutral-500">{FRECUENCIAS[r.frecuencia] || r.frecuencia} · {DIAS[r.dia_semana] || ''}{r.proxima_ejecucion ? ` · próximo: ${fecha(r.proxima_ejecucion)}` : ''}</p>
            </div>
            <button onClick={() => pedir(r)} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl px-3 py-2 text-sm shrink-0 flex items-center gap-1"><Plus size={16} />Pedir ampliación</button>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {r.lineas.map((l, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="py-1.5"><p className="font-semibold">{nombreLinea(l)}</p>{l.variedad && <p className="text-xs text-neutral-500">{l.variedad}</p>}</td>
                  <td className="py-1.5 text-right font-bold">{l.cantidad} {l.unidad}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Tarjeta>
      ))}
    </div>
  );
}

function FormSolicitud({ recurrente, catalogo, token, contactoDefecto, onClose, onEnviada }) {
  const [lineas, setLineas] = useState(() => (recurrente?.lineas || []).map(l => ({ producto_id: l.producto_id, actual: l.cantidad, nueva: l.cantidad })));
  const [anadir, setAnadir] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [contacto, setContacto] = useState(contactoDefecto);
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  const prod = (id) => catalogo.find(p => p.producto_id === id);
  const disponibles = catalogo.filter(p => !lineas.some(l => l.producto_id === p.producto_id));
  const cambios = lineas.filter(l => Number(l.nueva) !== l.actual);

  const enviar = async () => {
    if (!cambios.length && !mensaje.trim()) { setError('Cambia alguna cantidad o escríbenos un mensaje.'); return; }
    setEnviando(true); setError('');
    try {
      await llamar({
        token, accion: 'solicitar',
        pedido_recurrente_id: recurrente?.id || null,
        items: cambios.map(l => ({ producto_id: l.producto_id, cantidad_solicitada: Math.max(0, parseInt(l.nueva) || 0) })),
        fecha_desde: fechaDesde || null,
        contacto_nombre: contacto,
        mensaje,
      });
      await onEnviada();
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 overflow-y-auto p-2 sm:p-6" onClick={onClose}>
      <div className="max-w-xl mx-auto bg-white rounded-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black">{recurrente ? `Ampliar "${recurrente.nombre}"` : 'Solicitar un pedido fijo'}</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <p className="text-sm text-neutral-500 mb-3">Indica la cantidad que quieres en cada entrega. Te confirmaremos por email si es posible.</p>

        <table className="w-full text-sm mb-3">
          <thead><tr className="text-xs text-neutral-500 uppercase"><th className="text-left py-1">Producto</th><th className="text-right py-1">Ahora</th><th className="text-right py-1">Quiero</th><th></th></tr></thead>
          <tbody>
            {lineas.map((l, i) => {
              const p = prod(l.producto_id);
              return (
                <tr key={l.producto_id} className="border-t border-neutral-100">
                  <td className="py-1.5"><p className="font-semibold">{p ? nombreLinea(p) : 'Producto'}</p>{p?.variedad && <p className="text-xs text-neutral-500">{p.variedad}</p>}</td>
                  <td className="py-1.5 text-right text-neutral-500">{l.actual}</td>
                  <td className="py-1.5 text-right">
                    <input type="number" min="0" max="1000" value={l.nueva} onChange={e => setLineas(lineas.map((x, j) => j === i ? { ...x, nueva: e.target.value } : x))}
                      className={`w-20 text-right border rounded-lg px-2 py-1 ${Number(l.nueva) !== l.actual ? 'border-orange-400 bg-orange-50 font-bold' : 'border-neutral-300'}`} />
                  </td>
                  <td className="py-1.5 text-right w-8">{l.actual === 0 && <button onClick={() => setLineas(lineas.filter((_, j) => j !== i))} className="text-neutral-400 hover:text-red-600"><Trash2 size={15} /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {disponibles.length > 0 && (
          <div className="flex gap-2 mb-4">
            <select value={anadir} onChange={e => setAnadir(e.target.value)} className="flex-1 border border-neutral-300 rounded-xl px-3 py-2 text-sm">
              <option value="">Añadir otra variedad…</option>
              {disponibles.map(p => <option key={p.producto_id} value={p.producto_id}>{nombreLinea(p)}{p.variedad ? ` (${p.variedad})` : ''}</option>)}
            </select>
            <button disabled={!anadir} onClick={() => { setLineas([...lineas, { producto_id: Number(anadir), actual: 0, nueva: 1 }]); setAnadir(''); }} className="bg-neutral-900 disabled:bg-neutral-300 text-white rounded-xl px-3"><Plus size={18} /></button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-sm">
          <label className="block"><span className="text-neutral-600 font-semibold">¿Desde cuándo?</span>
            <input type="date" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} className="mt-1 w-full border border-neutral-300 rounded-xl px-3 py-2" /></label>
          <label className="block"><span className="text-neutral-600 font-semibold">Tu nombre</span>
            <input value={contacto} onChange={e => setContacto(e.target.value)} className="mt-1 w-full border border-neutral-300 rounded-xl px-3 py-2" /></label>
        </div>
        <label className="block text-sm mb-3"><span className="text-neutral-600 font-semibold">Comentarios</span>
          <textarea rows={3} value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Ej.: para el menú de temporada, solo los fines de semana…" className="mt-1 w-full border border-neutral-300 rounded-xl px-3 py-2" /></label>

        {error && <p className="text-sm text-red-600 mb-3 flex items-center gap-1"><AlertCircle size={15} />{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-neutral-600">Cancelar</button>
          <button onClick={enviar} disabled={enviando} className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold rounded-xl px-4 py-2 flex items-center gap-2">
            {enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Enviar solicitud
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== SOLICITUDES ====================
function Solicitudes({ datos, token, recargar }) {
  const [cancelando, setCancelando] = useState(null);
  const nombreRec = (id) => datos.recurrentes.find(r => r.id === id)?.nombre;
  const cancelar = async (s) => {
    if (!window.confirm('¿Cancelar esta solicitud?')) return;
    setCancelando(s.id);
    try { await llamar({ token, accion: 'cancelar_solicitud', solicitud_id: s.id }); await recargar(); }
    catch (e) { alert('❌ ' + e.message); }
    setCancelando(null);
  };
  if (!datos.solicitudes.length) return <Tarjeta className="p-8 text-center text-neutral-500">No has enviado ninguna solicitud.</Tarjeta>;
  return (
    <div className="space-y-3">
      {datos.solicitudes.map(s => {
        const e = ESTADO_SOLICITUD[s.estado] || ESTADO_SOLICITUD.pendiente;
        return (
          <Tarjeta key={s.id} className="p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="font-bold">{s.pedido_recurrente_id ? `Ampliación de "${nombreRec(s.pedido_recurrente_id) || 'pedido fijo'}"` : 'Nuevo pedido fijo'}</p>
                <p className="text-xs text-neutral-500">Enviada el {fecha(s.created_at)}{s.fecha_desde ? ` · desde ${fecha(s.fecha_desde)}` : ''}</p>
              </div>
              <Badge cls={e.cls}><e.Icon size={12} />{e.label}</Badge>
            </div>
            {(s.items_json || []).map((i, k) => <p key={k} className="text-sm">• {i.producto_nombre}: {i.cantidad_actual} → <strong>{i.cantidad_solicitada}</strong></p>)}
            {s.mensaje && <p className="text-sm text-neutral-600 italic mt-1">"{s.mensaje}"</p>}
            {s.respuesta && <p className="text-sm mt-2 p-2 rounded-lg bg-neutral-50"><strong>RootFlow:</strong> {s.respuesta}</p>}
            {s.estado === 'pendiente' && <button disabled={cancelando === s.id} onClick={() => cancelar(s)} className="text-xs text-neutral-500 hover:text-red-600 mt-2">Cancelar solicitud</button>}
          </Tarjeta>
        );
      })}
    </div>
  );
}
