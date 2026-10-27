# Rootflow ERP — instrucciones para Claude Code

ERP interno de **Rootflow Hydroponics S.L.** (microbrotes hidropónicos, Madrid). Lo usan los tres socios:
Nico (comercial, administrador único), Guzmán (producción) y Peri (finanzas, quien pide la mayoría de cambios).

- Responde y escribe todo en **español** (UI en es-ES). Peri escribe informal: interpreta la intención y entrega el cambio completo, sin rondas de aprobación salvo que algo sea irreversible o ambiguo de verdad.
- Antes de tocar algo, lee también `docs/PENDIENTES.md` (trabajo abierto) y, si cambias datos, `docs/ESQUEMA-BD.md` (columnas reales de cada tabla).

## Stack y despliegue

- React 18 + Vite 5 + Tailwind 3, lucide-react, recharts, xlsx, jszip. Supabase (Postgres + Auth + Realtime + Storage + Edge Functions). Hosting en Vercel.
- **Todo el front está en un único archivo: `src/App.jsx` (~31.000 líneas, 1,7 MB).** No lo reescribas ni lo trocees sin que te lo pidan: busca con grep y haz ediciones puntuales.
- Supabase: proyecto `deebnsbrvtmstakchxan` (eu-west-1). Variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver `.env.example`; nunca subas `.env`).
- Vercel (proyecto `rootflow-erp-v5`) despliega **producción al hacer push a `main`** (rootflow-erp.vercel.app). Las ramas generan un deploy de Preview.
- ⚠️ Preview y producción usan **la misma base de datos**: probar en Preview escribe datos reales.

## Comandos

```bash
npm install          # una vez por sesión
npm run build        # OBLIGATORIO antes de dar un cambio por terminado: tiene que compilar sin errores
npx esbuild src/App.jsx --loader:.jsx=jsx --outfile=/tmp/t.js   # chequeo rápido de sintaxis (no debe dar warnings nuevos)
```

El aviso de Vite "Some chunks are larger than 500 kB" es normal (todo va en un archivo). `npm install` crea `package-lock.json`: está en `.gitignore` a propósito (Vercel siempre ha instalado sin él); no lo subas salvo que Peri lo pida.

No hay tests automáticos. Para lógica nueva no trivial (cálculos de importes, fechas, IDs), extrae la función a un script de Node y pruébala con casos concretos antes de entregar.

## Versionado (seguir siempre)

