# Pendientes del ERP

Revisado el 22-oct-2026 contra el código (V80), Supabase y Vercel. Ordenado por prioridad. Al cerrar un punto, bórralo de aquí y anótalo en `HISTORIAL.md`.

## 1. 🔴 Seguridad: 53 tablas se pueden leer y modificar sin iniciar sesión

- Las 14 tablas originales (`clientes`, `facturas`, `gastos`, `pedidos`, `productos`…) solo permiten `authenticated`. Pero las **53 tablas creadas desde la V15** tienen una política `FOR ALL … TO anon, authenticated USING (true)`. Con la clave anon (que va dentro del JavaScript público de rootflow-erp.vercel.app) cualquiera puede leer y borrar, sin login, albaranes, asientos, mandatos y remesas SEPA (IBAN de clientes), compras a particulares (DNI), aportaciones de socios, tarifas, etc.
- Tablas afectadas: `ajustes_sistema`, `albaran_pedidos`, `albaranes`, `aportaciones_socios`, `asiento_lineas`, `asientos_contables`, `audit_log`, `ausencias_socios`, `compras_particulares`, `condiciones_ambientales`, `config_slack`, `contactos_desarrollo`, `documentos_corporativos`, `email_log`, `etiquetas_generadas`, `eventos_calendario`, `extractos_bancarios`, `facturas_semanales`, `historico_precios`, `insumo_movimientos`, `insumos`, `interacciones_desarrollo`, `lead_actividades`, `lote_bandejas`, `lote_movimientos`, `mandatos_sepa`, `mapeo_categorias_coste`, `mezclas`, `movimientos_stock`, `muestra_items`, `muestras`, `notas_kilometraje`, `notificaciones_config`, `pagos_proveedor`, `pedidos_recurrentes`, `pedidos_recurrentes_items`, `planes_produccion`, `plantillas_turnos`, `presupuesto_items`, `presupuestos`, `racks_config`, `recetas_produccion`, `recibos_tpv`, `reembolsos_socios`, `remesas_sepa`, `remesas_sepa_items`, `slack_log`, `socios`, `tareas_calendario`, `tarifas_cliente`, `turnos`, `user_profiles`, `variedades`.
- Arreglo propuesto (versión propia, probar después de cada paso):
  1. SQL que, para cada tabla anterior, borre sus políticas con `anon`/`public` y cree `FOR ALL TO authenticated USING (true) WITH CHECK (true)`. La app siempre trabaja con sesión iniciada y las Edge Functions usan la service role, así que no debería romper nada. Comprobar antes que ninguna pantalla se usa sin login.
  2. En Supabase → Authentication, desactivar el registro de usuarios nuevos (hoy la pantalla de login permite `signUp` y el límite al dominio `rootflow.es` solo se comprueba en el navegador).
  3. Valorar poner el repositorio de GitHub en **privado** (hoy es público). Si se hace, instalar la Claude GitHub App en el repo para que Claude Code en la web lo siga viendo.

## 2. 🟠 El aviso diario de siembra a Guzmán (V71) no está funcionando

- El SQL V71 no se ejecutó: no existen la tabla `siembra_notif_log`, las columnas `notificaciones_config.notif_siembra_pedidos` / `email_siembra`, ni las extensiones `pg_cron` / `pg_net`.
- La Edge Function `siembra-diaria` no está desplegada. Su código ya está en `supabase/functions/siembra-diaria/index.ts`, y ahora usa el secret `SLACK_WEBHOOK_URL` si `notificaciones_config` no tiene webhook (hoy esa tabla está vacía).
- Pasos: desplegar la función (`supabase functions deploy siembra-diaria --no-verify-jwt`), revisar los secrets `RESEND_API_KEY` y `SLACK_WEBHOOK_URL`, ejecutar `supabase/sql/historico/ROOTFLOW-SQL-V71-SIEMBRA-DIARIA.sql` (ya lleva el project ref puesto) y probar con `?force=1`.
- El email ya puede salir: Resend funciona desde el 27-oct.

## 3. 🟠 Líneas de negocio (V84): ponerlas en marcha

- Hecho (27-oct): SQL V84 ejecutado. 7 clientes en distribución y 5 en restaurantes (uno de ellos sin nombre).
- Revisar en Clientes la línea de los que no encajan por tipo: p. ej. "Tatin catering" y "La Fresquera del Gourmet" están como restaurante; "Gold Gourmet" y las fruterías como tienda (→ distribución).
- Rellenar en Tarifas → "Precio base por línea" los precios de restaurantes (hoy solo hay precio general, pensado para distribución).
- Ideas: separar ventas por línea en contabilidad (subcuentas 700x) y en el export de asesoría; zonas calientes y reparto por riders para restaurantes.

## 4. 🟠 Facturas de gasto automáticas (V85): ponerlas en marcha

- ✅ (27/10) SQL V85 y V85b ejecutados, `leer-factura` desplegada, token en `config_privada`, alquileres de Bellbro corregidos en la tabla `gastos`.
- ✅ (27/10) Secret `ANTHROPIC_API_KEY` puesto: probado con dos facturas de Bellbro ya registradas (las leyó perfectas y las marcó como duplicadas).
- Tarea programada diaria "Facturas del correo al ERP" (8:33, revisa el Gmail de Peri) creada, pero **sin conectores**: hay que añadirle Gmail y Supabase desde claude.ai (Rutinas / tareas programadas) o no podrá leer el correo.
- Tras desplegar V86 (merge a `main`), pulsar "Rehacer asientos" en Gastos para regenerar los asientos de los alquileres corregidos.
- Modelo 115: no consta en el ERP ningún pago de retenciones. Confirmar con la gestoría que se presentaron el 2T y 3T. El pago del modelo debe saldar la 4751 (asiento manual), no registrarse como gasto.
- Los gastos de Claude de abril–julio están como "exento"; la factura de octubre lleva IVA español del 21 %. Revisar con la gestoría si las anteriores también.

