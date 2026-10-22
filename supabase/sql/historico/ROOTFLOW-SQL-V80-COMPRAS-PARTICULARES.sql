-- =====================================================
-- ROOTFLOW ERP V80 — COMPRAS A PARTICULARES (Wallapop y similares)
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Cada compra a un particular guarda:
--   · datos del vendedor (necesarios para el contrato y el modelo 600)
--   · artículos, precio, forma de pago y entrega
--   · documentos: contrato firmado y justificante de pago
--   · seguimiento del ITP (4 %, modelo 600, 30 días hábiles)
--   · vínculo con el gasto de la compra y con el gasto del ITP
-- =====================================================

CREATE TABLE IF NOT EXISTS compras_particulares (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Vendedor (particular)
  vendedor_nombre TEXT,
  vendedor_dni TEXT,
  vendedor_domicilio TEXT,
  vendedor_telefono TEXT,
  vendedor_email TEXT,
  wallapop_usuario TEXT,
  wallapop_anuncio TEXT,

  -- Qué se compra: [{ "descripcion": "...", "referencia": "...", "unidades": 1, "precio": 60 }]
  items_json JSONB DEFAULT '[]'::jsonb,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,

  forma_pago TEXT DEFAULT 'banco',          -- mismos valores que gastos.forma_pago
  pago_via_wallapop BOOLEAN DEFAULT FALSE,
  entrega TEXT DEFAULT 'mano',              -- 'mano' | 'envio'
  categoria_gasto TEXT DEFAULT 'otros',     -- clave de categoriasGasto

  -- Quién firma por Rootflow
  firmante_nombre TEXT,
  firmante_dni TEXT,

  -- Documentos
  contrato_url TEXT,
  justificante_pago_url TEXT,

  -- ITP (modelo 600)
  itp_importe DECIMAL(10, 2) DEFAULT 0,
  itp_plazo DATE,                           -- 30 días hábiles desde la fecha (cálculo a la baja)
  itp_estado TEXT DEFAULT 'pendiente',      -- 'pendiente' | 'presentado'
  itp_fecha_presentacion DATE,
  itp_numero_autoliquidacion TEXT,
  itp_justificante_url TEXT,

  -- Vínculos con gastos
  gasto_id INTEGER REFERENCES gastos(id) ON DELETE SET NULL,
  itp_gasto_id INTEGER REFERENCES gastos(id) ON DELETE SET NULL,

  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_part_fecha ON compras_particulares(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_compras_part_itp ON compras_particulares(itp_estado, itp_plazo);

ALTER TABLE compras_particulares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo compras_particulares" ON compras_particulares;
CREATE POLICY "Acceso completo compras_particulares" ON compras_particulares FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'compras_particulares') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE compras_particulares;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V80 OK — Compras a particulares (contrato + gasto + ITP modelo 600)' AS resultado;
