-- =====================================================
-- ROOTFLOW ERP V47 - REEMBOLSOS A SOCIOS (deuda 551)
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Registro de devoluciones de la empresa a los socios
-- por los gastos que adelantaron de su bolsillo.
-- =====================================================

CREATE TABLE IF NOT EXISTS reembolsos_socios (
  id SERIAL PRIMARY KEY,
  socio_clave TEXT NOT NULL,        -- 'socio_nico' | 'socio_peri' | 'socio_guzman'
  socio_id INTEGER REFERENCES socios(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  importe DECIMAL(12, 2) NOT NULL,
  concepto TEXT,
  metodo TEXT DEFAULT 'transferencia',  -- 'transferencia' | 'efectivo' | 'bizum'
  referencia TEXT,                       -- nº operación bancaria
  notas TEXT,
  archivo_url TEXT,                      -- justificante de la transferencia
  archivo_nombre TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reembolsos_socio ON reembolsos_socios(socio_clave, fecha DESC);

ALTER TABLE reembolsos_socios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo reembolsos_socios') THEN
    CREATE POLICY "Acceso completo reembolsos_socios" ON reembolsos_socios FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reembolsos_socios') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reembolsos_socios;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V47 OK - Reembolsos a socios (deuda 551)' as resultado;
