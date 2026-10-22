-- =====================================================
-- ROOTFLOW ERP V63 — PERIODICIDAD DE FACTURACIÓN + FACTURAS AGRUPADAS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Permite definir por cliente cada cuánto se factura (por pedido,
-- semanal, quincenal o mensual) y generar facturas agrupadas que
-- suman los albaranes entregados del periodo.
-- =====================================================

-- 1. Periodicidad de facturación por cliente
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS periodicidad_facturacion TEXT DEFAULT 'por_pedido';
-- Valores: 'por_pedido' | 'semanal' | 'quincenal' | 'mensual'

-- Migración suave: los clientes que ya estaban en SEPA B2B semanal pasan a periodicidad semanal
UPDATE clientes SET periodicidad_facturacion = 'semanal' 
WHERE modalidad_cobro = 'sepa_b2b_semanal' AND (periodicidad_facturacion IS NULL OR periodicidad_facturacion = 'por_pedido');

-- 2. Campos para facturas agrupadas en la tabla facturas normal
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'pedido';
-- 'pedido' = factura clásica de un pedido | 'agrupada' = suma de albaranes del periodo
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS albaranes_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS periodo_desde DATE;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS periodo_hasta DATE;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS concepto TEXT;

-- 3. En albaranes ya existe numero_factura (V58); aseguramos índice
CREATE INDEX IF NOT EXISTS idx_albaranes_num_factura ON albaranes(numero_factura);

NOTIFY pgrst, 'reload schema';

SELECT 'V63 OK — Periodicidad de facturación + facturas agrupadas' as resultado;
