-- ============================================
-- Añadir columna fecha_cosecha_real a lotes
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Añadir columna si no existe
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS fecha_cosecha_real DATE;

-- Verificación
SELECT '✅ Columna fecha_cosecha_real añadida a tabla lotes' as resultado;
