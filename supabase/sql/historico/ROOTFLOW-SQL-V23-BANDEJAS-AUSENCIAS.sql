-- =====================================================
-- ROOTFLOW ERP V23 - PRODUCCIÓN BANDEJAS + AUSENCIAS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- 1. Asegurar que lotes tiene 'bandejas' (no 'cantidad')
-- 2. Crear tabla ausencias_socios
-- =====================================================

-- 1. Asegurar columna bandejas en lotes
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS bandejas INTEGER DEFAULT 1;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS gramos_estimados INTEGER; -- gramos cosechables totales (calculado)
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS gramos_para_pedido INTEGER; -- gramos asignados a pedido(s) específicos
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS pedido_id INTEGER REFERENCES pedidos(id) ON DELETE SET NULL; -- pedido asociado (opcional)
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS notas TEXT;

-- Si existe 'cantidad' antiguo, copiar a bandejas (solo si bandejas está vacío)
DO $$
DECLARE
  col_existe INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_existe FROM information_schema.columns 
  WHERE table_name = 'lotes' AND column_name = 'cantidad';
  
  IF col_existe > 0 THEN
    UPDATE lotes SET bandejas = COALESCE(bandejas, cantidad) WHERE bandejas IS NULL OR bandejas = 0;
    RAISE NOTICE 'Migración cantidad → bandejas completada';
  END IF;
END $$;

-- 2. Tabla ausencias_socios (vacaciones, eventos, bodas, etc.)
CREATE TABLE IF NOT EXISTS ausencias_socios (
  id SERIAL PRIMARY KEY,
  socio_id INTEGER NOT NULL REFERENCES socios(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  tipo TEXT DEFAULT 'personal', -- personal, vacaciones, evento, baja, viaje, otro
  motivo TEXT,
  todo_el_dia BOOLEAN DEFAULT TRUE,
  hora_inicio TIME,
  hora_fin TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ausencias_fechas ON ausencias_socios(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_ausencias_socio ON ausencias_socios(socio_id);

ALTER TABLE ausencias_socios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo ausencias_socios') THEN
    CREATE POLICY "Acceso completo ausencias_socios" ON ausencias_socios FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 3. Configuración global del sistema (para ajustes futuros)
CREATE TABLE IF NOT EXISTS ajustes_sistema (
  id SERIAL PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  valor TEXT,
  tipo TEXT DEFAULT 'string', -- string, number, boolean, json
  descripcion TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ajustes_sistema ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo ajustes_sistema') THEN
    CREATE POLICY "Acceso completo ajustes_sistema" ON ajustes_sistema FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- FIN
SELECT 'SQL V23 - Producción por bandejas + ausencias creado' as resultado;
