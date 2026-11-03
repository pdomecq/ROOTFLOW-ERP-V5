# Stripe en el ERP (V92): cobro automático de facturas

El cliente domicilia su pago **una vez** (tarjeta o cuenta bancaria con mandato SEPA). Desde ese mes,
cada factura suya se cobra sola el día que vence y queda **pagada en el ERP con su asiento**. Las
facturas las sigue haciendo y numerando el ERP: Stripe solo cobra (no uses "Invoices" de Stripe).

## Ya está hecho

- Edge Function `stripe` desplegada y SQL V92 ejecutado.
- Webhook creado en el Stripe **de pruebas**, que apunta a `https://deebnsbrvtmstakchxan.supabase.co/functions/v1/stripe`. Eventos: domiciliación completada, cobro correcto / en curso / fallido, transferencias, devoluciones, disputas y mandatos.
- Tarea programada diaria (8:20) que cobra las facturas que vencen.
- En el ERP: Facturación → 🏦 Banco y cobros → 💳 Cobro automático con Stripe.
- En el área de cliente: botón «Domiciliar mis pagos».

## 1. Poner las claves de pruebas (5 minutos, lo haces tú)

1. **Clave secreta.** Entra en Stripe, en el entorno de prueba («ROOTFLOW HYDROPONICS SL sandbox») → Developers → API keys. Copia la *Secret key* (`sk_test_…`).
2. **Secreto del webhook.** En Stripe → Developers → Webhooks, abre el endpoint `…/functions/v1/stripe` → *Signing secret* → Reveal. Copia `whsec_…`.
3. **Guardarlas en Supabase.** Supabase → proyecto `deebnsbrvtmstakchxan` → Edge Functions → Secrets → Add new secret:
   - `STRIPE_SECRET_KEY` = la `sk_test_…`
   - `STRIPE_WEBHOOK_SECRET` = la `whsec_…`
4. En el ERP, abre 🏦 Banco y cobros. Tiene que poner **modo pruebas** y ningún aviso de claves.

Nunca pegues estas claves en el chat, en GitHub ni en el código.

## 2. Probarlo (en pruebas no se mueve dinero real)

1. Elige un cliente de prueba con tu email. En 💳 Stripe pulsa **Enviar enlace** (o **Copiar enlace**).
2. Abre el enlace y domicilia con la tarjeta `4242 4242 4242 4242` (fecha futura cualquiera y CVC cualquiera). Para SEPA usa el IBAN de prueba `DE89370400440532013000`.
3. En unos segundos el cliente sale como «✓ Visa ···4242» y llega un aviso a Slack.
4. Crea una factura a ese cliente y pulsa **Cobrar ya** en 💳 Stripe. Comprueba tres cosas:
   - que pasa a pagada;
   - que tiene el asiento `COB-…` (5721 / 430) y la comisión en la 626;
   - que en Stripe aparece el pago con el número de factura.
5. Para probar un fallo, domicilia otro cliente de prueba con la tarjeta `4000 0000 0000 0341`. Su cobro fallará, llegará el aviso a Slack y saldrá el botón Reintentar.

## 3. Pasar a real

1. En Stripe, activa la cuenta. Lo tiene que hacer **Nico** como representante (administrador único), con su DNI, el CIF de la empresa y el IBAN del BBVA para las transferencias. Pon las transferencias semanales (Settings → Payouts) y el descriptor «ROOTFLOW».
2. En Settings → Payment methods activa **Tarjetas** y **SEPA Direct Debit**.
3. En Settings → Customer emails activa los avisos de SEPA: confirmación del mandato y aviso previo al cargo.
4. Webhook real: Developers → Webhooks → Add endpoint, en modo real.
   - URL: `https://deebnsbrvtmstakchxan.supabase.co/functions/v1/stripe`
   - Eventos: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.processing`, `payment_intent.payment_failed`, `payout.paid`, `charge.refunded`, `charge.dispute.created`, `mandate.updated`.

   (O pídeselo a Claude con el Stripe conectado en modo real.)
5. En Supabase cambia `STRIPE_SECRET_KEY` por la `sk_live_…` y `STRIPE_WEBHOOK_SECRET` por el `whsec_…` del webhook real.
6. Los clientes domiciliados en pruebas no valen en real: hay que mandar el enlace de nuevo.

## 3b. Al pasar de pruebas a real

Los clientes y tarjetas creados en el sandbox no existen en la cuenta real. Antes de poner las claves reales, ejecuta en el SQL Editor de Supabase (o pídeselo a Claude):

```sql
UPDATE clientes SET stripe_customer_id = NULL, stripe_payment_method_id = NULL, stripe_mandate_id = NULL,
  stripe_metodo = NULL, stripe_metodo_detalle = NULL, stripe_activo = FALSE, stripe_domiciliado_at = NULL;
