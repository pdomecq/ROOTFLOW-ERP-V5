# Banco y cobros (V91): movimientos del BBVA, conciliación y recordatorios

Pantalla: Facturación → 🏦 Banco y cobros. La tarjeta de arriba dice hasta qué día está cargado el banco y cuántos ingresos quedan por revisar.

## Cómo entran los movimientos

1. **Subiendo el extracto (ya funciona).** En la web del BBVA: Cuentas → Movimientos → Descargar en PDF o Excel. En el ERP: **Elegir PDF o Excel**. La IA lo lee, mete solo los movimientos nuevos (no duplica aunque los periodos se solapen) y concilia.
   - Se cargó el extracto del 5-ago al 3-nov de 2026.
   - Hazlo **al menos 2 veces por semana**: si el banco lleva más de 3 días sin actualizar, los recordatorios de pago no salen (para no reclamar algo ya pagado) y avisa en Slack.
2. **Automático con Enable Banking (pendiente de alta).** Es acceso PSD2 gratuito a tus propias cuentas.
   1. Regístrate en enablebanking.com → Control Panel → Applications → Register new application.
      - Entorno: Production.
      - Redirect URL: `https://rootflow-erp.vercel.app/`.
      - Marca «Generate private RSA key in the browser» y guarda el `.pem` que se descarga.
   2. En la aplicación creada, pulsa «Activate by linking accounts» y autoriza la cuenta del BBVA (empresa).
   3. Supabase → Edge Functions → Secrets:
      - `EB_APP_ID` = el id de la aplicación (es el nombre del `.pem`, sin la extensión);
      - `EB_PRIVATE_KEY` = el contenido completo del `.pem`.
   4. En el ERP, 🏦 Banco y cobros → **Conectar BBVA**. Te manda al BBVA a dar permiso y vuelve. Desde ese momento se sincroniza solo a las 8:40 y a las 15:40.
   5. El permiso dura 180 días. 10 días antes avisa en Slack: entonces pulsa **Renovar permiso**.

   No hemos podido confirmar las condiciones del plan gratuito ni que el BBVA funcione con ellos en real. Si no funciona, se sigue con el extracto.

## Conciliación (automática)

Cada ingreso se intenta casar con una factura:

- **Número de factura en el concepto** («F-2026-0015», «FACTURA 10») y el importe cuadra → la marca **cobrada** con la fecha valor y su asiento 572/430.
- **El pagador es el cliente** (por nombre, CIF o un alias aprendido) y el importe cuadra con una o varias de sus facturas → **cobrada**.
- **Solo coincide el importe** (pagos con tarjeta del datáfono, pagador desconocido) → queda en **Revisar**: se confirma con un clic o con **Asignar**, eligiendo la factura. Al confirmar, el ERP aprende el pagador y la próxima vez lo casa solo.
- **Aportaciones de socios, traspasos de la tarjeta, bonificaciones y transferencias de Stripe** → «No es cobro».
- Si una factura ya estaba cobrada en el ERP, el movimiento solo se enlaza y se **corrige la fecha de cobro** a la del banco.

## Recordatorios de facturas vencidas

- Salen solos de lunes a viernes a las 9:50, a los **1, 7 y 15 días** de vencer (se puede cambiar en la pantalla). Máximo 3 por factura; después avisa en Slack los lunes para llamar.
- Un email por cliente con todas sus facturas vencidas, los PDF, el IBAN y el enlace a su área de cliente. Copia oculta a la dirección de copia del envío de facturas.
- **No salen:**
  - si el banco no está al día;
  - si hay un ingreso por revisar que puede ser ese pago;
  - si el cliente paga por domiciliación SEPA o Stripe;
  - si tiene la casilla «Recordarle por email…» apagada en su ficha.
- **Enviar ya** manda el recordatorio en el momento (sin esperar a los días configurados).