## 4b. 🟠 Numeración de facturas (V87): dejarla limpia

- Ejecutar `supabase/sql/ROOTFLOW-SQL-V87-NUMERACION-FACTURAS.sql` (columnas de anulación y trigger que impide borrar facturas que no sean la última).
- En Facturación → panel "🔢 Numeración de facturas": "Registrar como anulados" (huecos 0004–0008, 0012, 0013 y 0017) y "Cuadrar contabilidad" (8 asientos de facturas borradas = 363,70 € de ventas que no existen, asientos repetidos de la 0001, 0002 y 0010, la 0003 con otro importe y el cobro de la 0001 por 37,02 € en vez de 644,38 €).
- Revisar a mano el cobro A139 (`COB-F-2026-0005`, 87,36 € de Frutas Vázquez) de una factura borrada: si el dinero entró, tiene que ir contra la factura que la sustituyó.
- Avisar a la asesoría de los números anulados y de que el IVA repercutido del 3T cambia al quitar las ventas de facturas borradas (si ya presentó el 303 con esos importes).

## 4c. 🟠 Aprovisionamientos (V88): ponerlos en marcha

- Ejecutar `supabase/sql/ROOTFLOW-SQL-V88-APROVISIONAMIENTOS.sql` (tablas, carga de las 18 facturas de material y recategoriza los gastos 59, 86, 151 y 162 con su asiento).
- **Facturas duplicadas** (borrarlas en Gastos tras confirmarlo): #116 (17-jun, 147,77 €) es la misma factura polaca FV/B2B 92/5/2026 que la #92; #152 (1-oct, 354,52 €) es la **proforma** PROF 4/10/2026 del pedido que se facturó como #162. Juntas inflan semillas en 415 € de base y el IVA soportado en 87 €.
- **IVA de las semillas de Polonia** (HYDRO / MP Seeds, #92, #117, #162): llevan IVA polaco (5–8 %, 23 % el envío) y están registradas con IVA español del 21 %. El IVA polaco no es deducible en España; lo correcto es pedirles factura intracomunitaria sin IVA (con el NIF-IVA ESB27535137 dado de alta en el ROI/VIES) y declarar la adquisición intracomunitaria (modelo 303/349). Consultarlo con la asesoría.
- Pesar y apuntar los **gramos de semilla por bandeja** de las variedades marcadas "estimado" (rábano red, daikon, amaranto, remolacha, rúcula, brócoli, guisante…) y hacer un **recuento** de sacos de sustrato (fija los litros por bandeja), semillas (pesar bolsas) y tarrinas/etiquetas.
- Revisar en "Envase y etiquetas de cada producto" que el envase por formato es el bueno (por defecto: 30 g y mezclas → tarrina 750 cc; 15 g → oval 250 cc; 5 g → oval 150 cc).
- La compra a Fronda de brotes de cilantro (#119) está como "sustratos"; se trata como mercadería para revender (coste directo del cilantro de junio).

## 5. 🟡 Rentabilidad (V86): mejorar la precisión

- Rellenar en Producción las fichas de coste de cada variedad (gramos y €/kg de semilla, sustrato) y en Productos el coste de envase y etiqueta: permitirá comparar el coste real (compras) con el estándar y ver la merma.
- Registrar todos los lotes sembrados: sin ellos el reparto por variedad usa bandejas estimadas a partir de los kg vendidos.
- Las compras de semilla y envases cuentan el mes en que se compran (no hay control de existencias): para márgenes mensuales finos haría falta valorar el stock de semilla y envases.
- No hay nóminas ni Seguridad Social registradas: si los socios cobran, el EBITDA real será menor.

## 6. 🟡 Facturas: unificar la plantilla (pedido de Peri, sin empezar)

"Dependiendo de dónde pulse las genera de una forma u otra y es un caos; algunas salen sin el detalle de importes."
- Hoy hay al menos tres caminos distintos:
  - `FacturaPreview` → `handlePrint`: plantilla propia (Segoe UI, verde `#2D6A4F`, logo en imagen). Solo lista los productos del pedido, sin portes ni descuentos por albarán.
  - `generarPDFFacturaAgrupada`: otra plantilla (Helvetica, naranja).
  - El email (mailto): un texto distinto.
- Objetivo: una única función que genere el HTML de la factura a partir de `calcularImportesAlbaran` (líneas, descuento, portes, base, IVA 4 %, RE, total, vencimiento, IBAN de `EMPRESA`). Que la usen la vista previa, la impresión o PDF, la factura agrupada y el email, y que el resultado salga igual pulses donde pulses.

## 7. 🟡 Límite de 1.000 filas por tabla

`useRealtime` hace `select('*')` sin paginar, y Supabase devuelve como máximo 1.000 filas por consulta (límite por defecto). `asiento_lineas` va por 490 filas, `movimientos_stock` por 270 y `email_log` por 187. Cuando alguna pase de 1.000, la app mostrará datos incompletos sin avisar: balances e informes contables saldrán mal. Arreglo: paginar con `.range()` dentro de `fetchData`.

## 8. Ideas aparcadas (no pedidas todavía)

- Remesas SEPA en formato pain.008 para el banco.
- Flujo de prepago para clientes nuevos.
- Cierre estricto de periodos contables (bloquear la edición de meses cerrados).
