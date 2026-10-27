-- =====================================================
-- ROOTFLOW ERP V85 — FACTURAS DE GASTO: RETENCIÓN IRPF Y BANDEJA DE FACTURAS RECIBIDAS
-- Ejecutar en Supabase SQL Editor (una sola vez; es idempotente)
-- =====================================================
-- 1) Desglose del gasto. gastos.importe sigue siendo lo que se paga (total de la factura).
--    Si la factura lleva retención de IRPF (alquiler, profesionales) o varias bases,
--    se guardan base, IVA y retención por separado y el asiento usa estos campos:
--      gasto (base) + 472 (IVA)  =  4751 (retención)  +  pago (importe)
-- 2) facturas_recibidas: bandeja de facturas de proveedor por revisar. Llegan por
--    "Subir factura" en Gastos o de la revisión diaria del correo. La Edge Function
--    leer-factura guarda el PDF y extrae los datos con IA; al registrarla se crea el gasto.
-- =====================================================

ALTER TABLE gastos ADD COLUMN IF NOT EXISTS base_imponible NUMERIC(12, 2);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS iva_importe NUMERIC(12, 2);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS retencion_pct NUMERIC(5, 2);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS retencion_importe NUMERIC(12, 2);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS numero_factura TEXT;

-- El ERP ya mostraba "CIF Proveedor" en las exportaciones, pero la columna no existía
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS cif TEXT;

CREATE TABLE IF NOT EXISTS facturas_recibidas (
  id SERIAL PRIMARY KEY,
  origen TEXT DEFAULT 'subida',              -- 'subida' | 'gmail'
  email_message_id TEXT,                     -- id del mensaje de Gmail (evita duplicados)
  email_de TEXT,
  email_asunto TEXT,
  email_fecha TIMESTAMPTZ,
  archivo_url TEXT,
  archivo_nombre TEXT,
  archivo_mime TEXT,
  archivo_base64 TEXT,                       -- temporal: lo vacía leer-factura al subirlo al bucket
  archivo_sha256 TEXT,
  datos_json JSONB,                          -- datos extraídos (proveedor, fecha, base, IVA, retención…)
  estado TEXT DEFAULT 'nueva',               -- 'nueva' | 'pendiente' | 'registrada' | 'descartada' | 'duplicada' | 'error'
  error TEXT,
  gasto_id INTEGER REFERENCES gastos(id) ON DELETE SET NULL,
  subido_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_facturas_recibidas_email ON facturas_recibidas(email_message_id, archivo_nombre) WHERE email_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facturas_recibidas_estado ON facturas_recibidas(estado, created_at DESC);

ALTER TABLE facturas_recibidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo facturas_recibidas" ON facturas_recibidas;
CREATE POLICY "Acceso completo facturas_recibidas" ON facturas_recibidas FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'facturas_recibidas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE facturas_recibidas;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Datos privados del servidor (p. ej. el token con el que la revisión diaria del correo mete facturas
-- en la bandeja). RLS activado y SIN políticas: solo lo leen las Edge Functions con la service role.
-- El valor del token se pone aparte (no se guarda en el repositorio).
CREATE TABLE IF NOT EXISTS config_privada (
  clave TEXT PRIMARY KEY,
  valor TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE config_privada ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

SELECT 'V85 OK — Retención IRPF en gastos y bandeja de facturas recibidas' AS resultado;
