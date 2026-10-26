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
- El email depende además del punto 3.

## 3. 🟠 Emails: falta el secret de Resend

- Las facturas (V83) ya no usan `send-email`: las envía la función `portal-cliente` directamente con Resend. Necesita el secret `RESEND_API_KEY` en Supabase → Edge Functions → Secrets y el dominio `rootflow.es` verificado en Resend (remitente `info@rootflow.es`, o el que se ponga en el secret `FROM_EMAIL`).
- El resto de emails del ERP (alertas, enlace del área de cliente, respuestas a solicitudes) sigue llamando a `send-email`, que no está desplegada. Las desplegadas son `send-slack` (correcta), `send-mail`, `supabase-functions-deploy-send-email` y `swift-handler` (intentos con nombres erróneos). Arreglo: desplegar `supabase/functions/send-email` con ese nombre exacto y borrar las duplicadas.
- Histórico: `email_log` tenía 14 emails, todos con error (el último en abril).

## 4. 🟠 Envío automático de facturas (V83): activarlo

- Ejecutar `supabase/sql/ROOTFLOW-SQL-V83-ENVIO-FACTURAS.sql` (columnas, ajustes y programación pg_cron a las 9:15 y 16:15).
- Desplegar la nueva versión de `portal-cliente` (sigue con "Verify JWT" desactivado) y poner el secret `RESEND_API_KEY` (punto 3).
- Probar con el botón ✉️ en una factura enviándola a un email propio y con "PDF del cliente"; después, ERP → Facturación → "Qué se enviará" → Activar.
- La factura agrupada (semanal, quincenal o mensual) se sigue generando con un clic (Facturación → Facturas agrupadas); al generarla se envía sola. Si se quiere que también se genere sola al cerrar el periodo, es un cambio aparte.
- Los datos de la empresa están copiados en `supabase/functions/portal-cliente/index.ts` (no puede importar `src/empresa.js`): si cambian, actualizar los dos.

## 5. 🟡 Facturas: unificar la plantilla (pedido de Peri, sin empezar)

"Dependiendo de dónde pulse las genera de una forma u otra y es un caos; algunas salen sin el detalle de importes."
- Hoy hay al menos tres caminos distintos:
  - `FacturaPreview` → `handlePrint`: plantilla propia (Segoe UI, verde `#2D6A4F`, logo en imagen). Solo lista los productos del pedido, sin portes ni descuentos por albarán.
  - `generarPDFFacturaAgrupada`: otra plantilla (Helvetica, naranja).
  - El email (mailto): un texto distinto.
- Objetivo: una única función que genere el HTML de la factura a partir de `calcularImportesAlbaran` (líneas, descuento, portes, base, IVA 4 %, RE, total, vencimiento, IBAN de `EMPRESA`). Que la usen la vista previa, la impresión o PDF, la factura agrupada y el email, y que el resultado salga igual pulses donde pulses.

## 6. 🟡 Límite de 1.000 filas por tabla

`useRealtime` hace `select('*')` sin paginar, y Supabase devuelve como máximo 1.000 filas por consulta (límite por defecto). `asiento_lineas` va por 490 filas, `movimientos_stock` por 270 y `email_log` por 187. Cuando alguna pase de 1.000, la app mostrará datos incompletos sin avisar: balances e informes contables saldrán mal. Arreglo: paginar con `.range()` dentro de `fetchData`.

## 7. Ideas aparcadas (no pedidas todavía)

- Remesas SEPA en formato pain.008 para el banco.
- Flujo de prepago para clientes nuevos.
- Cierre estricto de periodos contables (bloquear la edición de meses cerrados).
