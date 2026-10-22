-- =====================================================
-- ROOTFLOW ERP V42 - EVENTOS PERSONALIZADOS EN CALENDARIO
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Eventos manuales (ferias, reuniones, eventos de startups,
-- visitas comerciales, etc.) que no son entregas ni cosechas.
-- Exportables a Google Calendar / Apple / Outlook vía .ics
-- =====================================================

CREATE TABLE IF NOT EXISTS eventos_calendario (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT DEFAULT 'general',
  -- tipos: 'general', 'feria', 'reunion', 'comercial', 'formacion',
  --        'administrativo', 'networking', 'personal'
  fecha_inicio DATE NOT NULL,
  hora_inicio TIME,
  fecha_fin DATE,
  hora_fin TIME,
  todo_el_dia BOOLEAN DEFAULT FALSE,
  ubicacion TEXT,                       -- dirección o lugar del evento
  url TEXT,                             -- enlace (web del evento, meet, etc.)
  color TEXT DEFAULT '#F97316',
  socio_id INTEGER REFERENCES socios(id) ON DELETE SET NULL,  -- quién asiste/responsable
  recordatorio_slack BOOLEAN DEFAULT FALSE,
  recordatorio_dias_antes INTEGER DEFAULT 1,
  recordatorio_enviado BOOLEAN DEFAULT FALSE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos_calendario(fecha_inicio);

ALTER TABLE eventos_calendario ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo eventos_calendario') THEN
    CREATE POLICY "Acceso completo eventos_calendario" ON eventos_calendario FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'eventos_calendario') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE eventos_calendario;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V42 OK - Eventos personalizados en calendario' as resultado;
