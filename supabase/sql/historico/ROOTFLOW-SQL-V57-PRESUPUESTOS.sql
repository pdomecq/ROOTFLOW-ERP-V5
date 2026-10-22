-- =====================================================
-- ROOTFLOW ERP V57 — FIX PRESUPUESTOS (items JSON embebido)
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Mismo patrón que solucionó las muestras (V52): los items van
-- DENTRO del propio presupuesto como JSON. Más robusto y no
-- depende de RLS o foreign keys de la tabla aparte.
-- =====================================================

-- 1. Columna items_json embebida
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS items_json JSONB DEFAULT '[]'::jsonb;

-- 2. Migrar items existentes de presupuesto_items → items_json
DO $$
DECLARE
  r RECORD;
  items_arr JSONB;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'presupuesto_items') THEN
    FOR r IN SELECT id FROM presupuestos WHERE (items_json IS NULL OR items_json = '[]'::jsonb)
    LOOP
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'producto_id', producto_id,
        'cantidad', cantidad,
        'precio_unitario', precio_unitario,
        'subtotal', subtotal
      )), '[]'::jsonb) INTO items_arr
      FROM presupuesto_items WHERE presupuesto_id = r.id;
      
      IF items_arr != '[]'::jsonb THEN
        UPDATE presupuestos SET items_json = items_arr WHERE id = r.id;
      END IF;
    END LOOP;
  END IF;
END $$;

-- 3. Asegurar que la tabla presupuesto_items exista bien (por si está mal)
CREATE TABLE IF NOT EXISTS presupuesto_items (
  id SERIAL PRIMARY KEY,
  presupuesto_id TEXT NOT NULL,
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  cantidad INTEGER DEFAULT 1,
  precio_unitario DECIMAL(10, 2) DEFAULT 0,
  subtotal DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE presupuesto_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo presupuesto_items" ON presupuesto_items;
CREATE POLICY "Acceso completo presupuesto_items" ON presupuesto_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'presupuesto_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE presupuesto_items;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 
  'V57 OK — Presupuestos con items_json embebido' as resultado,
  (SELECT COUNT(*) FROM presupuestos WHERE items_json != '[]'::jsonb) as presupuestos_con_items;
