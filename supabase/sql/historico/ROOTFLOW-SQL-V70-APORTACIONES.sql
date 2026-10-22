-- =====================================================
-- ROOTFLOW ERP V70 — APORTACIONES DE FONDOS PROPIOS POR SOCIO
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Inyecciones de capital que cada socio hace a la sociedad
-- (transferencias/Bizum directos a la cuenta de la empresa).
-- Se suman a los gastos adelantados para calcular la
-- CONTRIBUCIÓN TOTAL de cada socio, que es lo que se busca
-- equilibrar entre los tres y devolver a partes iguales.
-- =====================================================

CREATE TABLE IF NOT EXISTS aportaciones_socios (
  id SERIAL PRIMARY KEY,
  socio_clave TEXT NOT NULL,                   -- 'socio_nico' | 'socio_peri' | 'socio_guzman'
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  importe DECIMAL(12, 2) NOT NULL,
  metodo TEXT DEFAULT 'transferencia',         -- 'transferencia' | 'bizum' | 'efectivo'
  concepto TEXT,                               -- ej: "Inyección para compra racks nave"
  archivo_url TEXT,                            -- justificante (transferencia) opcional
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aportaciones_socio ON aportaciones_socios(socio_clave, fecha DESC);

ALTER TABLE aportaciones_socios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo aportaciones_socios" ON aportaciones_socios;
CREATE POLICY "Acceso completo aportaciones_socios" ON aportaciones_socios FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'aportaciones_socios') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE aportaciones_socios;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V70 OK — Aportaciones de fondos propios por socio' as resultado;
