-- =====================================================================
-- ROOTFLOW ERP · SQL V98 · Pedidos y albaranes no se borran: se cancelan / anulan
-- La base de datos rechaza:
--   · borrar un pedido que tiene (o tuvo) factura, o con un albarán entregado/facturado;
--   · borrar un albarán entregado, facturado o incluido en alguna factura.
-- El ERP ya no ofrece borrar: «Cancelar pedido» y «Anular albarán» (conservan número e historial).
-- No crea tablas ni columnas. Idempotente.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.proteger_borrado_pedido() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM facturas WHERE pedido_id = OLD.id) THEN
    RAISE EXCEPTION 'El pedido % tiene factura: no se borra, se cancela (V98)', OLD.id;
  END IF;
  IF EXISTS (SELECT 1 FROM albaran_pedidos ap JOIN albaranes a ON a.id = ap.albaran_id
             WHERE ap.pedido_id = OLD.id AND (a.estado IN ('entregado', 'facturado') OR a.numero_factura IS NOT NULL)) THEN
    RAISE EXCEPTION 'El pedido % ya está entregado: no se borra (V98)', OLD.id;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_proteger_borrado_pedido ON pedidos;
CREATE TRIGGER trg_proteger_borrado_pedido BEFORE DELETE ON pedidos FOR EACH ROW EXECUTE FUNCTION public.proteger_borrado_pedido();

CREATE OR REPLACE FUNCTION public.proteger_borrado_albaran() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.estado IN ('entregado', 'facturado') OR OLD.numero_factura IS NOT NULL
     OR EXISTS (SELECT 1 FROM facturas f WHERE jsonb_typeof(f.albaranes_ids) = 'array' AND f.albaranes_ids ? OLD.id::text) THEN
    RAISE EXCEPTION 'El albarán % está entregado o facturado: no se borra, se corrige o se anula (V98)', OLD.id;
  END IF;
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS trg_proteger_borrado_albaran ON albaranes;
CREATE TRIGGER trg_proteger_borrado_albaran BEFORE DELETE ON albaranes FOR EACH ROW EXECUTE FUNCTION public.proteger_borrado_albaran();

NOTIFY pgrst, 'reload schema';
SELECT 'V98 OK — pedidos y albaranes protegidos contra borrado' AS resultado;
