-- =====================================================
-- ROOTFLOW ERP V82 — ÁREA DE CLIENTE + ENVÍO DE FACTURAS
-- Ejecutar en Supabase SQL Editor (una sola vez; es idempotente)
-- =====================================================
-- · clientes.portal_token: enlace privado de cada cliente al área de cliente
--   (https://…/area-cliente?t=<token>). Se genera desde el ERP.
-- · clientes.portal_activo: permite cortar el acceso sin borrar el token.
-- · facturas.enviada_at / enviada_a: cuándo y a quién se envió la factura por email.
-- · solicitudes_cliente: peticiones de ampliación del pedido recurrente que el
--   cliente manda desde el área de cliente. NO se aplican solas: se aprueban o
--   rechazan en Pedidos → Recurrentes.
-- El área de cliente NO lee las tablas con la clave anon: lo hace la Edge
-- Function portal-cliente con la service role, filtrando por el token.
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_token TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS portal_activo BOOLEAN DEFAULT TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_portal_token ON clientes(portal_token) WHERE portal_token IS NOT NULL;

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS enviada_at TIMESTAMPTZ;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS enviada_a TEXT;

CREATE TABLE IF NOT EXISTS solicitudes_cliente (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  pedido_recurrente_id INTEGER REFERENCES pedidos_recurrentes(id) ON DELETE SET NULL,
  tipo TEXT DEFAULT 'ampliacion_recurrente',
  -- [{ "producto_id": 1, "producto_nombre": "...", "cantidad_actual": 2, "cantidad_solicitada": 4 }]
  items_json JSONB DEFAULT '[]'::jsonb,
  fecha_desde DATE,                         -- desde cuándo lo quiere el cliente
  mensaje TEXT,
  contacto_nombre TEXT,
  estado TEXT DEFAULT 'pendiente',          -- 'pendiente' | 'aprobada' | 'rechazada'
  respuesta TEXT,
  respondida_at TIMESTAMPTZ,
  respondida_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente_estado ON solicitudes_cliente(estado, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_cliente_cliente ON solicitudes_cliente(cliente_id);

ALTER TABLE solicitudes_cliente ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo solicitudes_cliente" ON solicitudes_cliente;
CREATE POLICY "Acceso completo solicitudes_cliente" ON solicitudes_cliente FOR ALL TO authenticated USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'solicitudes_cliente') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE solicitudes_cliente;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V82 OK — Área de cliente (portal_token), facturas enviadas y solicitudes_cliente' AS resultado;
