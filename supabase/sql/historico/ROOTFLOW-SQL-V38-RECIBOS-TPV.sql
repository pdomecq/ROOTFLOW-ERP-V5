-- =====================================================
-- ROOTFLOW ERP V38 - RECIBOS TPV (ventas a personas físicas)
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Tabla para registrar y archivar los recibos de cobros
-- por TPV (datáfono) a personas físicas / ventas directas
-- que no generan factura formal.
-- =====================================================

CREATE TABLE IF NOT EXISTS recibos_tpv (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  concepto TEXT,                          -- "Venta directa brotes", "Pedido mercado", etc.
  cliente_nombre TEXT,                    -- Nombre del comprador (persona física, opcional)
  importe DECIMAL(12, 2) NOT NULL DEFAULT 0,
  iva_tipo TEXT DEFAULT 'reducido',       -- 'reducido' (4%), 'general', 'exento'
  base_imponible DECIMAL(12, 2),          -- calculado
  iva_importe DECIMAL(12, 2),             -- calculado
  metodo TEXT DEFAULT 'tarjeta',          -- 'tarjeta', 'bizum', 'efectivo'
  referencia_tpv TEXT,                    -- nº operación del datáfono
  pedido_id INTEGER,                      -- vínculo opcional a un pedido
  archivo_url TEXT,                        -- recibo escaneado/foto en Storage
  archivo_nombre TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recibos_tpv_fecha ON recibos_tpv(fecha DESC);

ALTER TABLE recibos_tpv ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo recibos_tpv') THEN
    CREATE POLICY "Acceso completo recibos_tpv" ON recibos_tpv FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'recibos_tpv') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE recibos_tpv;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V38 OK - Recibos TPV' as resultado;

-- =====================================================
-- STORAGE: usa el bucket existente "facturas-gastos"
-- (no hace falta crear uno nuevo). Los recibos TPV se
-- guardan en la carpeta recibos-tpv/ dentro de ese bucket.
-- =====================================================
