// V117: genera src/modoOscuro.css (node scripts/generar-modo-oscuro.cjs > src/modoOscuro.css)
const C = { // [500, 300, 400]
  red:['239,68,68','#fca5a5','#f87171'], orange:['249,115,22','#fdba74','#fb923c'], amber:['245,158,11','#fcd34d','#fbbf24'],
  yellow:['234,179,8','#fde047','#facc15'], lime:['132,204,22','#bef264','#a3e635'], green:['34,197,94','#86efac','#4ade80'],
  emerald:['16,185,129','#6ee7b7','#34d399'], teal:['20,184,166','#5eead4','#2dd4bf'], cyan:['6,182,212','#67e8f9','#22d3ee'],
  sky:['14,165,233','#7dd3fc','#38bdf8'], blue:['59,130,246','#93c5fd','#60a5fa'], indigo:['99,102,241','#a5b4fc','#818cf8'],
  violet:['139,92,246','#c4b5fd','#a78bfa'], purple:['168,85,247','#d8b4fe','#c084fc'], fuchsia:['217,70,239','#f0abfc','#e879f9'],
  pink:['236,72,153','#f9a8d4','#f472b6'], rose:['244,63,94','#fda4af','#fb7185'],
};
const N = ['neutral','gray','slate','zinc','stone'];
const P = 'html.rf-oscuro ';
const out = [];
const r = (sel, body) => out.push(`${sel}{${body}}`);
const esc = (s) => s.replace(/:/g, '\\:').replace(/\//g, '\\/');
// superficies
const SURF = { white:'#262626', 50:'#2a2a2a', 100:'#303030', 200:'#3a3a3a', 300:'#474747' };
r(`${P}.bg-white,${P}.bg-white\\/80,${P}.bg-white\\/90,${P}.bg-white\\/95,${P}.bg-white\\/70,${P}.bg-white\\/60,${P}.bg-white\\/50`, `background-color:${SURF.white}`);
r(`${P}.hover\\:bg-white:hover`, `background-color:${SURF[100]}`);
for (const n of N) {
  for (const k of [50,100,200,300]) {
    r(`${P}.bg-${n}-${k}`, `background-color:${SURF[k]}`);
    r(`${P}.${esc(`hover:bg-${n}-${k}`)}:hover`, `background-color:${SURF[Math.min(300, k === 50 ? 100 : k + 100)] || SURF[300]}`);
  }
  const TX = { 950:'#fafafa', 900:'#f5f5f5', 800:'#ededed', 700:'#e0e0e0', 600:'#cfcfcf', 500:'#a8a8a8', 400:'#8f8f8f' };
  for (const [k, v] of Object.entries(TX)) { r(`${P}.text-${n}-${k}`, `color:${v}`); r(`${P}.${esc(`hover:text-${n}-${k}`)}:hover`, `color:#fff`); }
  for (const k of [100,200,300]) { r(`${P}.border-${n}-${k},${P}.divide-${n}-${k}>*+*`, `border-color:${k===300?'#4a4a4a':'#3a3a3a'}`); }
}
r(`${P}.text-black`, 'color:#f5f5f5');
r(`:where(html.rf-oscuro) *,:where(html.rf-oscuro) ::before,:where(html.rf-oscuro) ::after`, 'border-color:#3a3a3a'); // sin especificidad: los bordes de color siguen ganando
// colores
for (const [c, [rgb, t300, t400]] of Object.entries(C)) {
  r(`${P}.bg-${c}-50`, `background-color:rgba(${rgb},.10)`);
  r(`${P}.bg-${c}-100`, `background-color:rgba(${rgb},.17)`);
  r(`${P}.bg-${c}-200`, `background-color:rgba(${rgb},.26)`);
  for (const k of [50,100,200]) r(`${P}.${esc(`hover:bg-${c}-${k}`)}:hover`, `background-color:rgba(${rgb},.28)`);
  r(`${P}.text-${c}-950,${P}.text-${c}-900,${P}.text-${c}-800,${P}.text-${c}-700`, `color:${t300}`);
  r(`${P}.text-${c}-600`, `color:${t400}`);
  r(`${P}.border-${c}-100,${P}.border-${c}-200,${P}.border-${c}-300`, `border-color:rgba(${rgb},.40)`);
  r(`${P}.from-${c}-50,${P}.from-${c}-100`, `--tw-gradient-from:rgba(${rgb},.14) var(--tw-gradient-from-position);--tw-gradient-to:rgba(${rgb},0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)`);
  r(`${P}.to-${c}-50,${P}.to-${c}-100`, `--tw-gradient-to:rgba(${rgb},.08) var(--tw-gradient-to-position)`);
  r(`${P}.via-${c}-50,${P}.via-${c}-100`, `--tw-gradient-stops:var(--tw-gradient-from),rgba(${rgb},.10) var(--tw-gradient-via-position),var(--tw-gradient-to)`);
}
for (const n of N) {
  r(`${P}.from-${n}-50,${P}.from-${n}-100,${P}.from-white`, `--tw-gradient-from:#2a2a2a var(--tw-gradient-from-position);--tw-gradient-to:rgba(42,42,42,0) var(--tw-gradient-to-position);--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to)`);
  r(`${P}.to-${n}-50,${P}.to-${n}-100,${P}.to-white`, `--tw-gradient-to:#262626 var(--tw-gradient-to-position)`);
}
const fijo = `
/* V117: modo oscuro completo (archivo generado con scripts/generar-modo-oscuro.cjs). Se activa con la clase rf-oscuro en <html> (botón 🌙 de la cabecera). */
html.rf-oscuro{color-scheme:dark}
html.rf-oscuro body{background-color:#171717;color:#e5e5e5}
html.rf-oscuro ::-webkit-scrollbar-track{background:#1f1f1f}
html.rf-oscuro ::-webkit-scrollbar-thumb{background:#3f3f3f}
html.rf-oscuro ::selection{background-color:#9a3412;color:#fff}
html.rf-oscuro input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),html.rf-oscuro select,html.rf-oscuro textarea{background-color:#1c1c1c;color:#f0f0f0;border-color:#444}
html.rf-oscuro input::placeholder,html.rf-oscuro textarea::placeholder{color:#7a7a7a}
html.rf-oscuro option{background:#262626;color:#f0f0f0}
html.rf-oscuro input:disabled,html.rf-oscuro select:disabled,html.rf-oscuro textarea:disabled{background-color:#2a2a2a;color:#9a9a9a}
html.rf-oscuro thead,html.rf-oscuro thead tr,html.rf-oscuro th{border-color:#3a3a3a}
html.rf-oscuro td{border-color:#333}
html.rf-oscuro .shadow-sm,html.rf-oscuro .shadow,html.rf-oscuro .shadow-md,html.rf-oscuro .shadow-lg,html.rf-oscuro .shadow-xl,html.rf-oscuro .shadow-2xl{--tw-shadow-color:rgba(0,0,0,.6)}
html.rf-oscuro .shimmer{background:linear-gradient(90deg,#262626 25%,#333 50%,#262626 75%);background-size:200% 100%}
html.rf-oscuro [style*="background: white"],html.rf-oscuro [style*="background:white"],html.rf-oscuro [style*="background-color: white"],html.rf-oscuro [style*="background: rgb(255, 255, 255)"],html.rf-oscuro [style*="background-color: rgb(255, 255, 255)"],html.rf-oscuro [style*="background: #fff"],html.rf-oscuro [style*="background-color: #fff"]{background:#262626!important;color:#e5e5e5}
/* Gráficos (recharts y SVG propios) */
html.rf-oscuro .recharts-default-tooltip{background:#262626!important;border-color:#444!important;color:#eee}
html.rf-oscuro .recharts-cartesian-axis-tick-value,html.rf-oscuro .recharts-legend-item-text,html.rf-oscuro .recharts-label{fill:#b5b5b5}
html.rf-oscuro .recharts-cartesian-grid line{stroke:#3a3a3a}
html.rf-oscuro svg rect[fill="#fff"],html.rf-oscuro svg rect[fill="#ffffff"],html.rf-oscuro svg rect[fill="white"]{fill:#262626}
html.rf-oscuro svg text[fill="#1f2937"],html.rf-oscuro svg text[fill="#4b5563"],html.rf-oscuro svg text[fill="#111"],html.rf-oscuro svg text[fill="#111827"],html.rf-oscuro svg text[fill="#171717"],html.rf-oscuro svg text[fill="#262626"],html.rf-oscuro svg text[fill="#333"],html.rf-oscuro svg text[fill="#374151"],html.rf-oscuro svg text[fill="#404040"],html.rf-oscuro svg text[fill="#444"],html.rf-oscuro svg text[fill="#525252"],html.rf-oscuro svg text[fill="#555"],html.rf-oscuro svg text[fill="black"],html.rf-oscuro svg text[fill="#000"]{fill:#e5e5e5}
html.rf-oscuro svg text[fill="#8a8f98"],html.rf-oscuro svg text[fill="#9ca3af"],html.rf-oscuro svg text[fill="#666"],html.rf-oscuro svg text[fill="#737373"],html.rf-oscuro svg text[fill="#6b7280"],html.rf-oscuro svg text[fill="#888"],html.rf-oscuro svg text[fill="#999"]{fill:#a8a8a8}
html.rf-oscuro svg line[stroke="#eef0f3"],html.rf-oscuro svg line[stroke="#e5e7eb"],html.rf-oscuro svg line[stroke="#f3f4f6"],html.rf-oscuro svg line[stroke="#eee"]{stroke:#3a3a3a}
/* Tablas interactivas (V99) */
html.rf-oscuro .rf-barra{background:#222;border-color:#3a3a3a}
html.rf-oscuro .rf-barra input[type=search],html.rf-oscuro .rf-barra select,html.rf-oscuro .rf-barra button{background:#1c1c1c;border-color:#444;color:#eee}
html.rf-oscuro .rf-barra button:hover{background:#333}
html.rf-oscuro .rf-pop{background:#262626;border-color:#444;color:#eee}
html.rf-oscuro th[data-rf-ordenable]:hover{background:rgba(255,255,255,.06)}
html.rf-oscuro table[data-rf-movil]>tbody>tr,html.rf-oscuro table[data-rf-movil]>tfoot>tr{background:#262626;border-color:#3a3a3a!important}
html.rf-oscuro table[data-rf-movil]>tbody>tr>td,html.rf-oscuro table[data-rf-movil]>tfoot>tr>td{border-bottom-color:#333!important}
html.rf-oscuro .rf-nube{background:#3a3a3a}
`;
// Texto oscuro sobre fondos de color intensos (si no, quedaría claro sobre claro)
for (const c of Object.keys(C)) r(`${P}.bg-${c}-300[class*="text-${c}-"],${P}.bg-${c}-400[class*="text-${c}-"]${['amber','yellow','lime'].includes(c) ? `,${P}.bg-${c}-500[class*="text-${c}-"]` : ''}`, 'color:#1a1a1a');
process.stdout.write(fijo + out.join('\n') + '\n');
