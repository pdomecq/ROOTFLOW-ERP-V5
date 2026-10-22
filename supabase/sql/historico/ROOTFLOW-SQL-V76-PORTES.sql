-- =====================================================
-- ROOTFLOW ERP V76 — PORTES / COSTES DE ENVÍO
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- · Cada cliente puede tener un porte por entrega (€ sin IVA)
--   y opcionalmente un mínimo de producto a partir del cual es gratis.
-- · Cada albarán guarda el porte aplicado en esa entrega
--   (se autocompleta desde el cliente y se puede cambiar o quitar).
-- · La factura agrupada suma los portes de sus albaranes dentro de
--   la base imponible (mismo IVA que la mercancía, art. 78.Dos LIVA).
-- =====================================================

-- Clientes: configuración de portes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS coste_porte DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS porte_gratis_desde DECIMAL(10, 2);

-- Albaranes: porte aplicado en esta entrega (base sin IVA)
ALTER TABLE albaranes ADD COLUMN IF NOT EXISTS coste_envio DECIMAL(10, 2) DEFAULT 0;

-- Facturas: total de portes incluidos (informativo, para el PDF y el control)
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS portes_importe DECIMAL(10, 2) DEFAULT 0;

NOTIFY pgrst, 'reload schema';

SELECT 'V76 OK — Portes por cliente, albarán y factura' as resultado;
