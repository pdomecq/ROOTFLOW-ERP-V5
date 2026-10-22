-- =====================================================
-- ROOTFLOW ERP V51 — FIX MUESTRA_ITEMS + ETIQUETAS PERSISTENTES + MODALIDAD COBRO
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- ===== 1. FIX: Tabla muestra_items (por si no se creó bien en V15) =====
CREATE TABLE IF NOT EXISTS muestra_items (
  id SERIAL PRIMARY KEY,
  muestra_id INTEGER NOT NULL REFERENCES muestras(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  cantidad INTEGER DEFAULT 1,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_muestra_items_muestra ON muestra_items(muestra_id);

ALTER TABLE muestra_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo muestra_items" ON muestra_items;
CREATE POLICY "Acceso completo muestra_items" ON muestra_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'muestra_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE muestra_items;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 2. ETIQUETAS GENERADAS: persistir para reimprimir =====
CREATE TABLE IF NOT EXISTS etiquetas_generadas (
  id SERIAL PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'producto_empaquetado',
  -- 'producto_empaquetado' | 'muestra' | 'lote'
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  lote_id INTEGER REFERENCES lotes(id) ON DELETE SET NULL,
  pedido_id INTEGER REFERENCES pedidos(id) ON DELETE SET NULL,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  muestra_id INTEGER REFERENCES muestras(id) ON DELETE SET NULL,
  unidades INTEGER NOT NULL DEFAULT 1,
  zpl_contenido TEXT NOT NULL,
  descripcion TEXT,                              -- ej: "Rúcula 30g × 40ud → Pizzería Rossi"
  impresa BOOLEAN DEFAULT FALSE,
  fecha_impresa TIMESTAMPTZ,
  socio_id INTEGER REFERENCES socios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etiq_gen_pendientes ON etiquetas_generadas(impresa, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_etiq_gen_pedido ON etiquetas_generadas(pedido_id);

ALTER TABLE etiquetas_generadas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo etiquetas_generadas" ON etiquetas_generadas;
CREATE POLICY "Acceso completo etiquetas_generadas" ON etiquetas_generadas FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'etiquetas_generadas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE etiquetas_generadas;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===== 3. MODALIDAD DE COBRO POR CLIENTE =====
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS modalidad_cobro TEXT DEFAULT 'sepa_b2b_semanal';
-- 'sepa_b2b_semanal' = SEPA B2B con factura semanal agrupada (estándar HORECA)
-- 'prepago'          = Transferencia/Bizum anticipado (un pedido = una factura)
-- 'contraentrega'    = Pago al entregar (TPV/Bizum/efectivo)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS dia_corte_semanal INTEGER DEFAULT 5; -- 1=lunes ... 5=viernes ... 7=domingo
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS mandato_sepa_b2b TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS mandato_fecha_firma DATE;

-- En pedidos: marcar si forma parte de factura agrupada semanal
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS factura_semanal_id INTEGER;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_recibido BOOLEAN DEFAULT FALSE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS fecha_pago_recibido DATE;

-- Tabla de facturas semanales agrupadas (resumen de albaranes de la semana)
CREATE TABLE IF NOT EXISTS facturas_semanales (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  semana_anyo INTEGER NOT NULL,        -- ej: 2026
  semana_num INTEGER NOT NULL,         -- ej: 21
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NOT NULL,
  fecha_emision DATE DEFAULT CURRENT_DATE,
  fecha_remesa DATE,                   -- cuándo se envió al banco
  numero_factura TEXT,                 -- ej: F-2026-0042
  num_pedidos INTEGER DEFAULT 0,
  base_imponible DECIMAL(12, 2) DEFAULT 0,
  iva DECIMAL(12, 2) DEFAULT 0,
  recargo_eq DECIMAL(12, 2) DEFAULT 0,
  total DECIMAL(12, 2) DEFAULT 0,
  estado TEXT DEFAULT 'borrador',      -- 'borrador' | 'emitida' | 'en_remesa' | 'cobrada' | 'devuelta'
  fecha_cobro DATE,
  notas TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cliente_id, semana_anyo, semana_num)
);

CREATE INDEX IF NOT EXISTS idx_facturas_sem_cliente ON facturas_semanales(cliente_id, semana_anyo DESC, semana_num DESC);
CREATE INDEX IF NOT EXISTS idx_facturas_sem_estado ON facturas_semanales(estado);

ALTER TABLE facturas_semanales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo facturas_semanales" ON facturas_semanales;
CREATE POLICY "Acceso completo facturas_semanales" ON facturas_semanales FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'facturas_semanales') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE facturas_semanales;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Foreign key entre pedidos y facturas semanales
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'pedidos_factura_semanal_fk') THEN
    ALTER TABLE pedidos ADD CONSTRAINT pedidos_factura_semanal_fk FOREIGN KEY (factura_semanal_id) REFERENCES facturas_semanales(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V51 OK — muestra_items + etiquetas persistentes + modalidad cobro + facturas semanales' as resultado;
