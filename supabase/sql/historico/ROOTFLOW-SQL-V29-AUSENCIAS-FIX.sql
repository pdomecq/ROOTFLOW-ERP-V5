-- =====================================================
-- ROOTFLOW ERP V29 - REFUERZO TABLA AUSENCIAS_SOCIOS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Asegura que la tabla ausencias_socios existe con
-- todas las columnas necesarias y permisos correctos.
-- =====================================================

-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS ausencias_socios (
  id SERIAL PRIMARY KEY,
  socio_id INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  tipo TEXT DEFAULT 'personal',
  motivo TEXT,
  todo_el_dia BOOLEAN DEFAULT TRUE,
  hora_inicio TIME,
  hora_fin TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columnas (idempotente)
ALTER TABLE ausencias_socios ADD COLUMN IF NOT EXISTS socio_id INTEGER REFERENCES socios(id) ON DELETE CASCADE;
ALTER TABLE ausencias_socios ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE ausencias_socios ADD COLUMN IF NOT EXISTS fecha_fin DATE;
ALTER TABLE ausencias_socios ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'personal';
ALTER TABLE ausencias_socios ADD COLUMN IF NOT EXISTS motivo TEXT;
ALTER TABLE ausencias_socios ADD COLUMN IF NOT EXISTS todo_el_dia BOOLEAN DEFAULT TRUE;
ALTER TABLE ausencias_socios ADD COLUMN IF NOT EXISTS hora_inicio TIME;
ALTER TABLE ausencias_socios ADD COLUMN IF NOT EXISTS hora_fin TIME;
ALTER TABLE ausencias_socios ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE ausencias_socios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Índices para búsquedas rápidas en calendario
CREATE INDEX IF NOT EXISTS idx_ausencias_fechas ON ausencias_socios(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_ausencias_socio ON ausencias_socios(socio_id);

-- RLS
ALTER TABLE ausencias_socios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo ausencias_socios') THEN
    CREATE POLICY "Acceso completo ausencias_socios" ON ausencias_socios FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Habilitar realtime para que se sincronice entre dispositivos al instante
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'ausencias_socios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE ausencias_socios;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Forzar refresh del schema cache
NOTIFY pgrst, 'reload schema';

-- Verificación
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'ausencias_socios' 
ORDER BY ordinal_position;
