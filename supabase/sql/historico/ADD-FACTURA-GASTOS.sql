-- ============================================
-- Añadir columna para facturas en gastos
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Añadir columna factura_url
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS factura_url TEXT;

-- Verificación
SELECT '✅ Columna factura_url añadida a tabla gastos' as resultado;
