-- =====================================================
-- ROOTFLOW ERP V71 — NOTIFICACIÓN DIARIA DE SIEMBRA (9:00)
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Cada día a las 9:00 (hora Madrid), Guzmán recibe por Slack
-- y por email lo que hay que sembrar HOY: gramos por variedad,
-- calculado desde los pedidos abiertos y el ciclo de cada
-- variedad (germinación + luz), contando hacia atrás desde
-- la fecha de entrega de cada pedido.
-- =====================================================

-- 1. Campos nuevos en la config de notificaciones
ALTER TABLE notificaciones_config ADD COLUMN IF NOT EXISTS notif_siembra_pedidos BOOLEAN DEFAULT TRUE;
ALTER TABLE notificaciones_config ADD COLUMN IF NOT EXISTS email_siembra TEXT DEFAULT 'g.greus@rootflow.es';

-- 2. Log de deduplicación (1 envío al día, compartido entre
--    la Edge Function del servidor y la app como fallback)
CREATE TABLE IF NOT EXISTS siembra_notif_log (
  fecha DATE PRIMARY KEY,
  origen TEXT,                -- 'cron' | 'app' | 'manual'
  detalle TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE siembra_notif_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo siembra_notif_log" ON siembra_notif_log;
CREATE POLICY "Acceso completo siembra_notif_log" ON siembra_notif_log FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================================================
-- 3. PROGRAMACIÓN AUTOMÁTICA A LAS 9:00 (pg_cron + pg_net)
-- =====================================================
-- ⚠️ ANTES DE EJECUTAR ESTE BLOQUE:
--    a) Despliega la Edge Function "siembra-diaria" (archivo aparte):
--       supabase functions deploy siembra-diaria --no-verify-jwt
--    b) Sustituye abajo deebnsbrvtmstakchxan por el ref de tu proyecto
--       (Settings → General → Reference ID, ej: abcdefghijklmnop)
--
-- El cron corre a las 07:00 y 08:00 UTC. La función comprueba
-- internamente si son las 9:00 en Madrid, así el cambio de hora
-- verano/invierno se gestiona solo y nunca llegan dos avisos.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Limpiar programaciones previas si se re-ejecuta este script
DO $$ BEGIN
  PERFORM cron.unschedule('siembra-diaria-7utc');
EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN
  PERFORM cron.unschedule('siembra-diaria-8utc');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'siembra-diaria-7utc',
  '0 7 * * *',
  $$ SELECT net.http_post(
       url := 'https://deebnsbrvtmstakchxan.supabase.co/functions/v1/siembra-diaria',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);

SELECT cron.schedule(
  'siembra-diaria-8utc',
  '0 8 * * *',
  $$ SELECT net.http_post(
       url := 'https://deebnsbrvtmstakchxan.supabase.co/functions/v1/siembra-diaria',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ); $$
);

NOTIFY pgrst, 'reload schema';

SELECT 'V71 OK — Notificación diaria de siembra configurada (falta desplegar la Edge Function y poner deebnsbrvtmstakchxan)' as resultado;
