-- =====================================================
-- ROOTFLOW ERP V41 - RACKS Y UBICACIÓN VISUAL DE BANDEJAS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Sistema visual de trazabilidad física:
-- - racks_config: define el layout físico (racks, baldas, bandejas)
-- - lote_bandejas: cada bandeja ocupada por un lote (trazabilidad real)
-- =====================================================

-- 1. Configuración de racks (el "mapa" físico del invernadero/cámara)
CREATE TABLE IF NOT EXISTS racks_config (
  id SERIAL PRIMARY KEY,
  codigo TEXT NOT NULL,            -- "A", "B", "C1"...
  nombre TEXT,                     -- "Rack A - Germinación"
  num_baldas INTEGER DEFAULT 4,    -- estantes verticales
  bandejas_por_balda INTEGER DEFAULT 6,  -- bandejas por estante
  tamano_bandeja TEXT DEFAULT '1020',    -- "1020", "medio", "cuarto", custom
  pos_x INTEGER DEFAULT 0,         -- posición en el mapa visual (columna)
  pos_y INTEGER DEFAULT 0,         -- posición en el mapa visual (fila)
  color TEXT DEFAULT '#22C55E',    -- color identificativo del rack
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  orden INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ocupación de bandejas por lote (una fila por cada bandeja física usada)
CREATE TABLE IF NOT EXISTS lote_bandejas (
  id SERIAL PRIMARY KEY,
  lote_id INTEGER NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
  rack_id INTEGER REFERENCES racks_config(id) ON DELETE SET NULL,
  rack_codigo TEXT,                -- copia para histórico aunque se borre el rack
  balda INTEGER NOT NULL,          -- nº de estante (1..num_baldas)
  posicion INTEGER NOT NULL,       -- nº de bandeja en el estante (1..bandejas_por_balda)
  codigo_ubicacion TEXT,           -- "A-2-5" (rack-balda-posicion) generado
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rack_id, balda, posicion)  -- una bandeja física no puede tener 2 lotes activos
);

CREATE INDEX IF NOT EXISTS idx_lote_bandejas_lote ON lote_bandejas(lote_id);
CREATE INDEX IF NOT EXISTS idx_lote_bandejas_rack ON lote_bandejas(rack_id);

-- 3. Campo resumen en lotes (para mostrar de un vistazo)
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS ubicacion_resumen TEXT;

-- 4. RLS
ALTER TABLE racks_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE lote_bandejas ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo racks_config') THEN
    CREATE POLICY "Acceso completo racks_config" ON racks_config FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo lote_bandejas') THEN
    CREATE POLICY "Acceso completo lote_bandejas" ON lote_bandejas FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 5. Realtime
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'racks_config') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE racks_config;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'lote_bandejas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE lote_bandejas;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. Racks de ejemplo (solo si no hay ninguno)
INSERT INTO racks_config (codigo, nombre, num_baldas, bandejas_por_balda, tamano_bandeja, pos_x, pos_y, color, orden)
SELECT 'A', 'Rack A', 4, 6, '1020', 0, 0, '#22C55E', 1
WHERE NOT EXISTS (SELECT 1 FROM racks_config);

INSERT INTO racks_config (codigo, nombre, num_baldas, bandejas_por_balda, tamano_bandeja, pos_x, pos_y, color, orden)
SELECT 'B', 'Rack B', 4, 6, '1020', 1, 0, '#3B82F6', 2
WHERE (SELECT COUNT(*) FROM racks_config) = 1;

NOTIFY pgrst, 'reload schema';

SELECT 'V41 OK - Racks y ubicación visual de bandejas' as resultado;
