-- =====================================================
-- ROOTFLOW ERP V81 — created_at en 6 tablas
-- Ejecutar en Supabase SQL Editor (una sola vez; es idempotente)
-- =====================================================
-- useRealtime carga cada tabla ordenando por created_at. Estas seis
-- tablas no tenían esa columna, así que la consulta fallaba y la app
-- las veía siempre vacías:
--   condiciones_ambientales, historico_precios, muestra_items,
--   notificaciones_config, pedidos_recurrentes_items, presupuesto_items
-- Las filas que ya existan reciben la fecha y hora de ejecución.
-- =====================================================

ALTER TABLE condiciones_ambientales   ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE historico_precios         ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE muestra_items             ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE notificaciones_config     ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE pedidos_recurrentes_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE presupuesto_items         ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

NOTIFY pgrst, 'reload schema';

SELECT 'V81 OK — created_at en condiciones_ambientales, historico_precios, muestra_items, notificaciones_config, pedidos_recurrentes_items y presupuesto_items' AS resultado;
