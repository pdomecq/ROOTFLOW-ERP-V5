-- =====================================================
-- ROOTFLOW ERP V84 — DOS LÍNEAS DE NEGOCIO: DISTRIBUCIÓN Y RESTAURANTES
-- Ejecutar en Supabase SQL Editor (una sola vez; es idempotente)
-- =====================================================
-- · clientes.linea_negocio: 'distribucion' (distribuidores, retail, Mercamadrid)
--   o 'restaurantes' (restaurantes, hoteles, catering). Se rellena según el tipo
--   para los clientes que aún no la tengan; después se cambia en la ficha.
-- · productos.precio_distribucion / precio_restaurantes: precio base de cada línea.
--   Si están vacíos se usa productos.precio como hasta ahora. La tarifa especial
--   del cliente (tarifas_cliente) sigue mandando sobre ambos.
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS linea_negocio TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clientes_linea_negocio_check') THEN
    ALTER TABLE clientes ADD CONSTRAINT clientes_linea_negocio_check
      CHECK (linea_negocio IS NULL OR linea_negocio IN ('distribucion', 'restaurantes'));
  END IF;
END $$;

UPDATE clientes
SET linea_negocio = CASE WHEN tipo IN ('restaurante', 'hotel', 'catering') THEN 'restaurantes' ELSE 'distribucion' END
WHERE linea_negocio IS NULL;

ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_distribucion NUMERIC(10, 4);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS precio_restaurantes NUMERIC(10, 4);

NOTIFY pgrst, 'reload schema';

SELECT 'V84 OK — Líneas de negocio: ' ||
  (SELECT COUNT(*) FROM clientes WHERE linea_negocio = 'distribucion') || ' clientes de distribución y ' ||
  (SELECT COUNT(*) FROM clientes WHERE linea_negocio = 'restaurantes') || ' de restaurantes' AS resultado;
