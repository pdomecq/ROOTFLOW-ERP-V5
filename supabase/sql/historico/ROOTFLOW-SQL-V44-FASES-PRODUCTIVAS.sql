-- =====================================================
-- ROOTFLOW ERP V44 - FASES PRODUCTIVAS (GERMINACIÓN + CRECIMIENTO)
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- 1. Tipo de rack: germinación o crecimiento
-- 2. Fase del lote: siembra -> germinacion -> crecimiento -> cosechado
-- 3. Historial de movimientos entre racks (traslados)
-- 4. Tiempos de cada fase para estimar cosecha
-- =====================================================

-- 1. Tipo en racks
ALTER TABLE racks_config ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'crecimiento';
-- 'germinacion' (invernadero, días iniciales en oscuridad/humedad)
-- 'crecimiento' (con luz, hasta cosecha)
-- 'mixto' (sirve para ambas)

-- 2. Campos de fase en lotes
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS fase TEXT DEFAULT 'siembra';
-- 'siembra'      -> recién creado, todavía no sembrado
-- 'germinacion'  -> en rack de germinación
-- 'crecimiento'  -> trasladado a rack de crecimiento (con luz)
-- 'cosechado'    -> ya cosechado
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS fecha_germinacion_inicio DATE;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS fecha_traslado_crecimiento DATE;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS dias_germinacion INTEGER DEFAULT 3;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS dias_crecimiento INTEGER DEFAULT 7;

-- 3. Por variedad: días típicos de cada fase
ALTER TABLE variedades ADD COLUMN IF NOT EXISTS dias_germinacion INTEGER DEFAULT 3;
-- Ya existe dias_crecimiento en variedades

-- 4. Historial de movimientos de lote entre racks
CREATE TABLE IF NOT EXISTS lote_movimientos (
  id SERIAL PRIMARY KEY,
  lote_id INTEGER NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,  -- 'siembra', 'traslado', 'cosecha', 'merma'
  fecha TIMESTAMPTZ DEFAULT NOW(),
  rack_origen_id INTEGER REFERENCES racks_config(id) ON DELETE SET NULL,
  rack_destino_id INTEGER REFERENCES racks_config(id) ON DELETE SET NULL,
  ubicaciones_origen TEXT[],   -- ej: ['A-1-1','A-1-2']
  ubicaciones_destino TEXT[],
  bandejas_afectadas INTEGER DEFAULT 0,
  fase_anterior TEXT,
  fase_nueva TEXT,
  socio_id INTEGER REFERENCES socios(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lote_mov_lote ON lote_movimientos(lote_id, fecha DESC);

ALTER TABLE lote_movimientos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo lote_movimientos') THEN
    CREATE POLICY "Acceso completo lote_movimientos" ON lote_movimientos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'lote_movimientos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lote_movimientos;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Inicializar los lotes existentes a la fase correspondiente según su estado
UPDATE lotes SET fase = 'cosechado' WHERE estado = 'cosechado' AND fase = 'siembra';
UPDATE lotes SET fase = 'crecimiento' WHERE estado = 'activo' AND fase = 'siembra';

NOTIFY pgrst, 'reload schema';

SELECT 'V44 OK - Fases productivas (germinación + crecimiento)' as resultado;
