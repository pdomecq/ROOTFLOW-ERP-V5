// V99: mejoras de interfaz que se aplican solas a TODO el ERP, sin tocar cada pantalla:
//  1) Tablas: ordenar al pulsar la cabecera (▲▼), buscador, filtros por columna (Estado, Cliente…) y elegir qué
//     columnas se ven. Lo que eliges (orden y columnas) se recuerda en este navegador.
//  2) Notas informativas (textos pequeños grises de explicación): se quedan en un icono ⓘ; al pasar el ratón
//     (o tocarlo en el móvil) se abre una nube con el texto.
// Funciona sobre el DOM que pinta React sin cambiar sus nodos: solo atributos data-rf-*, mover filas dentro de su
// propio <tbody> y una barra insertada junto a la tabla (se reubica o se quita sola). Para excluir algo:
// atributo data-rf-no en la tabla o en un contenedor.

const PREFS = 'rf_tablas_v99';
const MIN_FILAS_BARRA = 6;
const MAX_VALORES_FILTRO = 15;

const leerPrefs = () => { try { return JSON.parse(localStorage.getItem(PREFS) || '{}'); } catch { return {}; } };
const guardarPrefs = (p) => { try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* sin almacenamiento */ } };
const normal = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

const CSS = `
[data-rf-oculta]{display:none!important}
th[data-rf-ordenable]{cursor:pointer;user-select:none;white-space:nowrap}
th[data-rf-ordenable]:hover{background:rgba(0,0,0,.04)}
th[data-rf-orden="asc"]::after{content:" ▲";font-size:9px;color:#ea580c}
th[data-rf-orden="desc"]::after{content:" ▼";font-size:9px;color:#ea580c}
.rf-barra{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #eee;background:#fafafa;font-size:12px}
.rf-barra input[type=search]{flex:1 1 180px;min-width:140px;max-width:320px;padding:5px 9px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:12px}
.rf-barra select{padding:4px 6px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:12px;max-width:170px}
.rf-barra button{padding:4px 9px;border:1px solid #ddd;border-radius:8px;background:#fff;font-weight:600;cursor:pointer}
.rf-barra button:hover{background:#f3f3f3}
.rf-barra .rf-cuenta{color:#888;margin-left:auto;white-space:nowrap}
.rf-pop{position:fixed;z-index:10000;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);padding:8px 10px;max-height:60vh;overflow:auto;font-size:12px;min-width:180px}
.rf-pop label{display:flex;gap:6px;align-items:center;padding:3px 0;cursor:pointer;white-space:nowrap}
[data-rf-nota]{display:inline-flex!important;align-items:center;justify-content:center;width:18px!important;height:18px!important;min-width:0!important;padding:0!important;margin:2px 0!important;border:0!important;background:none!important;box-shadow:none!important;font-size:0!important;line-height:0!important;color:transparent!important;overflow:hidden!important;cursor:help;vertical-align:middle;flex:0 0 auto!important}
[data-rf-nota]::before{content:"i";display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1.5px solid #a3a3a3;color:#737373;font:italic 700 11px/1 Georgia,serif}
[data-rf-nota]:hover::before,[data-rf-nota]:focus::before{border-color:#ea580c;color:#ea580c}
.rf-nube{position:fixed;z-index:10001;max-width:min(360px,86vw);background:#262626;color:#fff;font-size:12px;line-height:1.45;padding:9px 11px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.25);white-space:pre-line;pointer-events:none}
@media print{.rf-barra,.rf-nube,.rf-pop{display:none!important}}
/* V102: en el móvil, por defecto, tabla compacta que cabe en la pantalla (columnas menos importantes ocultas
   si no caben); opción «▦ Tarjetas» en la barra para ver cada fila como tarjeta «etiqueta: valor» */
.rf-solo-movil{display:none!important}
@media (max-width:700px){
.rf-barra .rf-solo-movil{display:inline-block!important}
table[data-rf-tabla]:not([data-rf-movil]){font-size:12px;width:100%!important;min-width:0!important}
table[data-rf-tabla]:not([data-rf-movil])>*>tr>th,table[data-rf-tabla]:not([data-rf-movil])>*>tr>td{padding:6px 5px!important;white-space:normal!important;word-break:break-word;min-width:0!important;max-width:none!important}
table[data-rf-tabla]:not([data-rf-movil])>thead>tr>th{font-size:10px!important;letter-spacing:0!important;line-height:1.2}
table[data-rf-tabla]:not([data-rf-movil])>*>tr>th,table[data-rf-tabla]:not([data-rf-movil])>*>tr>td{word-break:normal!important;overflow-wrap:normal!important}
table[data-rf-tabla]:not([data-rf-movil])>thead>tr>th{overflow-wrap:normal!important;hyphens:auto}
table[data-rf-tabla]:not([data-rf-movil]) td[data-rf-titulo]>:first-child{white-space:nowrap!important}
table[data-rf-tabla]:not([data-rf-movil]) td .flex:has(>button){display:grid!important;grid-template-columns:repeat(3,auto);justify-content:end;gap:2px!important}
table[data-rf-tabla]>thead>tr>th svg,table[data-rf-tabla]>thead>tr>th button{display:none!important}
table[data-rf-tabla]:not([data-rf-movil]) td .flex{flex-wrap:wrap;gap:2px!important}
table[data-rf-tabla]:not([data-rf-movil]) td button,table[data-rf-tabla]:not([data-rf-movil]) td a{padding:4px!important}
table[data-rf-tabla]:not([data-rf-movil]) td svg{width:15px;height:15px}
table[data-rf-tabla]:not([data-rf-movil]) td .text-lg,table[data-rf-tabla]:not([data-rf-movil]) td .text-base,table[data-rf-tabla]:not([data-rf-movil]) td .text-xl,table[data-rf-tabla]:not([data-rf-movil]) td .text-2xl,table[data-rf-tabla]:not([data-rf-movil]) td.text-lg,table[data-rf-tabla]:not([data-rf-movil]) td.text-base,table[data-rf-tabla]:not([data-rf-movil]) td.text-sm,table[data-rf-tabla]:not([data-rf-movil]) td .text-sm{font-size:12px!important}
table[data-rf-tabla]:not([data-rf-movil]) td .rounded-full,table[data-rf-tabla]:not([data-rf-movil]) td [class*="px-2"]{white-space:normal!important;padding-left:5px!important;padding-right:5px!important}
}
/* V101: modo tarjetas (solo si se elige) */
@media (max-width:700px){
table[data-rf-movil]{display:block!important;width:100%!important;min-width:0!important;border:0!important;background:transparent!important}
table[data-rf-movil]>thead{display:none!important}
table[data-rf-movil]>tbody,table[data-rf-movil]>tfoot{display:block!important;width:100%!important}
table[data-rf-movil]>tbody>tr,table[data-rf-movil]>tfoot>tr{display:block!important;margin:8px 0!important;padding:8px 12px!important;border:1px solid #e5e5e5!important;border-radius:14px!important;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.04)}
table[data-rf-movil]>tbody>tr>td,table[data-rf-movil]>tfoot>tr>td{display:flex!important;align-items:center;justify-content:space-between;gap:12px;width:auto!important;min-width:0!important;max-width:none!important;padding:5px 0!important;border:0!important;border-bottom:1px dashed #f0f0f0!important;text-align:right!important;white-space:normal!important;word-break:break-word}
table[data-rf-movil]>tbody>tr>td:last-child{border-bottom:0!important}
table[data-rf-movil]>tbody>tr>td::before,table[data-rf-movil]>tfoot>tr>td::before{content:attr(data-rf-label);flex:0 0 auto;max-width:45%;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.02em;color:#8a8a8a}
table[data-rf-movil] td[data-rf-label=""]::before{display:none}
table[data-rf-movil] td[data-rf-label=""]{justify-content:flex-end;flex-wrap:wrap}
table[data-rf-movil]>tbody>tr>td[data-rf-titulo]{font-size:15px!important;font-weight:700;justify-content:flex-start;text-align:left!important;border-bottom:1px solid #eee!important}
table[data-rf-movil]>tbody>tr>td[data-rf-titulo]::before{display:none}
table[data-rf-movil] td[colspan]{display:block!important;text-align:center!important}
table[data-rf-movil] td[colspan]::before{display:none}
table[data-rf-movil] td>div,table[data-rf-movil] td>span{max-width:100%}
.rf-barra{padding:8px 6px}
.rf-barra .rf-cuenta{margin-left:0;width:100%}
/* filas de cabecera (título + botones) y barras de acciones: bajan de línea en vez de salirse */
main .flex.justify-between,main .flex.justify-end,main .flex.gap-2,main .flex.gap-3,main .flex.gap-4{flex-wrap:wrap}
main .flex.justify-between>*{min-width:0}
/* selectores de pestañas y botones en fila: se desplazan con el dedo */
main .inline-flex.rounded-xl,main .overflow-x-auto{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}
main h1{font-size:1.6rem!important;line-height:1.15!important;word-break:break-word}
main .grid{min-width:0}
main .grid>*{min-width:0}
}
`;

