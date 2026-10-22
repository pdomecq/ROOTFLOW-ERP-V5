-- ============================================
-- Actualización para v11 - Añadir fecha_cosecha_real
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Añadir columna para fecha real de cosecha
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS fecha_cosecha_real DATE;

-- Verificación
SELECT '✅ Columna fecha_cosecha_real añadida a tabla lotes' as resultado;
