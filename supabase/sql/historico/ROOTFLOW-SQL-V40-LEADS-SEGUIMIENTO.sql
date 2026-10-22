-- =====================================================
-- ROOTFLOW ERP V40 - SEGUIMIENTO/ACTIVIDADES DE LEADS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Historial de interacciones con cada lead (prospecting):
-- llamadas, emails, visitas, muestras enviadas, notas, etc.
-- =====================================================

CREATE TABLE IF NOT EXISTS lead_actividades (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'nota',
  -- tipos: 'llamada', 'email', 'whatsapp', 'reunion', 'visita',
  --        'muestra', 'presupuesto', 'nota', 'cambio_estado'
  fecha TIMESTAMPTZ DEFAULT NOW(),       -- cuándo ocurrió la interacción
  resumen TEXT,                          -- qué se habló / resultado
  resultado TEXT,                        -- 'positivo', 'neutro', 'negativo', 'sin_respuesta'
  proximo_paso TEXT,                     -- qué hay que hacer después
  proxima_fecha DATE,                    -- cuándo hacer el seguimiento
  estado_anterior TEXT,                  -- para registros de cambio de estado
  estado_nuevo TEXT,
  socio_id INTEGER REFERENCES socios(id) ON DELETE SET NULL,  -- quién hizo la gestión
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_act_lead ON lead_actividades(lead_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_lead_act_proxima ON lead_actividades(proxima_fecha) WHERE proxima_fecha IS NOT NULL;

ALTER TABLE lead_actividades ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo lead_actividades') THEN
    CREATE POLICY "Acceso completo lead_actividades" ON lead_actividades FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'lead_actividades') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lead_actividades;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Campo extra en leads para ver de un vistazo la última gestión
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS proximo_seguimiento DATE;

NOTIFY pgrst, 'reload schema';

SELECT 'V40 OK - Seguimiento de leads' as resultado;
