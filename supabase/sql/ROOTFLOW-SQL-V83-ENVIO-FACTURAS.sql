-- =====================================================
-- ROOTFLOW ERP V83 — ENVÍO AUTOMÁTICO DE FACTURAS POR EMAIL
-- Ejecutar en Supabase SQL Editor (una sola vez; es idempotente)
-- =====================================================
-- · clientes.email_facturacion: a dónde mandar las facturas (si está vacío, se usa clientes.email).
--   Admite varios separados por comas.
-- · clientes.envio_facturas_auto: FALSE = a este cliente no se le mandan solas.
-- · facturas.envio_error / envio_intentos: último error de envío y nº de intentos (máx. 3).
-- · ajustes_sistema: interruptor general (empieza APAGADO; se enciende en ERP → Facturación),
--   fecha desde la que se envían y email en copia oculta.
-- · pg_cron + pg_net: la Edge Function portal-cliente se ejecuta a las 9:15 y a las 16:15
--   (hora de Madrid en invierno; en verano, una hora más tarde) y envía lo que toque:
--     - clientes "por pedido": cuando el pedido está entregado
--     - clientes semanal/quincenal/mensual: en cuanto se genera la factura agrupada
--   Si el interruptor está apagado no envía nada.
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email_facturacion TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS envio_facturas_auto BOOLEAN DEFAULT TRUE;

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS envio_error TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS envio_intentos INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_facturas_envio_pendiente ON facturas(estado) WHERE enviada_at IS NULL;

INSERT INTO ajustes_sistema (clave, valor, tipo, descripcion)
SELECT 'facturas_envio_auto', 'false', 'boolean', 'V83: envío automático de facturas por email (true/false)'
WHERE NOT EXISTS (SELECT 1 FROM ajustes_sistema WHERE clave = 'facturas_envio_auto');

INSERT INTO ajustes_sistema (clave, valor, tipo, descripcion)
SELECT 'facturas_envio_desde', '', 'date', 'V83: solo se envían solas las facturas con fecha igual o posterior (AAAA-MM-DD)'
WHERE NOT EXISTS (SELECT 1 FROM ajustes_sistema WHERE clave = 'facturas_envio_desde');

INSERT INTO ajustes_sistema (clave, valor, tipo, descripcion)
SELECT 'facturas_envio_copia', '', 'text', 'V83: email(s) que reciben copia oculta de cada factura enviada'
WHERE NOT EXISTS (SELECT 1 FROM ajustes_sistema WHERE clave = 'facturas_envio_copia');

-- Programación diaria
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rootflow-envio-facturas') THEN
    PERFORM cron.unschedule('rootflow-envio-facturas');
  END IF;
END $$;

SELECT cron.schedule(
  'rootflow-envio-facturas',
  '15 8,15 * * *',
  $$ SELECT net.http_post(
       url := 'https://deebnsbrvtmstakchxan.supabase.co/functions/v1/portal-cliente',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{"accion": "cron_enviar_facturas"}'::jsonb
     ); $$
);

NOTIFY pgrst, 'reload schema';

SELECT 'V83 OK — Envío automático de facturas (columnas, ajustes y programación 9:15 / 16:15)' AS resultado;