// ---------- valores para ordenar ----------
function valorCelda(td) {
  if (!td) return { t: '', n: null };
  const campo = td.querySelector('input:not([type=checkbox]),select,textarea');
  const txt = (campo ? campo.value : td.textContent || '').replace(/\s+/g, ' ').trim();
  const f = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (f) return { t: txt, n: Number(`${f[3].length === 2 ? '20' + f[3] : f[3]}${f[2].padStart(2, '0')}${f[1].padStart(2, '0')}`) };
  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { t: txt, n: Number(iso[1] + iso[2] + iso[3]) };
  const num = txt.replace(/[€%\s]|(?<=\d)\s?(kg|g|ud|uds|l|L|días|d)$/g, '');
  if (/^[-−+]?\d[\d.]*(,\d+)?$/.test(num)) return { t: txt, n: parseFloat(num.replace('−', '-').replace(/\./g, '').replace(',', '.')) };
  if (/^[-−+]?\d+(\.\d+)?$/.test(num)) return { t: txt, n: parseFloat(num.replace('−', '-')) };
  return { t: txt, n: null };
}
const comparar = (a, b) => {
  if (a.t === '' && b.t !== '') return 1;
  if (b.t === '' && a.t !== '') return -1;
  if (a.n !== null && b.n !== null) return a.n - b.n;
  return a.t.localeCompare(b.t, 'es', { numeric: true, sensitivity: 'base' });
};

