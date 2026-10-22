-- =====================================================
-- ROOTFLOW ERP V52 — REDISEÑO MUESTRAS (JSON embebido) + MANDATO SEPA
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Soluciona el problema de items de muestra perdidos: ahora los items
-- van como JSON dentro de la propia muestra. Más simple y robusto.
-- =====================================================

-- 1. Columna JSONB con los items en la propia tabla muestras
ALTER TABLE muestras ADD COLUMN IF NOT EXISTS items_json JSONB DEFAULT '[]'::jsonb;

-- 2. Migración: copiar items existentes de muestra_items → items_json
-- (solo si muestra_items tiene datos y items_json está vacío)
DO $$
DECLARE
  r RECORD;
  items_arr JSONB;
BEGIN
  -- Solo migrar si la tabla muestra_items existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'muestra_items') THEN
    FOR r IN SELECT id FROM muestras WHERE (items_json IS NULL OR items_json = '[]'::jsonb)
    LOOP
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'producto_id', producto_id,
        'cantidad', cantidad
      )), '[]'::jsonb) INTO items_arr
      FROM muestra_items WHERE muestra_id = r.id;
      
      IF items_arr != '[]'::jsonb THEN
        UPDATE muestras SET items_json = items_arr WHERE id = r.id;
      END IF;
    END LOOP;
  END IF;
END $$;

-- 3. Mandatos SEPA B2B firmados (para tracking)
CREATE TABLE IF NOT EXISTS mandatos_sepa (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  referencia TEXT NOT NULL,        -- ej: ROOTFLOW-CLI0001-2026
  fecha_emision DATE DEFAULT CURRENT_DATE,
  fecha_firma DATE,
  fecha_envio_banco DATE,
  estado TEXT DEFAULT 'borrador',  -- 'borrador' | 'enviado_cliente' | 'firmado' | 'activo' | 'cancelado'
  archivo_pdf_url TEXT,            -- PDF firmado escaneado
  archivo_pdf_nombre TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mandatos_cliente ON mandatos_sepa(cliente_id);

ALTER TABLE mandatos_sepa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo mandatos_sepa" ON mandatos_sepa;
CREATE POLICY "Acceso completo mandatos_sepa" ON mandatos_sepa FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'mandatos_sepa') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE mandatos_sepa;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 
  'V52 OK — muestras con items_json + mandatos SEPA' as resultado,
  (SELECT COUNT(*) FROM muestras WHERE items_json != '[]'::jsonb) as muestras_con_items_migradas;
