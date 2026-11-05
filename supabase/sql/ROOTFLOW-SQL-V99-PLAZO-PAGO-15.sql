-- =====================================================================
-- ROOTFLOW ERP · SQL V99 · Plazo de pago de 15 días (productos frescos: máximo 30 días desde la entrega)
-- 1) Todos los clientes a 15 días (se puede cambiar en su ficha, como mucho 30).
-- 2) Facturas pendientes que NO se han enviado: vencimiento = fecha + 15 días, sin pasar de 30 días desde
--    la primera entrega que incluyen (Ley 3/2004 art. 4 y Ley 12/2013). Las ya enviadas no se tocan.
-- Idempotente.
-- =====================================================================
UPDATE clientes SET plazo_pago_dias = 15 WHERE plazo_pago_dias IS DISTINCT FROM 15;

WITH primera AS (
  SELECT f.id,
         COALESCE(
           (SELECT MIN(COALESCE(a.fecha_entrega_real, a.fecha_emision)) FROM albaranes a
             WHERE jsonb_typeof(f.albaranes_ids) = 'array' AND f.albaranes_ids ? a.id::text),
           (SELECT p.fecha_entrega FROM pedidos p WHERE p.id = f.pedido_id),
           f.periodo_desde) AS entrega
  FROM facturas f
  WHERE f.estado IN ('pendiente', 'vencida') AND f.enviada_at IS NULL
    AND COALESCE(f.tipo, '') NOT IN ('anulada', 'rectificativa') AND f.id NOT LIKE 'R-%'
)
UPDATE facturas f
   SET fecha_vencimiento = GREATEST(f.fecha, LEAST(f.fecha + 15, COALESCE(pr.entrega + 30, f.fecha + 15)))
  FROM primera pr
 WHERE pr.id = f.id
   AND f.fecha_vencimiento IS DISTINCT FROM GREATEST(f.fecha, LEAST(f.fecha + 15, COALESCE(pr.entrega + 30, f.fecha + 15)));

NOTIFY pgrst, 'reload schema';
SELECT 'V99 OK — plazo de pago 15 días' AS resultado;
