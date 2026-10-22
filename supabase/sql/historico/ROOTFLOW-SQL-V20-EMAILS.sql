-- =====================================================
-- ROOTFLOW ERP V20 - SISTEMA DE EMAILS
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- ⚠️ IMPORTANTE: Ejecutar previos: V17, V18, V19 si no se ha hecho

-- 1. Tabla email_log (registro de emails enviados)
CREATE TABLE IF NOT EXISTS email_log (
  id SERIAL PRIMARY KEY,
  destinatarios TEXT NOT NULL,
  asunto TEXT NOT NULL,
  alerta_id TEXT,
  estado TEXT DEFAULT 'enviado', -- 'enviado' | 'error'
  respuesta TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_created ON email_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_estado ON email_log(estado);

ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo email_log') THEN
    CREATE POLICY "Acceso completo email_log" ON email_log FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. Función para limpiar logs antiguos (>90 días)
-- Útil para evitar que la tabla crezca indefinidamente
CREATE OR REPLACE FUNCTION limpiar_email_log_antiguo()
RETURNS void AS $$
BEGIN
  DELETE FROM email_log WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- FIN
SELECT 'SQL V20 - Sistema de emails creado' as resultado;
