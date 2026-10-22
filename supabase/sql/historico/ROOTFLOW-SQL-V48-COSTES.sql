-- =====================================================
-- ROOTFLOW ERP V48 - CONTABILIDAD ANALÍTICA / COSTE UNITARIO
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Añade fichas técnicas a variedades y productos para poder
-- calcular el coste real por bandeja, por gramo y por unidad
-- de cada producto vendido.
-- =====================================================

-- 1. Ficha técnica por VARIEDAD (consumo de materias primas por bandeja)
ALTER TABLE variedades ADD COLUMN IF NOT EXISTS gramos_semilla_por_bandeja DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE variedades ADD COLUMN IF NOT EXISTS gramos_sustrato_por_bandeja DECIMAL(10, 2) DEFAULT 200;
ALTER TABLE variedades ADD COLUMN IF NOT EXISTS coste_semilla_kg DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE variedades ADD COLUMN IF NOT EXISTS coste_sustrato_l DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE variedades ADD COLUMN IF NOT EXISTS rendimiento_g_por_bandeja DECIMAL(10, 2) DEFAULT 200;
ALTER TABLE variedades ADD COLUMN IF NOT EXISTS merma_pct DECIMAL(5, 2) DEFAULT 5;

-- 2. Ficha técnica por PRODUCTO (envase y etiqueta)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS coste_envase DECIMAL(10, 3) DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS coste_etiqueta DECIMAL(10, 3) DEFAULT 0.02;

-- 3. Mapeo de categorías de gasto -> tipo de coste
-- Tabla simple para que el usuario configure qué categoría de gasto cuenta como qué
CREATE TABLE IF NOT EXISTS mapeo_categorias_coste (
  id SERIAL PRIMARY KEY,
  categoria_gasto TEXT UNIQUE NOT NULL,  -- la categoría como aparece en gastos
  tipo_coste TEXT NOT NULL,
  -- tipos: 'semilla', 'sustrato', 'envases', 'etiquetas',
  --        'energia', 'agua', 'alquiler', 'reparto', 'admin', 'otros', 'excluir'
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mapeo_categoria ON mapeo_categorias_coste(categoria_gasto);

ALTER TABLE mapeo_categorias_coste ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo mapeo_categorias_coste') THEN
    CREATE POLICY "Acceso completo mapeo_categorias_coste" ON mapeo_categorias_coste FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'mapeo_categorias_coste') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mapeo_categorias_coste;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V48 OK - Contabilidad analítica (coste por bandeja, por unidad)' as resultado;