// ---------- estado por tabla ----------
const estados = new WeakMap();
let ocupado = false;
let estiloColumnas = null;
let contadorTablas = 0;

const cabeceras = (tabla) => {
  const filas = tabla.tHead ? tabla.tHead.rows : null;
  return filas && filas.length ? [...filas[filas.length - 1].cells] : [];
};
const textoCabecera = (th) => (th.textContent || '').replace(/[▲▼]/g, '').replace(/\s+/g, ' ').trim();
// Filas agrupadas: una fila de detalle (una sola celda que ocupa varias columnas) va con la anterior
function grupos(tbody) {
  const out = [];
  for (const tr of tbody.rows) {
    const detalle = tr.cells.length === 1 && tr.cells[0].colSpan > 1;
    if (detalle && out.length) out[out.length - 1].push(tr); else out.push([tr]);
  }
  return out;
}
const esVacia = (g) => g.length === 1 && g[0].cells.length === 1 && g[0].cells[0].colSpan > 1;
// Filas de totales dentro del tbody: se quedan al final y no se filtran
const esTotal = (g) => /^\s*total/i.test(g[0].cells[0]?.textContent || '');

function claveTabla(tabla, ths) {
  const seccion = (tabla.closest('[data-rf-seccion]')?.getAttribute('data-rf-seccion')) || (document.querySelector('h1')?.textContent || '').slice(0, 40);
  return normal(seccion) + '|' + ths.map(textoCabecera).join('|').slice(0, 200);
}

