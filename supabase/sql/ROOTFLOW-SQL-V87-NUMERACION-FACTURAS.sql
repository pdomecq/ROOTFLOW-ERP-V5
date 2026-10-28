-- =====================================================================
-- ROOTFLOW ERP — V87: numeración correlativa de las facturas emitidas
-- =====================================================================
-- 1. Columnas para anular una factura con su rectificativa (serie R-AAAA-):
--    factura_rectificada_id (en la rectificativa: la factura que anula),
--    motivo_anulacion y anulada_at (en la factura anulada).
-- 2. Trigger que impide borrar una factura salvo que sea la ÚLTIMA de su serie,
--    no se haya enviado y no esté cobrada (así nunca quedan huecos en la numeración).
--    Para anular cualquier otra: botón ⛔ en Facturación (crea la rectificativa).
-- Idempotente: se puede ejecutar varias veces.
-- =====================================================================

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS factura_rectificada_id TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS anulada_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS facturas_factura_rectificada_id_idx ON facturas (factura_rectificada_id);

CREATE OR REPLACE FUNCTION proteger_numeracion_facturas() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_prefijo TEXT := substring(OLD.id FROM '^(.*?)[0-9]+\s*$');
  v_numero  INT  := NULLIF(substring(OLD.id FROM '([0-9]+)\s*$'), '')::INT;
  v_mayor   INT;
BEGIN
  IF v_prefijo IS NULL OR v_numero IS NULL THEN
    RETURN OLD;
  END IF;
  SELECT MAX(NULLIF(substring(id FROM '([0-9]+)\s*$'), '')::INT) INTO v_mayor
    FROM facturas
   WHERE substring(id FROM '^(.*?)[0-9]+\s*$') = v_prefijo;
  IF v_numero < v_mayor OR OLD.enviada_at IS NOT NULL OR OLD.estado = 'pagada' THEN
    RAISE EXCEPTION 'La factura % no se puede borrar: la numeración tiene que ser correlativa. Anúlala con una factura rectificativa (botón ⛔ en Facturación).', OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_numeracion_facturas ON facturas;
CREATE TRIGGER trg_proteger_numeracion_facturas
  BEFORE DELETE ON facturas
  FOR EACH ROW EXECUTE FUNCTION proteger_numeracion_facturas();

NOTIFY pgrst, 'reload schema';

SELECT 'V87 OK — facturas: columnas de anulación/rectificativa y borrado protegido (solo la última sin enviar ni cobrar)' AS resultado;
