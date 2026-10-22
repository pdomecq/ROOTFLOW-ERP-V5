-- =====================================================
-- ROOTFLOW ERP V56 — INTEGRACIÓN SLACK (notificaciones)
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Permite configurar un webhook de Slack para recibir resúmenes
-- diarios de tareas al móvil y avisos en eventos clave.
-- =====================================================

CREATE TABLE IF NOT EXISTS config_slack (
  id SERIAL PRIMARY KEY,
  webhook_url TEXT,                          -- URL del incoming webhook
  canal TEXT,                                -- Solo informativo (se elige al crear el webhook)
  
  -- Activación
  activo BOOLEAN DEFAULT FALSE,
  
  -- Resumen diario
  enviar_resumen_diario BOOLEAN DEFAULT TRUE,
  hora_resumen TIME DEFAULT '08:00',
  
  -- Notificaciones en eventos
  notificar_al_completar_tarea BOOLEAN DEFAULT FALSE,
  notificar_al_crear_lote BOOLEAN DEFAULT FALSE,
  notificar_al_empaquetar BOOLEAN DEFAULT FALSE,
  
  -- Personalización
  nombre_bot TEXT DEFAULT 'RootFlow ERP',
  emoji_bot TEXT DEFAULT ':seedling:',
  
  -- Última vez que se envió el resumen automático (para evitar duplicados)
  ultimo_resumen_enviado TIMESTAMPTZ,
  
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE config_slack ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo config_slack" ON config_slack;
CREATE POLICY "Acceso completo config_slack" ON config_slack FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'config_slack') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE config_slack;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Log de mensajes enviados (para debug y auditoría)
CREATE TABLE IF NOT EXISTS slack_log (
  id SERIAL PRIMARY KEY,
  fecha TIMESTAMPTZ DEFAULT NOW(),
  tipo TEXT,                                 -- 'resumen_diario' | 'tarea_completada' | 'manual' | 'test' | ...
  mensaje TEXT,
  exito BOOLEAN DEFAULT TRUE,
  error_msg TEXT
);

CREATE INDEX IF NOT EXISTS idx_slack_log_fecha ON slack_log(fecha DESC);

ALTER TABLE slack_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo slack_log" ON slack_log;
CREATE POLICY "Acceso completo slack_log" ON slack_log FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

SELECT 'V56 OK — Configuración Slack lista' as resultado;
