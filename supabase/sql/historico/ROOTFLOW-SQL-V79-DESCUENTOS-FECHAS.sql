-- =====================================================
-- ROOTFLOW ERP V79 — DESCUENTOS POR FECHAS + CORRECCIÓN DE FACTURAS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- · clientes.descuentos_fechas: tramos [{ "hasta": "2026-09-20", "pct": 20 }]
--   → para entregas hasta esa fecha (incluida) se aplica ese %; después, el
--     descuento general del cliente (campo 'descuento').
-- · albaranes.descuento_pct / facturas.descuento_pct: % fijado a mano al
--   corregir una factura. Si está vacío se usa la regla del cliente por fecha.
--   Así una factura corregida no cambia aunque luego cambien las condiciones.
-- =====================================================

ALTER TABLE clientes  ADD COLUMN IF NOT EXISTS descuentos_fechas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE albaranes ADD COLUMN IF NOT EXISTS descuento_pct DECIMAL(5, 2);
ALTER TABLE facturas  ADD COLUMN IF NOT EXISTS descuento_pct DECIMAL(5, 2);

-- Permitir descuentos con decimales (p. ej. 12,5 %) si la columna era entera
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'clientes' AND column_name = 'descuento'
               AND data_type IN ('integer', 'smallint', 'bigint')) THEN
    ALTER TABLE clientes ALTER COLUMN descuento TYPE DECIMAL(5, 2);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V79 OK — Descuentos por fechas y corrección de facturas' AS resultado;
