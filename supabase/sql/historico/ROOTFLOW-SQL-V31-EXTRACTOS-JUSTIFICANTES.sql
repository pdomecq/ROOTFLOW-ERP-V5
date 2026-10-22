-- =====================================================
-- ROOTFLOW ERP V31 - REFUERZO EXTRACTOS + JUSTIFICANTES + EXPORT
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Refuerza la tabla extractos_bancarios existente
-- Añade columnas necesarias para justificantes en gastos
-- =====================================================

-- 1. Tabla extractos_bancarios (asegurar que existe con todas las columnas)
CREATE TABLE IF NOT EXISTS extractos_bancarios (
  id SERIAL PRIMARY KEY,
  tipo_cuenta TEXT DEFAULT 'empresa',
  nombre_cuenta TEXT,
  banco TEXT,
  iban TEXT,
  titular TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  saldo_inicial DECIMAL(12, 2),
  saldo_final DECIMAL(12, 2),
  archivo_url TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Asegurar columnas idempotente
ALTER TABLE extractos_bancarios ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT DEFAULT 'empresa';
ALTER TABLE extractos_bancarios ADD COLUMN IF NOT EXISTS nombre_cuenta TEXT;
ALTER TABLE extractos_bancarios ADD COLUMN IF NOT EXISTS banco TEXT;
ALTER TABLE extractos_bancarios ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE extractos_bancarios ADD COLUMN IF NOT EXISTS titular TEXT;
ALTER TABLE extractos_bancarios ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE extractos_bancarios ADD COLUMN IF NOT EXISTS fecha_fin DATE;
ALTER TABLE extractos_bancarios ADD COLUMN IF NOT EXISTS saldo_inicial DECIMAL(12, 2);
ALTER TABLE extractos_bancarios ADD COLUMN IF NOT EXISTS saldo_final DECIMAL(12, 2);
ALTER TABLE extractos_bancarios ADD COLUMN IF NOT EXISTS archivo_url TEXT;
ALTER TABLE extractos_bancarios ADD COLUMN IF NOT EXISTS notas TEXT;

-- 2. Justificante de pago en gastos
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS justificante_pago_url TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS justificante_pago_nombre TEXT;

-- 3. RLS y publication
ALTER TABLE extractos_bancarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo extractos_bancarios') THEN
    CREATE POLICY "Acceso completo extractos_bancarios" ON extractos_bancarios FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Realtime
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'extractos_bancarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE extractos_bancarios;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Refrescar schema
NOTIFY pgrst, 'reload schema';

SELECT 'V31 OK - Refuerzo extractos + justificantes pagos en gastos' as resultado;

-- =====================================================
-- IMPORTANTE: STORAGE BUCKET
-- =====================================================
-- Solo hace falta UN bucket: "facturas-gastos"
-- Si ya existe, perfecto. Si no:
-- Supabase Dashboard → Storage → New bucket → 
--   Name: facturas-gastos
--   Public: ON
-- Luego en Policies del bucket:
--   - SELECT: allow all
--   - INSERT: allow all  
--   - DELETE: allow all
-- =====================================================
