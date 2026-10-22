-- =====================================================
-- ROOTFLOW ERP V58 — ALBARANES (delivery notes)
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Sistema completo de albaranes con relación N:N a pedidos.
-- Permite máxima flexibilidad: 1 pedido → 1 albarán, varios pedidos
-- agrupados en 1 albarán, o 1 pedido partido en varios albaranes.
-- =====================================================

-- 1. TABLA ALBARANES
CREATE TABLE IF NOT EXISTS albaranes (
  id TEXT PRIMARY KEY,                              -- ej: A-2026-0001
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  
  -- Fechas
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_entrega_prevista DATE,
  fecha_entrega_real DATE,
  
  -- Estado y tipo
  estado TEXT DEFAULT 'generado',                   -- 'generado' | 'entregado' | 'facturado' | 'anulado'
  valorado BOOLEAN DEFAULT FALSE,                   -- false = sin precios (modo HORECA default)
  
  -- Snapshot embebido de items y datos del cliente
  items_json JSONB DEFAULT '[]'::jsonb,             -- [{ producto_id, producto_nombre, producto_unidad, cantidad, precio_unitario, subtotal }]
  
  -- Snapshot datos cliente (para histórico)
  cliente_nombre TEXT,
  cliente_cif TEXT,
  direccion_entrega TEXT,
  
  -- Totales (siempre se calculan; se muestran sólo si valorado=true)
  subtotal DECIMAL(12, 2) DEFAULT 0,
  descuento_aplicado DECIMAL(12, 2) DEFAULT 0,
  base_imponible DECIMAL(12, 2) DEFAULT 0,
  iva_porcentaje DECIMAL(5, 2) DEFAULT 4,
  iva DECIMAL(12, 2) DEFAULT 0,
  recargo_equivalencia BOOLEAN DEFAULT FALSE,
  re_importe DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  
  -- Facturación (Fase 3)
  factura_semanal_id INTEGER REFERENCES facturas_semanales(id) ON DELETE SET NULL,
  numero_factura TEXT,                              -- si se factura individual (prepago)
  
  -- Firma del cliente
  firma_url TEXT,                                   -- URL del albarán firmado (escaneado)
  firma_nombre_archivo TEXT,
  
  -- Logística
  repartidor TEXT,
  vehiculo TEXT,
  
  -- Notas
  notas TEXT,
  observaciones_entrega TEXT,                       -- incidencias en la entrega
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_albaranes_cliente ON albaranes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_albaranes_fecha ON albaranes(fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_albaranes_estado ON albaranes(estado);
CREATE INDEX IF NOT EXISTS idx_albaranes_factura ON albaranes(factura_semanal_id);

ALTER TABLE albaranes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo albaranes" ON albaranes;
CREATE POLICY "Acceso completo albaranes" ON albaranes FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'albaranes') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE albaranes;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. RELACIÓN N:N CON PEDIDOS
CREATE TABLE IF NOT EXISTS albaran_pedidos (
  id SERIAL PRIMARY KEY,
  albaran_id TEXT NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  
  -- Qué se entregó de este pedido en este albarán (puede ser parcial)
  items_entregados_json JSONB DEFAULT '[]'::jsonb,  -- [{ producto_id, cantidad }]
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(albaran_id, pedido_id)
);

CREATE INDEX IF NOT EXISTS idx_albaran_pedidos_albaran ON albaran_pedidos(albaran_id);
CREATE INDEX IF NOT EXISTS idx_albaran_pedidos_pedido ON albaran_pedidos(pedido_id);

ALTER TABLE albaran_pedidos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo albaran_pedidos" ON albaran_pedidos;
CREATE POLICY "Acceso completo albaran_pedidos" ON albaran_pedidos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'albaran_pedidos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE albaran_pedidos;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. Añadir referencia a albarán en pedidos (informativo, el origen real está en albaran_pedidos)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS albaran_principal_id TEXT REFERENCES albaranes(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';

SELECT 'V58 OK — Sistema de albaranes completo' as resultado;
