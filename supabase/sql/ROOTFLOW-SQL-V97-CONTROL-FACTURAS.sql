-- =====================================================================
-- ROOTFLOW ERP · SQL V97 · Control diario de facturas contra albaranes
-- Tarea programada (pg_cron + pg_net): cada día a las 7:15 UTC llama a portal-cliente
-- (acción cron_control_facturas), que revisa las facturas pendientes contra sus albaranes/pedidos
-- y avisa en Slack de descuadres, pedidos facturados dos veces y entregas sin factura.
-- No crea tablas ni columnas. Idempotente: se puede ejecutar varias veces.
-- =====================================================================
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rootflow-control-facturas';
  PERFORM cron.schedule('rootflow-control-facturas', '15 7 * * *',
    $c$ SELECT net.http_post(url := 'https://deebnsbrvtmstakchxan.supabase.co/functions/v1/portal-cliente', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{"accion": "cron_control_facturas"}'::jsonb); $c$);
END $$;

NOTIFY pgrst, 'reload schema';
SELECT 'V97 OK — control diario de facturas programado (7:15 UTC)' AS resultado;
