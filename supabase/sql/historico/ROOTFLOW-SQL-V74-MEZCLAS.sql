-- =====================================================
-- ROOTFLOW ERP V74 — MEZCLAS DE VARIEDADES (Micromezclum)
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Una mezcla NO es una variedad: es un conjunto de varias.
-- Sirve para imprimir etiquetas de producto final donde figura
-- el nombre comercial de la mezcla y las variedades que integra.
-- =====================================================

CREATE TABLE IF NOT EXISTS mezclas (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,                        -- "Micromezclum", "Mezcla picante"...
  descripcion TEXT,                            -- línea opcional bajo el nombre
  variedades_ids JSONB DEFAULT '[]'::jsonb,    -- [3, 7, 12] → ids de la tabla variedades
  formato_gramos INTEGER DEFAULT 100,          -- peso por envase habitual
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mezclas_activo ON mezclas(activo);

ALTER TABLE mezclas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo mezclas" ON mezclas;
CREATE POLICY "Acceso completo mezclas" ON mezclas FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'mezclas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mezclas;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Mezcla de ejemplo (se puede editar o borrar desde el ERP)
INSERT INTO mezclas (nombre, descripcion, formato_gramos)
SELECT 'Micromezclum', 'Mezcla de microbrotes de temporada', 100
WHERE NOT EXISTS (SELECT 1 FROM mezclas WHERE lower(nombre) = 'micromezclum');

NOTIFY pgrst, 'reload schema';

SELECT 'V74 OK — Mezclas de variedades (Micromezclum)' as resultado;
