-- =====================================================================
-- ROOTFLOW ERP · SQL V100 · Plazo de pago otra vez a 30 días (deshace el cambio a 15 de la V99)
-- Clientes a 30 días (La Huerta Hermanos Nieto se queda en 15, como estaba antes de la V99) y vencimiento
-- recalculado de las facturas pendientes sin enviar: fecha + plazo, sin pasar de 30 días desde la primera entrega.
-- Ya ejecutado con el MCP el 5-nov-2026. Idempotente.
-- =====================================================================
UPDATE clientes SET plazo_pago_dias = CASE WHEN nombre ILIKE 'LA HUERTA HERMANOS NIETO%' THEN 15 ELSE 30 END;

WITH primera AS (
  SELECT f.id, c.plazo_pago_dias AS plazo,
         COALESCE(
           (SELECT MIN(COALESCE(a.fecha_entrega_real, a.fecha_emision)) FROM albaranes a
             WHERE jsonb_typeof(f.albaranes_ids) = 'array' AND f.albaranes_ids ? a.id::text),
           (SELECT p.fecha_entrega FROM pedidos p WHERE p.id = f.pedido_id),
           f.periodo_desde) AS entrega
  FROM facturas f JOIN clientes c ON c.id = f.cliente_id
  WHERE f.estado IN ('pendiente', 'vencida') AND f.enviada_at IS NULL
    AND COALESCE(f.tipo, '') NOT IN ('anulada', 'rectificativa') AND f.id NOT LIKE 'R-%'
)
UPDATE facturas f
   SET fecha_vencimiento = GREATEST(f.fecha, LEAST(f.fecha + LEAST(pr.plazo, 30), COALESCE(pr.entrega + 30, f.fecha + LEAST(pr.plazo, 30))))
  FROM primera pr WHERE pr.id = f.id;

NOTIFY pgrst, 'reload schema';
SELECT 'V100 OK — plazo de pago 30 días' AS resultado;
