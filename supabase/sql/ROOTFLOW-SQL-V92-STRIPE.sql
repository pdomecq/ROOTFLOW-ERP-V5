-- =====================================================================
-- ROOTFLOW ERP — V92: cobro automático con Stripe (tarjeta o adeudo SEPA)
-- =====================================================================
-- El cliente domicilia el pago una vez (enlace de Stripe desde el ERP o su área de cliente) y la
-- Edge Function `stripe` cobra cada factura al vencer; el webhook de Stripe la marca pagada con su
-- asiento (430 → 5721 Stripe, comisión a 626) y la transferencia semanal de Stripe al BBVA hace el
-- asiento 5721 → 572. Las facturas siguen saliendo del ERP (numeración propia): Stripe solo cobra.
-- Idempotente: se puede ejecutar varias veces.
-- =====================================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS stripe_metodo TEXT;           -- card | sepa_debit
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS stripe_metodo_detalle TEXT;   -- "Visa ···4242" / "IBAN ···1234"
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS stripe_mandate_id TEXT;            -- mandato SEPA (si paga por adeudo)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS stripe_activo BOOLEAN DEFAULT FALSE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS stripe_domiciliado_at TIMESTAMPTZ;

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS stripe_estado TEXT;           -- processing | succeeded | failed
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS stripe_error TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS stripe_intentos INTEGER DEFAULT 0;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS stripe_comision NUMERIC(10,2);
CREATE INDEX IF NOT EXISTS facturas_stripe_pi_idx ON facturas (stripe_payment_intent_id);

-- Eventos de Stripe ya procesados (el webhook puede llegar repetido)
CREATE TABLE IF NOT EXISTS stripe_eventos (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  tipo TEXT,
  resultado TEXT
);
ALTER TABLE stripe_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stripe_eventos_authenticated" ON stripe_eventos;
CREATE POLICY "stripe_eventos_authenticated" ON stripe_eventos FOR ALL TO authenticated USING (true) WITH CHECK (true);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'stripe_eventos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE stripe_eventos;
  END IF;
END $$;

-- Cuándo se cobra: 'vencimiento' (por defecto) o 'emision'
INSERT INTO ajustes_sistema (clave, valor, tipo, descripcion)
SELECT 'stripe_cobro_momento', 'vencimiento', 'text', 'V92: cobrar con Stripe al vencer la factura o al emitirla'
WHERE NOT EXISTS (SELECT 1 FROM ajustes_sistema WHERE clave = 'stripe_cobro_momento');

-- Cobros programados: L-D 7:20 UTC (antes de conciliar el banco y de los recordatorios)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rootflow-stripe';
  PERFORM cron.schedule('rootflow-stripe', '20 7 * * *',
    $c$ SELECT net.http_post(url := 'https://deebnsbrvtmstakchxan.supabase.co/functions/v1/stripe', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{"accion": "cron_cobros"}'::jsonb); $c$);
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V92 OK — Stripe: domiciliación de clientes, cobro de facturas al vencer y webhook' AS resultado;
