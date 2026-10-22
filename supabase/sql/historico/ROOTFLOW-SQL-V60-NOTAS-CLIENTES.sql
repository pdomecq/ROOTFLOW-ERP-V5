-- =====================================================
-- ROOTFLOW ERP V60 — NOTAS Y PREFERENCIAS DE CLIENTES
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Campos para acordarse de las exigencias y matices de cada
-- cliente. El "aviso importante" se mostrará destacado al crear
-- pedidos para ese cliente.
-- =====================================================

-- AVISO destacado (sale en banner al hacer pedidos)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS aviso_importante TEXT;

-- Notas operativas estructuradas
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS preferencias_entrega TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS contacto_recepcion TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS horario_entrega_preferido TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS exigencias_producto TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS restricciones TEXT;

-- Notas internas libres (no salen en ningún documento)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS notas_internas TEXT;

NOTIFY pgrst, 'reload schema';

SELECT 'V60 OK — Campos de notas y preferencias en clientes' as resultado;
