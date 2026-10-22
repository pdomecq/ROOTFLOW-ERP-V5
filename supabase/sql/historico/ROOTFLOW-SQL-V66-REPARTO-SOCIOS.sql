-- =====================================================
-- ROOTFLOW ERP V66 — REPARTO DE GASTOS ENTRE SOCIOS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Permite que un gasto pagado por socios se reparta entre varios
-- (no solo 100% a uno). Cada parte alimenta la deuda 551 del socio
-- correspondiente. Útil cuando hacen Bizum a partes iguales por
-- falta de liquidez personal al inicio.
-- =====================================================

-- reparto_socios: array JSON con la parte de cada socio.
-- Formato: [{ "socio": "socio_nico", "importe": 50.00 }, { "socio": "socio_peri", "importe": 50.00 }]
-- Si está vacío o null → el gasto usa forma_pago como hasta ahora (100% a un solo pagador).
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS reparto_socios JSONB DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';

SELECT 'V66 OK — Reparto de gastos entre socios' as resultado;
