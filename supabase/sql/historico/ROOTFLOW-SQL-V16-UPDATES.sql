-- ============================================
-- ROOTFLOW ERP V16 - ACTUALIZACIONES DE BD
-- ============================================
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ==================== PEDIDOS ====================
-- Añadir campo concepto (referencia interna)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS concepto TEXT;
COMMENT ON COLUMN pedidos.concepto IS 'Concepto interno para identificar el pedido (ej: Evento boda, Pedido semanal)';

-- Añadir campo horario_entrega (franja horaria)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS horario_entrega TEXT;
COMMENT ON COLUMN pedidos.horario_entrega IS 'Franja horaria de entrega (ej: 09:00-12:00, 15:00-20:00)';

-- ==================== VERIFICACIÓN ====================
-- Mostrar estructura actualizada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'pedidos' 
  AND column_name IN ('concepto', 'horario_entrega')
ORDER BY ordinal_position;
