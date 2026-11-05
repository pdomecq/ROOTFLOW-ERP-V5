-- =====================================================================
-- ROOTFLOW ERP · SQL V106 · Aviso interno cuando vence una factura sin cobrar
-- facturas.aviso_interno_at = cuándo se avisó a Peri de que esa factura venció (no se repite).
-- Tarea diaria (8:05 UTC ≈ 9:05 en Madrid en invierno) que llama a la función aviso-cobros: solo manda email
-- si alguna factura ha vencido y aún no se había avisado. Destinatario en ajustes_sistema.aviso_cobros_email.
-- Idempotente.
-- =====================================================================
ALTER TABLE public.facturas ADD COLUMN IF NOT EXISTS aviso_interno_at TIMESTAMPTZ;

INSERT INTO public.ajustes_sistema (clave, valor, tipo, descripcion)
SELECT 'aviso_cobros_email', 'p.domecq@rootflow.es', 'texto', 'V106: a quién se avisa cuando vence una factura sin cobrar (varios separados por comas)'
WHERE NOT EXISTS (SELECT 1 FROM public.ajustes_sistema WHERE clave = 'aviso_cobros_email');

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'rootflow-aviso-cobros';
  PERFORM cron.schedule('rootflow-aviso-cobros', '5 8 * * *',
    $c$ SELECT net.http_post(url := 'https://deebnsbrvtmstakchxan.supabase.co/functions/v1/aviso-cobros', headers := '{"Content-Type": "application/json"}'::jsonb, body := '{"accion": "cron"}'::jsonb); $c$);
END $$;

NOTIFY pgrst, 'reload schema';
SELECT 'V106 OK — aviso de cobros programado' AS resultado;
