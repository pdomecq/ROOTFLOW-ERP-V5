-- =====================================================
-- ROOTFLOW ERP V77 — FIX REGISTRO DE COBROS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- 1) Guarda la fecha real de cobro de cada factura.
-- 2) Limpia lo que dejaron los clics en "Cobrar" con el fallo anterior:
--    asientos con concepto "Cobro Factura undefined" y asientos de
--    cobro DUPLICADOS (si se pulsó varias veces el mismo botón).
-- =====================================================

-- 1. Fecha de cobro
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS fecha_cobro DATE;

-- 2a. Corregir el concepto "undefined" de los asientos de cobro ya creados
UPDATE asientos_contables
SET concepto = 'Cobro Factura ' || substring(referencia from 5)
WHERE referencia LIKE 'COB-%'
  AND concepto LIKE '%undefined%';

-- 2b. Borrar asientos de cobro DUPLICADOS (se conserva el primero de cada factura)
--     Primero sus líneas...
WITH dups AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY referencia ORDER BY id) AS rn
  FROM asientos_contables
  WHERE referencia LIKE 'COB-%'
)
DELETE FROM asiento_lineas
WHERE asiento_id IN (SELECT id FROM dups WHERE rn > 1);

--     ...y luego los asientos
WITH dups AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY referencia ORDER BY id) AS rn
  FROM asientos_contables
  WHERE referencia LIKE 'COB-%'
)
DELETE FROM asientos_contables
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

NOTIFY pgrst, 'reload schema';

-- 3. REVISIÓN: facturas en las que se pulsó "Cobrar" pero siguen pendientes.
--    Son las que hay que volver a cobrar desde el ERP (ya NO se duplicará el asiento).
SELECT f.id AS factura, f.fecha, f.total, f.estado, a.numero AS asiento_cobro, a.fecha AS fecha_asiento
FROM facturas f
JOIN asientos_contables a ON a.referencia = 'COB-' || f.id
WHERE f.estado <> 'pagada'
ORDER BY f.fecha;
