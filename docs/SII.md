# SII y REDEME: cómo ponerlo en marcha (V127)

## 1. Alta en el REDEME (IVA mensual con devolución cada mes) — **antes del 30 de noviembre**

La hace **Nico** (administrador único) en la Sede electrónica de la AEAT con su certificado de representante de la sociedad (o su DNIe / certificado personal si está dado de alta como representante):

1. sede.agenciatributaria.gob.es → **Censos, NIF y domicilio fiscal** → **Modelo 036** → «Presentación» (declaración censal de **modificación**).
2. Causa de la presentación: marcar **«Solicitud de inscripción en el registro de devolución mensual»**. El formulario avisa de que la inscripción obliga a llevar los libros por el **SII**.
3. Firmar y enviar. Guardar el PDF del justificante y subirlo al ERP: Contabilidad → Impuestos → «Modelos presentados».
4. Pedida en noviembre, la inscripción vale **desde el 1 de enero de 2027**. Hacienda contesta por notificación electrónica (mirad la DEHú / buzón de la Sede).

Requisitos: estar al corriente con Hacienda y la Seguridad Social y no estar en régimen simplificado (no es vuestro caso).

Desde enero:
- 303 **mensual**, hasta el día **30** del mes siguiente (el de enero, hasta el último día de febrero; el de diciembre, hasta el 30 de enero). Cada mes se puede pedir la devolución.
- **111 y 115** siguen siendo **trimestrales** (día 20).
- **No** se presentan el **390** ni el **347** (los sustituye el SII).
- Cada factura emitida y recibida se envía al **SII en 4 días hábiles** (las recibidas, desde que se registran; como tarde el día 15 del mes siguiente).

En el ERP: Contabilidad → Impuestos → «IVA mensual desde» = **2027-01**.

## 2. Certificado electrónico para que el ERP envíe al SII

Sirve el **certificado de representante de persona jurídica** de la FNMT (el de la sociedad) o el certificado personal de quien envíe, si la sociedad le ha dado un **apoderamiento** para el SII en la Sede (Nico: «Apoderamientos» → apoderar a Peri para el trámite de suministro de libros registro / SII).

1. Exportarlo desde el navegador donde está instalado como archivo **.pfx / .p12 con contraseña**.
2. Pasarlo a texto base64 en el ordenador: Mac/Linux `base64 -i certificado.pfx | tr -d '\n' > cert.txt` · Windows PowerShell `[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificado.pfx")) > cert.txt`.
3. En **Vercel** → proyecto `rootflow-erp-v5` → Settings → **Environment Variables** (Production), añadir:
   - `SII_CERT_P12` = el contenido de `cert.txt`
   - `SII_CERT_PASSWORD` = la contraseña del .pfx
   - `SUPABASE_SERVICE_ROLE_KEY` = Supabase → Project Settings → API → `service_role`
   - (más adelante) `SII_PRODUCCION` = `si`
4. Volver a desplegar (Deployments → Redeploy) y borrar `cert.txt` del ordenador.

**Nunca** pegues el certificado ni las contraseñas en el chat ni en el código: el repositorio es público.

## 3. Probar y empezar

1. Ejecutar el SQL `supabase/sql/ROOTFLOW-SQL-V127-SII.sql` (tabla `sii_envios`).
2. ERP → Contabilidad → Impuestos → «📡 SII» → **Comprobar certificado** → debe salir «✓ Certificado listo».
3. Con «Entorno de pruebas», elegir un mes con facturas y pulsar **Enviar**: la AEAT contesta sin que cuente como presentado. Revisar los rechazos (la columna Estado dice el código y el motivo).
4. Cuando todo salga aceptado, poner `SII_PRODUCCION=si` en Vercel y, desde enero, enviar en «Envío real» cada pocos días (el plazo de cada factura sale en la tabla).

Lo que pide el SII y comprueba el ERP antes de enviar: NIF válido del cliente/proveedor, número de la factura del proveedor (lo rellena la lectura con IA), factura adjunta, y las de proveedores de otro país de la UE se dejan aparte hasta aclarar con la gestoría su autoliquidación.

Código: `src/sii.js` (registros, XML SuministroLR 1.1, plazos, lectura de la respuesta; probado en Node) y `api/sii.js` (función de Vercel que envía con el certificado y guarda el resultado en `sii_envios`).
