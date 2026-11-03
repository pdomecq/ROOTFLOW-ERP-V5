-- =====================================================================
-- ROOTFLOW ERP — V91: movimientos del banco, cobros automáticos y recordatorios de pago
-- =====================================================================
-- movimientos_banco: los movimientos de la cuenta del BBVA (entran solos con Enable Banking o
--   subiendo el extracto en PDF/Excel). La Edge Function `banco` los concilia con las facturas:
--   las que cuadran se marcan cobradas con su asiento 572/430.
-- alias_banco_cliente: "este pagador es este cliente" (se aprende al confirmar un cobro a mano).
-- recordatorios_cobro: registro de los emails de recordatorio de facturas vencidas (Edge Function
--   `portal-cliente`, acción cron_recordatorios).
-- facturas.recordatorios_enviados / recordatorio_ultimo_at y clientes.recordatorios_auto.
-- Tareas programadas (pg_cron): sincronizar y conciliar el banco (7:40 y 14:40 UTC) y
--   recordatorios (L-V 8:50 UTC, después del banco).
-- Idempotente: se puede ejecutar varias veces.
-- =====================================================================

CREATE TABLE IF NOT EXISTS movimientos_banco (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  fecha DATE NOT NULL,                 -- fecha contable
  fecha_valor DATE,
  importe NUMERIC(12,2) NOT NULL,      -- + ingreso, − cargo
  saldo NUMERIC(12,2),
  concepto TEXT,
  contraparte TEXT,                    -- ordenante (ingresos) o beneficiario (cargos)
  origen TEXT DEFAULT 'extracto',      -- 'enable_banking' | 'extracto'
  ref_externa TEXT,                    -- id del movimiento en el banco (Enable Banking)
  estado TEXT DEFAULT 'pendiente',     -- pendiente | conciliado | ya_cobrada | sugerido | sin_casar | otro | ignorado | cargo
  factura_ids TEXT[],
  cliente_id INTEGER,
  motivo TEXT,
  conciliado_por TEXT,
  conciliado_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS movimientos_banco_fecha_idx ON movimientos_banco (fecha);
CREATE INDEX IF NOT EXISTS movimientos_banco_estado_idx ON movimientos_banco (estado);
CREATE UNIQUE INDEX IF NOT EXISTS movimientos_banco_ref_unica ON movimientos_banco (origen, ref_externa) WHERE ref_externa IS NOT NULL;

CREATE TABLE IF NOT EXISTS alias_banco_cliente (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  contraparte TEXT NOT NULL,
  cliente_id INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS alias_banco_cliente_unico ON alias_banco_cliente (upper(contraparte), cliente_id);

CREATE TABLE IF NOT EXISTS recordatorios_cobro (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  factura_id TEXT NOT NULL,
  cliente_id INTEGER,
  nivel INTEGER,                       -- 1.º, 2.º, 3.º recordatorio
  enviado_a TEXT,
  estado TEXT,                         -- enviado | error
  error TEXT,
  origen TEXT                          -- automatico | email del usuario
);
CREATE INDEX IF NOT EXISTS recordatorios_cobro_factura_idx ON recordatorios_cobro (factura_id);

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS recordatorios_enviados INTEGER DEFAULT 0;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS recordatorio_ultimo_at TIMESTAMPTZ;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS recordatorios_auto BOOLEAN DEFAULT TRUE;

-- RLS: solo usuarios con sesión (las Edge Functions usan la service role)
ALTER TABLE movimientos_banco ENABLE ROW LEVEL SECURITY;
ALTER TABLE alias_banco_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordatorios_cobro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "movimientos_banco_authenticated" ON movimientos_banco;
CREATE POLICY "movimientos_banco_authenticated" ON movimientos_banco FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "alias_banco_cliente_authenticated" ON alias_banco_cliente;
CREATE POLICY "alias_banco_cliente_authenticated" ON alias_banco_cliente FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "recordatorios_cobro_authenticated" ON recordatorios_cobro;
CREATE POLICY "recordatorios_cobro_authenticated" ON recordatorios_cobro FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['movimientos_banco', 'alias_banco_cliente', 'recordatorios_cobro'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = t) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

-- Ajustes (se cambian en Facturación → 🏦 Banco y cobros)
INSERT INTO ajustes_sistema (clave, valor, tipo, descripcion)
SELECT 'cobros_recordatorios_auto', 'true', 'boolean', 'V91: enviar solos los recordatorios de facturas vencidas'
WHERE NOT EXISTS (SELECT 1 FROM ajustes_sistema WHERE clave = 'cobros_recordatorios_auto');
INSERT INTO ajustes_sistema (clave, valor, tipo, descripcion)
SELECT 'cobros_recordatorios_dias', '1,7,15', 'text', 'V91: días después del vencimiento en que sale el 1.º, 2.º y 3.º recordatorio'
WHERE NOT EXISTS (SELECT 1 FROM ajustes_sistema WHERE clave = 'cobros_recordatorios_dias');

-- Tareas programadas (pg_cron + pg_net, ya activos desde la V83)
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('rootflow-banco', 'rootflow-recordatorios');
  PERFORM cron.schedule('rootflow-banco', '40 7,14 * * *',
    $c$ SELECT net.http_post(url := 'https://deebnsbrvtmstakchxan.supabase.co/functions/v1/banco', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{"accion": "cron_banco"}'::jsonb); $c$);
  PERFORM cron.schedule('rootflow-recordatorios', '50 8 * * 1-5',
    $c$ SELECT net.http_post(url := 'https://deebnsbrvtmstakchxan.supabase.co/functions/v1/portal-cliente', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{"accion": "cron_recordatorios"}'::jsonb); $c$);
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V91 OK — movimientos del banco, conciliación de cobros y recordatorios de facturas vencidas' AS resultado;
