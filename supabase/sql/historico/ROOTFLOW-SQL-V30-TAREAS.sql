-- =====================================================
-- ROOTFLOW ERP V30 - TAREAS MEJORADAS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Añade campos para vincular tareas con socios y recordatorios Slack
-- =====================================================

-- Añadir socio_id a tareas (relación con tabla socios real)
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS socio_id INTEGER REFERENCES socios(id) ON DELETE SET NULL;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS hora_limite TIME;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS recordatorio_slack BOOLEAN DEFAULT FALSE;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS recordatorio_minutos_antes INTEGER DEFAULT 60;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS recordatorio_enviado BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tareas_socio ON tareas(socio_id);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_limite ON tareas(fecha_limite);
CREATE INDEX IF NOT EXISTS idx_tareas_recordatorio ON tareas(recordatorio_slack, recordatorio_enviado, fecha_limite);

-- Refrescar schema
NOTIFY pgrst, 'reload schema';

SELECT 'V30 OK - Tareas mejoradas con socios y recordatorios' as resultado;
