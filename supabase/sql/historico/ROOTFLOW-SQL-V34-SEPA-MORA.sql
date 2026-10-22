-- =====================================================
-- ROOTFLOW ERP V34 - DOMICILIACIÓN SEPA B2B + MORA LEY 3/2004
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- 1. Datos SEPA en clientes
-- 2. Mandatos SEPA (uno por cliente, B2B)
-- 3. Remesas SEPA generadas (registro)
-- 4. Vencimiento y método de cobro en facturas
-- =====================================================

-- 1. Campos SEPA en clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS sepa_activo BOOLEAN DEFAULT FALSE;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS sepa_iban TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS sepa_bic TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS sepa_titular TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS sepa_mandato_ref TEXT;       -- referencia única del mandato
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS sepa_mandato_fecha DATE;     -- fecha de firma del mandato
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS sepa_tipo TEXT DEFAULT 'B2B'; -- B2B (empresas) o CORE (consumidor)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS plazo_pago_dias INTEGER DEFAULT 30; -- máx 30 por Ley 3/2004 productos perecederos

-- 2. Métodos de cobro y plazo de pago en facturas
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS metodo_cobro TEXT DEFAULT 'transferencia'; -- 'transferencia', 'sepa_b2b', 'efectivo', 'contado'
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS plazo_pago_dias INTEGER DEFAULT 30;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS dias_atraso INTEGER DEFAULT 0; -- calculado, días pasados de vencimiento
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS intereses_mora DECIMAL(10,2) DEFAULT 0;

-- 3. Tabla de remesas SEPA (cada fichero XML pain.008 generado)
CREATE TABLE IF NOT EXISTS remesas_sepa (
  id SERIAL PRIMARY KEY,
  referencia TEXT NOT NULL UNIQUE,  -- ID único de la remesa (ej: ROOTFLOW-20260112-001)
  fecha_creacion DATE DEFAULT CURRENT_DATE,
  fecha_cobro DATE NOT NULL,        -- fecha en que se ejecutará el cargo
  num_facturas INTEGER DEFAULT 0,
  importe_total DECIMAL(12, 2) DEFAULT 0,
  estado TEXT DEFAULT 'preparada', -- 'preparada', 'enviada', 'cobrada', 'parcial', 'devuelta'
  xml_url TEXT,                     -- URL al XML generado en Storage (opcional)
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla intermedia: qué facturas van en cada remesa
CREATE TABLE IF NOT EXISTS remesas_sepa_items (
  id SERIAL PRIMARY KEY,
  remesa_id INTEGER NOT NULL REFERENCES remesas_sepa(id) ON DELETE CASCADE,
  factura_id TEXT NOT NULL,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  importe DECIMAL(12, 2) NOT NULL,
  iban_deudor TEXT,
  mandato_ref TEXT,
  estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'cobrado', 'devuelto'
  motivo_devolucion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_remesas_fecha ON remesas_sepa(fecha_cobro DESC);
CREATE INDEX IF NOT EXISTS idx_remesas_items_remesa ON remesas_sepa_items(remesa_id);
CREATE INDEX IF NOT EXISTS idx_remesas_items_factura ON remesas_sepa_items(factura_id);

-- 5. RLS
ALTER TABLE remesas_sepa ENABLE ROW LEVEL SECURITY;
ALTER TABLE remesas_sepa_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo remesas_sepa') THEN
    CREATE POLICY "Acceso completo remesas_sepa" ON remesas_sepa FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo remesas_sepa_items') THEN
    CREATE POLICY "Acceso completo remesas_sepa_items" ON remesas_sepa_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Realtime para remesas
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'remesas_sepa') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE remesas_sepa;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'remesas_sepa_items') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE remesas_sepa_items;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Refrescar schema
NOTIFY pgrst, 'reload schema';

SELECT 'V34 OK - SEPA B2B + Mora Ley 3/2004' as resultado;
