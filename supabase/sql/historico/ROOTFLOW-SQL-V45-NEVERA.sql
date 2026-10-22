-- =====================================================
-- ROOTFLOW ERP V45 - FASES COMPLETAS + NEVERA
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Añade fase "nevera" (post-empaquetado, antes de envío)
-- Permite tipo "nevera" en racks (cámara fría, huecos)
-- Campos para timing fino de cosecha por bandeja
-- =====================================================

-- 1. Más opciones de tipo en racks (no es enum, así que nada que cambiar)
-- Valores ahora soportados en racks_config.tipo:
--   'germinacion' | 'crecimiento' | 'mixto' | 'nevera'

-- 2. Más fases en lotes
-- Valores ahora soportados en lotes.fase:
--   'siembra' | 'germinacion' | 'crecimiento' | 'granel' | 'empaquetado' | 'nevera' | 'enviado' | 'cosechado'

ALTER TABLE lotes ADD COLUMN IF NOT EXISTS fecha_entrada_nevera DATE;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS dias_nevera_max INTEGER DEFAULT 5;  -- caducidad típica
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS rack_nevera_id INTEGER REFERENCES racks_config(id) ON DELETE SET NULL;

-- 3. Stock empaquetado en nevera: relación producto → rack nevera
-- (no creamos tabla porque ya tenemos productos.stock y lote_bandejas para ubicación)

-- Refrescar schema
NOTIFY pgrst, 'reload schema';

SELECT 'V45 OK - Fase nevera y fases completas' as resultado;
