-- =====================================================
-- ROOTFLOW ERP V25 - HISTÓRICO DE STOCK + EMPAQUETADO
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- 1. Tabla movimientos_stock para auditoría
-- 2. Función para empaquetar (granel → empaquetado)
-- =====================================================

-- 1. Tabla de movimientos de stock
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  variedad_id INTEGER REFERENCES variedades(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL, -- 'entrada_cosecha', 'salida_pedido', 'devolucion_pedido', 'empaquetado_in', 'empaquetado_out', 'merma', 'ajuste_manual'
  cantidad INTEGER NOT NULL, -- positivo o negativo
  gramos INTEGER, -- opcional, para movimientos en gramos (granel)
  pedido_id INTEGER REFERENCES pedidos(id) ON DELETE SET NULL,
  lote_id INTEGER REFERENCES lotes(id) ON DELETE SET NULL,
  stock_anterior INTEGER,
  stock_nuevo INTEGER,
  notas TEXT,
  usuario TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_stock(producto_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_variedad ON movimientos_stock(variedad_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_stock(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos_stock(tipo);

ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo movimientos_stock') THEN
    CREATE POLICY "Acceso completo movimientos_stock" ON movimientos_stock FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. Añadir campo gramos_disponibles a productos (para los a granel)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS gramos_disponibles INTEGER DEFAULT 0;
-- Para productos 'listo_sin_empaquetar': cuántos gramos hay sin empaquetar
-- Para productos 'empaquetado': se ignora (se usa stock × formato_gramos)

-- FIN
SELECT 'SQL V25 - Histórico stock + empaquetado creado' as resultado;