function aplicar(tabla, st) {
  const tbody = tabla.tBodies[0];
  if (!tbody) return;
  const todos = grupos(tbody).filter(g => !esVacia(g));
  const gs = todos.filter(g => !esTotal(g));
  const fijos = todos.filter(esTotal);
  // Orden
  if (st.orden && gs.length > 1) {
    const { col, dir } = st.orden;
    const ord = gs.map((g, i) => ({ g, i, v: valorCelda(g[0].cells[col]) }))
      .sort((a, b) => (comparar(a.v, b.v) * (dir === 'desc' ? -1 : 1)) || a.i - b.i);
    const actual = [...tbody.rows];
    const deseado = [...ord.flatMap(x => x.g), ...fijos.flat()];
    if (deseado.some((tr, i) => actual[i] !== tr)) {
      ocupado = true;
      for (const tr of deseado) tbody.appendChild(tr);
      ocupado = false;
    }
  }
  // Filtros
  const q = normal(st.busca);
  let visibles = 0;
  for (const g of gs) {
    let ok = !q || g.some(tr => normal(tr.textContent).includes(q));
    if (ok) for (const [col, val] of Object.entries(st.filtros)) {
      if (val !== '' && normal(valorCelda(g[0].cells[col]).t) !== val) { ok = false; break; }
    }
    for (const tr of g) { if (ok) tr.removeAttribute('data-rf-oculta'); else tr.setAttribute('data-rf-oculta', ''); }
    if (ok) visibles++;
  }
  st.total = gs.length; st.visibles = visibles;
  ths(tabla).forEach((th, i) => {
    if (st.orden && st.orden.col === i) th.setAttribute('data-rf-orden', st.orden.dir); else th.removeAttribute('data-rf-orden');
  });
  if (st.barra) actualizarBarra(tabla, st);
}
const ths = (tabla) => cabeceras(tabla);

function reglasColumnas() {
  if (!estiloColumnas) { estiloColumnas = document.createElement('style'); estiloColumnas.id = 'rf-columnas'; document.head.appendChild(estiloColumnas); }
  const reglas = [];
  document.querySelectorAll('table[data-rf-tabla]').forEach(t => {
    const st = estados.get(t);
    (st?.ocultas || []).forEach(i => reglas.push(`table[data-rf-tabla="${t.getAttribute('data-rf-tabla')}"] tr>:nth-child(${i + 1}){display:none}`));
  });
  const movil = [];
  document.querySelectorAll('table[data-rf-tabla]').forEach(t => {
    const st = estados.get(t);
    (st?.auto || []).forEach(i => movil.push(`table[data-rf-tabla="${t.getAttribute('data-rf-tabla')}"]:not([data-rf-movil]) tr>:nth-child(${i + 1}){display:none}`));
  });
  if (movil.length) reglas.push(`@media (max-width:700px){${movil.join('\n')}}`);
  const css = reglas.join('\n');
  if (estiloColumnas.textContent !== css) estiloColumnas.textContent = css;
}