UPDATE facturas SET stripe_estado = NULL, stripe_error = NULL, stripe_payment_intent_id = NULL
  WHERE estado IN ('pendiente', 'vencida');
```

## Pagar ya con tarjeta (V93)

- En los emails de factura y de recordatorio, y en el de domiciliación, aparece el botón morado **«💳 Pagar ahora con tarjeta»** con el logo de Stripe. En el área de cliente aparece en cada factura pendiente, y en el resumen sale **«Pagar las N con tarjeta»**.
- El botón abre la página de pago de Stripe con la factura o facturas. Al pagar:
  - quedan **cobradas** en el ERP con su asiento;
  - llega un aviso a Slack;
  - el cliente vuelve a su área con «✓ Pago recibido».
- A las facturas domiciliadas no se les pone el botón, porque se cobran solas.
- Si una factura ya estaba cobrada (por ejemplo, por transferencia) y además la pagan con tarjeta, avisa en Slack de **posible pago doble**: devuélvelo desde el panel de Stripe.
- Prueba en el sandbox con la tarjeta `4242 4242 4242 4242`.

## 4. Día a día

- **Domiciliar a un restaurante:** 🏦 Banco y cobros → 💳 Stripe → **Enviar enlace** (email con botón) o **Copiar enlace** (para WhatsApp; caduca en 24 h). El cliente también puede hacerlo desde su área de cliente.
- **Cuándo se cobra:** el día que vence la factura (por defecto) o al emitirla, según el selector de la sección. Solo se cobran las facturas del mes en que domicilió en adelante; las anteriores siguen por transferencia.
- **Qué recibe el cliente:**
  - la factura por email, como siempre, con «Se cobrará automáticamente el … con Visa ···4242»;
  - Stripe le manda el recibo;
  - si paga por SEPA, recibe el aviso previo.
- **Si falla un cobro:** aviso en Slack, la factura sale como ❌ Fallido con el motivo y entra en los recordatorios de pago. **Reintentar** lo vuelve a intentar; si la tarjeta caducó, mándale el enlace otra vez («Pedir cambio»).
- **SEPA tarda unos 5–7 días hábiles en confirmarse.** Mientras, sale «⏳ En curso» y no se reclama.
- **Contabilidad:**
  - cobro: 5721 Stripe (debe) / 430 Clientes (haber);
  - comisión: 626 (debe) / 5721 (haber);
  - transferencia semanal de Stripe al BBVA: 572 (debe) / 5721 (haber), automático.

  En la conciliación del banco, los ingresos «STRIPE» se marcan como «No es cobro», porque ya están contabilizados. Revisa con la asesoría el uso de la 5721.
- **Quitar la domiciliación:** botón **Quitar**. Sus facturas vuelven a transferencia y recordatorios.
- **Comisiones orientativas:** tarjeta europea ~1,5 % + 0,25 €; SEPA ~0,35 € por cobro. Para tickets pequeños compensa que el restaurante elija la cuenta (SEPA). Comprueba las tarifas vigentes en tu panel de Stripe.
- **El SEPA de Stripe es el «Core», no el B2B:** el cliente puede pedir la devolución hasta 8 semanas después. Si pasa, llega el aviso a Slack.
