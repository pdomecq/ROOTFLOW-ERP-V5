-- =====================================================================
-- ROOTFLOW ERP — V90: calendario de entregas de los pedidos recurrentes
-- =====================================================================
-- pedidos_recurrentes: primera entrega, hasta cuándo, horario de entrega y con cuántos días de
-- antelación se genera el pedido de cada entrega.
-- pedidos: de qué recurrente y de qué entrega sale (índice único: una entrega no se genera dos veces
-- aunque el ERP esté abierto en varios ordenadores a la vez).
-- Idempotente: se puede ejecutar varias veces.
-- =====================================================================

ALTER TABLE pedidos_recurrentes ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE pedidos_recurrentes ADD COLUMN IF NOT EXISTS fecha_fin DATE;
ALTER TABLE pedidos_recurrentes ADD COLUMN IF NOT EXISTS horario_entrega TEXT;
ALTER TABLE pedidos_recurrentes ADD COLUMN IF NOT EXISTS dias_antelacion INTEGER DEFAULT 2;

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS recurrente_id INTEGER;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS recurrente_fecha DATE;
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_recurrente_entrega_unica
  ON pedidos (recurrente_id, recurrente_fecha) WHERE recurrente_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

SELECT 'V90 OK — recurrentes con primera entrega, fin, horario y antelación; pedidos ligados a su entrega' AS resultado;
