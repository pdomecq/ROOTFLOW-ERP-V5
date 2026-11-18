-- V124: un asiento por cobro de Stripe y por transferencia de Stripe.
-- Stripe avisa a veces dos veces casi a la vez (checkout.session.completed y payment_intent.succeeded) y la
-- función `stripe` creaba dos asientos COB- iguales (pasó con COB-F-2026-0022, ya borrado el repetido).
-- Con este índice la segunda llamada falla, Stripe la reintenta y encuentra el asiento ya hecho.

-- Por si quedara alguno repetido: se deja el más antiguo de cada referencia
DELETE FROM asiento_lineas WHERE asiento_id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY referencia ORDER BY created_at, id) AS n
    FROM asientos_contables WHERE referencia LIKE 'COB-%' OR referencia LIKE 'STR-%'
  ) x WHERE n > 1
);
DELETE FROM asientos_contables WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY referencia ORDER BY created_at, id) AS n
    FROM asientos_contables WHERE referencia LIKE 'COB-%' OR referencia LIKE 'STR-%'
  ) x WHERE n > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS asientos_contables_ref_stripe_unica
  ON asientos_contables (referencia)
  WHERE referencia LIKE 'COB-%' OR referencia LIKE 'STR-%';

NOTIFY pgrst, 'reload schema';
SELECT 'V124 OK — un solo asiento por cobro y transferencia de Stripe' AS resultado;
