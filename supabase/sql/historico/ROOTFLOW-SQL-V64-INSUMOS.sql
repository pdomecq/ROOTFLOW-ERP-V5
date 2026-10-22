-- =====================================================
-- ROOTFLOW ERP V64 — INVENTARIO DE INSUMOS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Control de existencias de insumos y consumibles: semillas,
-- sustrato, envases, etiquetas, productos de limpieza, etc.
-- Avisa cuando bajan del mínimo para reponer.
-- =====================================================

CREATE TABLE IF NOT EXISTS insumos (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  categoria TEXT DEFAULT 'otros',
  -- 'semillas' | 'sustrato' | 'envases' | 'etiquetas' | 'limpieza' | 'consumibles' | 'epi' | 'otros'
  
  -- Stock
  stock_actual DECIMAL(12, 2) DEFAULT 0,
  unidad TEXT DEFAULT 'ud',                    -- 'ud' | 'kg' | 'g' | 'L' | 'ml' | 'rollo' | 'caja' | 'saco'
  stock_minimo DECIMAL(12, 2) DEFAULT 0,       -- umbral de aviso de reposición
  
  -- Compra / proveedor
  proveedor TEXT,
  precio_unitario DECIMAL(12, 2) DEFAULT 0,    -- coste por unidad
  url_compra TEXT,                             -- link para recomprar
  referencia_proveedor TEXT,                   -- SKU / código del proveedor
  
  -- Vinculación opcional con variedad (para semillas)
  variedad_id INTEGER REFERENCES variedades(id) ON DELETE SET NULL,
  
  -- Control
  ubicacion TEXT,                              -- dónde está guardado
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  fecha_ultima_compra DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insumos_categoria ON insumos(categoria);
CREATE INDEX IF NOT EXISTS idx_insumos_activo ON insumos(activo);

ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo insumos" ON insumos;
CREATE POLICY "Acceso completo insumos" ON insumos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'insumos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE insumos;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Movimientos de insumos (entradas por compra, salidas por consumo)
CREATE TABLE IF NOT EXISTS insumo_movimientos (
  id SERIAL PRIMARY KEY,
  insumo_id INTEGER NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL,                          -- 'entrada' (compra) | 'salida' (consumo) | 'ajuste'
  cantidad DECIMAL(12, 2) NOT NULL,            -- positiva siempre; el tipo indica el signo
  stock_resultante DECIMAL(12, 2),
  motivo TEXT,
  coste_total DECIMAL(12, 2),                  -- para entradas: cantidad * precio
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insumo_mov_insumo ON insumo_movimientos(insumo_id, fecha DESC);

ALTER TABLE insumo_movimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo insumo_movimientos" ON insumo_movimientos;
CREATE POLICY "Acceso completo insumo_movimientos" ON insumo_movimientos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'insumo_movimientos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE insumo_movimientos;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V64 OK — Inventario de insumos' as resultado;