- Cada entrega es una versión **Vnn**. La última es **V87**; la siguiente es **V88**. Apúntala en `docs/HISTORIAL.md`.
- Marca el código nuevo o cambiado con comentarios `// V88: ...` (igual que el resto del archivo).
- Si el cambio necesita base de datos, crea `supabase/sql/ROOTFLOW-SQL-V88-<NOMBRE>.sql`:
  - idempotente (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`);
  - tabla nueva = columna `created_at TIMESTAMPTZ DEFAULT NOW()` (obligatoria: `useRealtime` ordena por ella y sin ella la tabla carga sin ordenar) + RLS activado + política `FOR ALL TO authenticated USING (true) WITH CHECK (true)` (**sin `anon`**, aunque los SQL antiguos lo pusieran: ver PENDIENTES) + añadirla a la publicación `supabase_realtime` (copia el bloque `DO $$ … $$` de `supabase/sql/historico/ROOTFLOW-SQL-V80-COMPRAS-PARTICULARES.sql`);
  - termina con `NOTIFY pgrst, 'reload schema';` y `SELECT 'V88 OK — …' AS resultado;`.
- El SQL lo ejecuta Peri en el SQL Editor de Supabase (salvo que tengas una herramienta de Supabase conectada y te lo pida). Díselo siempre al final.
- Mensaje de commit: `V88: <resumen corto>`.

## Arquitectura de `src/App.jsx`

- `src/empresa.js` (V82): `EMPRESA`, `LOGO_URL` y `PORTAL_CLIENTE_URL`, importados por `App.jsx` y por `src/AreaCliente.jsx`.
- `src/AreaCliente.jsx` (V82): área de cliente pública en `/area-cliente?t=<clientes.portal_token>` (la elige `src/main.jsx`; `vercel.json` reescribe la ruta). Solo habla con la Edge Function `portal-cliente`, que filtra por el token con la service role: no le des acceso a tablas con la clave anon.
- `src/serieFacturas.js` (V87): numeración correlativa de facturas emitidas (huecos, orden de fechas, última de la serie, datos de la rectificativa) y cuadre facturas ↔ asientos `FAC-`/`COB-`; lo usan `anularFactura()` y `renderControlSerie()`. **Una factura emitida no se borra nunca**: se anula con `anularFactura(f)` (rectificativa `R-AAAA-NNNN`); solo la última de su serie sin enviar ni cobrar se puede borrar (lo impone un trigger del SQL V87). Si cambias los importes de una factura, llama a `rehacerAsientoFactura(id)`. Estados `anulada` y `rectificativa` (y `tipo: 'anulada'` = número anulado sin importes): exclúyelos en los análisis de ventas.
- `src/rentabilidad.js` (V86): cálculo puro de la cuenta de resultados analítica (margen bruto, EBITDA, EBIT) por mes, variedad, línea y cliente; lo usa `renderRentabilidad()`. Si añades una categoría de gasto, clasifícala en `CLASIFICACION_PYG`. Pruébalo en Node con datos reales antes de tocarlo.
- `portal-cliente` (V83) también genera los PDF de facturas y albaranes y envía las facturas por email (Resend, con el PDF adjunto); el ERP la llama con `invocarPortal({ accion: 'admin_…' })`. Lleva una copia de `EMPRESA`: si cambias `src/empresa.js`, cámbiala también allí.
- Arriba de `App.jsx` (fuera de componentes): constantes globales `SOCIOS`, `TIPOS_IVA`, `IVA_VENTAS = 4`, `RE_VENTAS = 0.5`, `categoriasGasto`, `categoriaProveedorConfig`, componentes UI (`Card`, `Button`, `Input`, `Select`, `Badge`, `Modal`, `StatCard`, `EmptyState`) y el hook `useRealtime(tabla)`.
- `AuthProvider` + `LoginPage` (Supabase Auth, dominio permitido `rootflow.es`).
- `MainApp` (línea ~713) contiene **todo lo demás**: estados, datos, helpers, formularios y secciones. Navegación por `activeSection` (`dashboard`, `pedidos`, `albaranes`, `facturacion`, `gastos`, `contabilidad`, `produccion`, `planificacion`, `calendario`, `clientes`, `tarifas`, `leads`, `desarrollo`, …). Cada sección se pinta con una función `renderXxx()` y algunas tienen pestañas con su propio estado (p. ej. `gastosTab`).
- Datos: `const { data: xData, refetch: refetchX } = useRealtime('tabla');` junto a los demás hooks (zona ~línea 1560) y después `const x = xData || [];`.
- Formularios: `const XxxForm = ({ ..., onSave, onCancel }) => {...}` definidos a nivel de `MainApp` y abiertos con `setEditingItem(obj)` + `setShowModal('clave')`. Los modales están todos juntos al final del JSX de `MainApp` (busca `{/* Modal Corregir Factura V79 */}` y añade los nuevos al lado).
- Guardado genérico: `handleSave(table, form, id)` / `handleDelete(table, id)` (incluyen auditoría y, para gastos nuevos, el asiento automático).

## Reglas que evitan la pantalla en blanco

- **Hooks solo en el nivel superior de un componente** (`MainApp` o un `XxxForm`). Nunca `useState`/`useEffect` dentro de `renderXxx()`, de un `.map` o de una condición.
- Declara un estado **antes** de cualquier `useMemo`/`useEffect` que lo lea durante el render.
- En JSX, dos hermanos dentro de `{cond && (...)}` van envueltos en un fragmento `<>…</>`.
- Ventanas emergentes (PDFs, contratos, impresión): `window.open('', '_blank')` **antes** del primer `await` y luego `w.document.write(html)`; si no, el navegador la bloquea.
- Tras cambiar código, compila (`npm run build`). Un warning nuevo de esbuild del tipo `The character "}" is not valid inside a JSX element` es un error real que pinta texto suelto.

## Supabase: patrones obligatorios

- Columna que puede no existir todavía (SQL sin ejecutar): captura el error `42703` y reintenta sin esa columna avisando con `alert('⚠️ … Ejecuta el SQL Vnn')`. Tabla que falta: código `42P01` → alerta pidiendo el SQL.
- **IDs de documentos** (albaranes, facturas, presupuestos, lotes, asientos): usa `generarIdSecuencial(tabla, prefijo, padding, campo)` y `insertarConIdUnico(tabla, datos, prefijo, padding)`. Nunca `COUNT + 1` (provocó duplicados de `albaranes_pkey`).
- Comprueba siempre `error` en cada llamada a Supabase y enséñalo con `alert('❌ …' + error.message)`; no des por guardado lo que no se ha guardado.
- Archivos: bucket `facturas-gastos` (URL pública con `getPublicUrl`).
- Edge Functions del repo: `send-email`, `send-slack`, `siembra-diaria`, `portal-cliente`, `leer-factura` (`supabase/functions/`). `leer-factura` (V85) lee facturas de proveedor con la API de Claude (secret `ANTHROPIC_API_KEY`) y las deja en `facturas_recibidas`; el gasto y su asiento los crea siempre el ERP al registrarla. Avisos: `enviarSlack({...})` y `enviarEmail({...})` en `MainApp`.

## Reglas de negocio y fiscales

- **Ventas**: IVA 4 % (`IVA_VENTAS`), recargo de equivalencia 0,5 % (`RE_VENTAS`) si `cliente.recargo_equivalencia`.
- **Dos líneas de negocio** (V84): `distribucion` (distribuidores, retail, Mercamadrid · volumen) y `restaurantes` (HORECA · margen). Usa `lineaDeCliente(cliente)` / `lineaDeClienteId(id)` (nunca leas `clientes.linea_negocio` a pelo: puede estar vacía y se deduce del tipo), `LINEAS_NEGOCIO` para etiquetas y colores, `BadgeLinea` y el filtro global `lineaFiltro` (`enLineaFiltro(clienteId)`, `renderSelectorLinea()`) en las secciones nuevas que listen clientes, pedidos o facturas.
- **Precio por cliente**: siempre `getPrecioCliente(producto_id, cliente_id)` = tarifa especial (`tarifas_cliente`) → precio base de su línea (`productos.precio_distribucion` / `precio_restaurantes`) → `productos.precio`. Nunca `producto.precio` a pelo.
- **Importes de albarán/factura**: la única fuente de verdad es `calcularImportesAlbaran(albaran, cliente, { aplicarTarifas })` = productos − descuento (porcentaje del cliente o `clientes.descuentos_fechas` por rango de fechas) + porte (`albaranes.coste_envio`, por defecto `clientes.coste_porte`, gratis desde `porte_gratis_desde`). IVA y RE se calculan una vez sobre la base. No dupliques esta lógica en otro sitio.
- **Gastos**: `gastos.importe` es lo que se paga (total de la factura: base + IVA − retención IRPF si la hay); `iva_tipo` es una clave de `TIPOS_IVA` (`general`, `reducido`, `superreducido`, `exento`). Si la factura lleva retención o varias bases se guardan `base_imponible`, `iva_importe`, `retencion_pct` y `retencion_importe` (V85). **Base, IVA y retención siempre con `desgloseGasto(g)`**, nunca `importe / (1 + iva)` a pelo. El asiento lleva la retención a la 4751 (modelos 115 alquiler / 111 profesionales). Categoría = clave de `categoriasGasto` (OPEX 6xx, CAPEX 21x); si añades una, añádela también a `CATEGORIAS` en `supabase/functions/leer-factura/index.ts`.
- **Formas de pago** (`FORMAS_PAGO`): `banco`, `caja`, `tarjeta_empresa`, `transferencia`, `socio_nico`, `socio_peri`, `socio_guzman`. `socio_*` = deuda con el socio (cuenta 551).
- Asiento de un gasto: `crearAsientoDesdeGasto(gasto, proveedor, silencioso)` con referencia `GAS-<id>`. Si cambias importe/fecha/forma de pago de un gasto vinculado, rehaz su asiento.
- Compras a particulares (V80): sin IVA, ITP 4 % con modelo 600 en 30 días hábiles; todo en la pestaña Gastos → Compras a particulares.
- Datos fijos de empresa: usa la constante `EMPRESA` (razón social, CIF, dirección, IBAN), no los copies a mano. Nombres de socios en pantalla: `nombreCortoSocio()` (el nombre completo de Guzmán empieza por "Domingo de Guzmán" y sin esa función sale "Domingo").

## Cómo entregar un cambio

1. Haz el cambio completo (código + SQL si hace falta) y compílalo.
2. Actualiza `docs/HISTORIAL.md` (y `docs/PENDIENTES.md` si cierras o abres algo).
3. Commit `Vnn: …` y push de la rama.
4. Responde a Peri en español, corto: qué ha cambiado, dónde está en la app, **qué SQL tiene que ejecutar** (si hay) y cómo probarlo.
5. Datos sensibles: no escribas en el código ni en los commits contraseñas, claves de API, ni IBAN o DNI de clientes y terceros (el repositorio es público).
