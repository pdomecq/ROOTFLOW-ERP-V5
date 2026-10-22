-- =====================================================
-- ROOTFLOW ERP V31 - EXTRACTOS BANCARIOS + JUSTIFICANTES
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- 1. Tabla extractos_bancarios (sube los extractos mensuales)
-- 2. Campo justificante_pago_url en gastos
-- =====================================================

-- 1. Añadir justificante de pago a gastos
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS justificante_pago_url TEXT;

-- 2. Crear tabla extractos_bancarios
CREATE TABLE IF NOT EXISTS extractos_bancarios (
  id SERIAL PRIMARY KEY,
  tipo_cuenta TEXT DEFAULT 'empresa', -- empresa, tarjeta, socio_nico, socio_peri, socio_guzman, otro
  nombre_cuenta TEXT,
  banco TEXT,
  iban TEXT,
  titular TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  saldo_inicial NUMERIC(12, 2),
  saldo_final NUMERIC(12, 2),
  archivo_url TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extractos_fecha ON extractos_bancarios(fecha_fin DESC);
CREATE INDEX IF NOT EXISTS idx_extractos_tipo ON extractos_bancarios(tipo_cuenta);

ALTER TABLE extractos_bancarios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo extractos_bancarios') THEN
    CREATE POLICY "Acceso completo extractos_bancarios" ON extractos_bancarios FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Habilitar realtime
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

NOTIFY pgrst, 'reload schema';

SELECT 'V31 OK - Extractos bancarios + justificantes' as resultado;