// ---------- barra ----------
let popAbierto = null;
const cerrarPop = () => { if (popAbierto) { popAbierto.remove(); popAbierto = null; } };
function abrirPop(boton, contenido) {
  cerrarPop();
  const pop = document.createElement('div');
  pop.className = 'rf-pop';
  pop.appendChild(contenido);
  document.body.appendChild(pop);
  const r = boton.getBoundingClientRect();
  pop.style.top = `${Math.min(r.bottom + 4, window.innerHeight - 60)}px`;
  pop.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - pop.offsetWidth - 8))}px`;
  popAbierto = pop;
}

function crearBarra(tabla, st) {
  const barra = document.createElement('div');
  barra.className = 'rf-barra';
  barra.setAttribute('data-rf-no', '');
  const busca = document.createElement('input');
  busca.type = 'search'; busca.placeholder = '🔍 Buscar en la tabla…';
  busca.addEventListener('input', () => { st.busca = busca.value; aplicar(tabla, st); });
  const bFiltros = document.createElement('button'); bFiltros.type = 'button'; bFiltros.textContent = '⚲ Filtros';
  bFiltros.addEventListener('click', (e) => { e.stopPropagation(); abrirPop(bFiltros, panelFiltros(tabla, st)); });
  const bCols = document.createElement('button'); bCols.type = 'button'; bCols.textContent = '▦ Columnas';
  bCols.addEventListener('click', (e) => { e.stopPropagation(); abrirPop(bCols, panelColumnas(tabla, st)); });
  const bLimpiar = document.createElement('button'); bLimpiar.type = 'button'; bLimpiar.textContent = '✕ Limpiar';
  bLimpiar.addEventListener('click', () => { st.busca = ''; busca.value = ''; st.filtros = {}; st.orden = null; guardar(st); aplicar(tabla, st); });
  const bVista = document.createElement('button'); bVista.type = 'button'; bVista.className = 'rf-solo-movil';
  bVista.addEventListener('click', () => { st.vista = st.vista === 'tarjetas' ? 'tabla' : 'tarjetas'; guardar(st); prepararTabla(tabla); });
  const cuenta = document.createElement('span'); cuenta.className = 'rf-cuenta';
  barra.append(busca, bFiltros, bCols, bVista, bLimpiar, cuenta);
  st.elVista = bVista;
  st.barra = barra; st.elBusca = busca; st.elLimpiar = bLimpiar; st.elCuenta = cuenta; st.elFiltros = bFiltros;
  return barra;
}
function actualizarBarra(tabla, st) {
  const nf = Object.values(st.filtros).filter(v => v !== '').length;
  st.elFiltros.textContent = nf ? `⚲ Filtros (${nf})` : '⚲ Filtros';
  st.elLimpiar.style.display = (st.busca || nf || st.orden) ? '' : 'none';
  st.elCuenta.textContent = (st.visibles === st.total ? `${st.total} filas` : `${st.visibles} de ${st.total}`)
    + (esMovil() && st.vista !== 'tarjetas' && st.auto.length ? ` · ${st.auto.length} columna${st.auto.length > 1 ? 's' : ''} oculta${st.auto.length > 1 ? 's' : ''} para que quepa (▦ Columnas)` : '');
  if (st.elVista) st.elVista.textContent = st.vista === 'tarjetas' ? '☰ Ver como tabla' : '▦ Ver como tarjetas';
}
function panelColumnas(tabla, st) {
  const box = document.createElement('div');
  const titulo = document.createElement('div'); titulo.style.cssText = 'font-weight:700;margin-bottom:4px'; titulo.textContent = 'Columnas que se ven';
  box.appendChild(titulo);
  ths(tabla).forEach((th, i) => {
    const nombre = textoCabecera(th);
    if (!nombre) return;
    const l = document.createElement('label');
    const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !st.ocultas.includes(i) && !(esMovil() && st.auto.includes(i));
    c.addEventListener('change', () => {
      st.ocultas = c.checked ? st.ocultas.filter(x => x !== i) : [...st.ocultas, i];
      // V102: en el móvil, marcar una columna que se había ocultado por espacio la deja fija a la vista
      if (esMovil()) st.forzadasMovil = c.checked ? [...new Set([...st.forzadasMovil, i])] : st.forzadasMovil.filter(x => x !== i);
      guardar(st); st.firmaMovil = ''; ajustarMovil(tabla, st); reglasColumnas(); aplicar(tabla, st);
    });
    l.append(c, document.createTextNode(nombre));
    box.appendChild(l);
  });
  return box;
}
function panelFiltros(tabla, st) {
  const box = document.createElement('div');
  const tbody = tabla.tBodies[0];
  const gs = tbody ? grupos(tbody).filter(g => !esVacia(g) && !esTotal(g)) : [];
  let hay = false;
  ths(tabla).forEach((th, i) => {
    const nombre = textoCabecera(th);
    if (!nombre) return;
    const vals = new Map();
    for (const g of gs) { const v = valorCelda(g[0].cells[i]).t; if (v && v.length <= 40) vals.set(normal(v), v); }
    if (vals.size < 2 || vals.size > MAX_VALORES_FILTRO) return;
    hay = true;
    const l = document.createElement('label'); l.style.justifyContent = 'space-between';
    const s = document.createElement('select');
    s.innerHTML = '<option value="">Todos</option>';
    [...vals.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es', { numeric: true })).forEach(([k, v]) => { const o = document.createElement('option'); o.value = k; o.textContent = v; s.appendChild(o); });
    s.value = st.filtros[i] || '';
    s.addEventListener('change', () => { st.filtros[i] = s.value; aplicar(tabla, st); });
    l.append(document.createTextNode(nombre), s);
    box.appendChild(l);
  });
  if (!hay) { box.textContent = 'Esta tabla no tiene columnas con pocos valores para filtrar. Usa el buscador.'; box.style.maxWidth = '240px'; box.style.whiteSpace = 'normal'; }
  return box;
}
function guardar(st) {
  const p = leerPrefs();
  p[st.clave] = { orden: st.orden, ocultas: st.ocultas, vista: st.vista, forzadasMovil: st.forzadasMovil };
  guardarPrefs(p);
}

// Dónde va la barra: encima del contenedor con scroll de la tabla (si solo tiene la tabla), o encima de la tabla
function anclaBarra(tabla) {
  const padre = tabla.parentElement;
  if (padre && padre.children.length === 1 && padre !== document.body && /overflow/.test(padre.className || '')) return padre;
  return tabla;
}

function prepararTabla(tabla) {
  if (tabla.closest('[data-rf-no]') || !tabla.tBodies[0]) return;
  const hs = ths(tabla);
  if (hs.length < 2) return;
  let st = estados.get(tabla);
  if (!st) {
    const clave = claveTabla(tabla, hs);
    const pref = leerPrefs()[clave] || {};
    st = { clave, orden: pref.orden || null, ocultas: pref.ocultas || [], vista: pref.vista || 'tabla', forzadasMovil: pref.forzadasMovil || [], auto: [], firmaMovil: '', busca: '', filtros: {}, barra: null };
    estados.set(tabla, st);
    tabla.setAttribute('data-rf-tabla', String(++contadorTablas));
  }
  // V102: tarjetas en el móvil solo si se eligen (botón de la barra); etiquetas = texto de la cabecera
  const tarjetas = hs.length >= 4 && st.vista === 'tarjetas';
  if (tarjetas && !tabla.hasAttribute('data-rf-movil')) tabla.setAttribute('data-rf-movil', '');
  if (!tarjetas && tabla.hasAttribute('data-rf-movil')) tabla.removeAttribute('data-rf-movil');
  if (hs.length >= 4) {
    const etiquetas = hs.map(textoCabecera);
    const iTitulo = etiquetas.findIndex(t => t);
    for (const tbody of tabla.tBodies) for (const tr of tbody.rows) {
      if (tr.cells.length !== hs.length) continue;
      [...tr.cells].forEach((td, i) => {
        const l = etiquetas[i] || '';
        if (td.getAttribute('data-rf-label') !== l) td.setAttribute('data-rf-label', l);
        if (i === iTitulo) { if (!td.hasAttribute('data-rf-titulo')) td.setAttribute('data-rf-titulo', ''); }
      });
    }
  }
  // Cabeceras ordenables (las que tienen texto y no llevan controles dentro)
  hs.forEach((th, i) => {
    if (th.hasAttribute('data-rf-ordenable') || !textoCabecera(th) || th.querySelector('input,button,select')) return;
    th.setAttribute('data-rf-ordenable', '');
    th.title = th.title || 'Pulsa para ordenar';
    th.addEventListener('click', () => {
      const idx = ths(tabla).indexOf(th);
      st.orden = !st.orden || st.orden.col !== idx ? { col: idx, dir: 'asc' } : st.orden.dir === 'asc' ? { col: idx, dir: 'desc' } : null;
      guardar(st); aplicar(tabla, st);
    });
  });
  // Barra solo en tablas con bastantes filas
  const nGrupos = grupos(tabla.tBodies[0]).filter(g => !esVacia(g)).length;
  if (!st.barra && nGrupos >= MIN_FILAS_BARRA) crearBarra(tabla, st);
  if (st.barra) {
    const ancla = anclaBarra(tabla);
    if (st.barra.nextSibling !== ancla || st.barra.parentNode !== ancla.parentNode) { ocupado = true; ancla.parentNode.insertBefore(st.barra, ancla); ocupado = false; }
  }
  ajustarMovil(tabla, st);
  aplicar(tabla, st);
}

// V102: en el móvil, si la tabla no cabe, oculta columnas de derecha a izquierda (primero las secundarias;
// nunca la primera con texto, ni las de botones/casillas, ni las que el usuario marcó en ▦ Columnas)
const esMovil = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width:700px)').matches;
const IMPORTANTE = /total|importe|estado|cliente|fecha|nombre|n[ºo°]|factura|pedido|albar|producto|concepto/i;
function ajustarMovil(tabla, st) {
  const hs = ths(tabla);
  const ancla = anclaBarra(tabla);
  const cont = ancla === tabla ? tabla.parentElement : ancla;
  if (!cont) return;
  const firma = [esMovil(), st.vista, hs.length, tabla.tBodies[0]?.rows.length, cont.clientWidth, st.ocultas.join('.'), st.forzadasMovil.join('.')].join('|');
  if (firma === st.firmaMovil) return;
  st.firmaMovil = firma;
  const antes = st.auto.join(',');
  st.auto = [];
  if (esMovil() && st.vista !== 'tarjetas' && hs.length >= 3) {
    reglasColumnas();
    const etiq = hs.map(textoCabecera);
    const iTitulo = etiq.findIndex(t => t);
    // columnas de botones (acciones) o casillas: nunca se ocultan, hacen falta en el móvil
    const fila = [...(tabla.tBodies[0]?.rows || [])].find(tr => tr.cells.length === hs.length);
    const conControles = (i) => /acci/i.test(etiq[i]) || !!(fila && fila.cells[i] && fila.cells[i].querySelector('button,a,input,select'));
    // orden en que se sacrifican las importantes si aún no cabe: fechas, otras, estado, cliente y, lo último, importes
    const peso = (t) => /fecha|vence|venc/i.test(t) ? 0 : /total|importe/i.test(t) ? 4 : /cliente|nombre|producto|concepto/i.test(t) ? 3 : /estado/i.test(t) ? 2 : 1;
    const candidatas = (fase) => hs.map((_, i) => i).reverse().filter(i => i !== iTitulo && etiq[i] && !conControles(i) && !st.ocultas.includes(i) && !st.auto.includes(i)
      && !st.forzadasMovil.includes(i) && (fase === 2 || !IMPORTANTE.test(etiq[i])))
      .sort((a, b) => fase === 2 ? peso(etiq[a]) - peso(etiq[b]) : 0);
    for (const fase of [1, 2]) {
      let vueltas = 0;
      while (tabla.scrollWidth > cont.clientWidth + 1 && vueltas++ < 30) {
        const c = candidatas(fase)[0];
        if (c === undefined) break;
        st.auto.push(c); reglasColumnas();
      }
    }
    // segunda pasada: vuelve a mostrar (de más a menos importante) las que sí caben
    for (const c of [...st.auto].sort((a, b) => peso(etiq[b]) - peso(etiq[a]))) {
      st.auto = st.auto.filter(x => x !== c); reglasColumnas();
      if (tabla.scrollWidth > cont.clientWidth + 1) { st.auto.push(c); reglasColumnas(); }
    }
  }
  if (st.auto.join(',') !== antes) reglasColumnas();
}

// ---------- notas informativas ----------
const CLASE_PEQUENA = /(^|\s)text-(xs|\[1[01]px\]|\[10px\]|\[9px\])(\s|$)/;
const CLASE_GRIS = /(^|\s)text-(neutral|gray|slate|stone)-(400|500|600)(\s|$)/;
const AVISO = /^\s*(⚠|❌|⛔|🔴|🛑|✅|❗)/u;
function esNota(el) {
  const cls = el.className;
  if (typeof cls !== 'string' || el.hasAttribute('data-rf-nota')) return false;
  const pequenaGris = CLASE_PEQUENA.test(cls) && CLASE_GRIS.test(cls);
  const tip = !pequenaGris && el.childElementCount <= 4 && /^\s*💡/u.test(el.firstChild ? el.firstChild.textContent || '' : '');
  if (!pequenaGris && !tip) return false;
  if (el.closest('[data-rf-no],table,nav,aside,header,.rf-barra,.rf-pop,label,button,a')) return false;
  const texto = (el.textContent || '').replace(/\s+/g, ' ').trim();
  if (texto.length < 55 || AVISO.test(texto)) return false;
  if (el.querySelector('a,button,input,select,textarea,table,ul,ol,img,canvas,[data-rf-nota]')) return false;
  return true;
}
function prepararNotas(raiz) {
  raiz.querySelectorAll('p,div,span').forEach(el => {
    if (!esNota(el)) return;
    el.setAttribute('data-rf-nota', '');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', 'Información');
  });
  raiz.querySelectorAll('[data-rf-nota]').forEach(el => {
    const t = (el.innerText || el.textContent || '').trim();
    if (el.getAttribute('data-rf-texto') !== t) el.setAttribute('data-rf-texto', t);
  });
}
let nube = null;
function mostrarNube(el) {
  if (!nube) { nube = document.createElement('div'); nube.className = 'rf-nube'; document.body.appendChild(nube); }
  nube.textContent = el.getAttribute('data-rf-texto') || el.textContent || '';
  nube.style.display = 'block';
  const r = el.getBoundingClientRect();
  const w = nube.offsetWidth, h = nube.offsetHeight;
  let top = r.bottom + 6; if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
  nube.style.top = `${top}px`;
  nube.style.left = `${Math.max(8, Math.min(r.left - 4, window.innerWidth - w - 8))}px`;
}
const ocultarNube = () => { if (nube) nube.style.display = 'none'; };

// ---------- arranque ----------
export function activarMejorasUI(raiz) {
  if (!raiz || typeof document === 'undefined') return () => {};
  if (!document.getElementById('rf-estilos')) {
    const s = document.createElement('style'); s.id = 'rf-estilos'; s.textContent = CSS; document.head.appendChild(s);
  }
  let pendiente = null;
  const repasar = () => {
    pendiente = null;
    try {
      raiz.querySelectorAll('table').forEach(prepararTabla);
      // barras huérfanas (su tabla ya no está)
      raiz.querySelectorAll('.rf-barra').forEach(b => { if (!b.nextElementSibling || !(b.nextElementSibling.matches('table') || b.nextElementSibling.querySelector('table'))) b.remove(); });
      reglasColumnas();
      prepararNotas(raiz);
    } catch (e) { console.warn('mejoras UI', e); }
  };
  const programar = () => { if (!ocupado && !pendiente) pendiente = setTimeout(repasar, 120); };
  const obs = new MutationObserver((ms) => { if (!ocupado && ms.some(m => !(m.target.closest && m.target.closest('.rf-barra')))) programar(); });
  obs.observe(raiz, { childList: true, subtree: true, characterData: true });
  repasar();
  const sobre = (e) => { const n = e.target.closest && e.target.closest('[data-rf-nota]'); if (n) mostrarNube(n); };
  const fuera = (e) => { const n = e.target.closest && e.target.closest('[data-rf-nota]'); if (n && !(e.relatedTarget && n.contains(e.relatedTarget))) ocultarNube(); };
  const clic = (e) => {
    const n = e.target.closest && e.target.closest('[data-rf-nota]');
    if (n) { e.preventDefault(); mostrarNube(n); return; }
    if (popAbierto && !popAbierto.contains(e.target)) cerrarPop();
    ocultarNube();
  };
  document.addEventListener('mouseover', sobre);
  document.addEventListener('mouseout', fuera);
  document.addEventListener('focusin', sobre);
  document.addEventListener('focusout', ocultarNube);
  document.addEventListener('click', clic, true);
  window.addEventListener('scroll', ocultarNube, true);
  const alGirar = () => programar(); // V102: al girar el móvil o cambiar el tamaño se recalcula qué columnas caben
  window.addEventListener('resize', alGirar);
  return () => {
    window.removeEventListener('resize', alGirar);
    obs.disconnect();
    document.removeEventListener('mouseover', sobre); document.removeEventListener('mouseout', fuera);
    document.removeEventListener('focusin', sobre); document.removeEventListener('focusout', ocultarNube);
    document.removeEventListener('click', clic, true); window.removeEventListener('scroll', ocultarNube, true);
    cerrarPop(); ocultarNube();
  };
}
