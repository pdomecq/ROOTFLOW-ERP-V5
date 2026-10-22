-- =====================================================
-- ROOTFLOW ERP V64 — NOTAS DE GASTO POR KILOMETRAJE
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Registra el gasto de kilometraje cuando un socio/empleado usa
-- su coche para entregar un albarán. Tarifa fija 0,13 €/km.
-- =====================================================

CREATE TABLE IF NOT EXISTS notas_kilometraje (
  id SERIAL PRIMARY KEY,

  -- Vinculación con el albarán entregado (el "viaje")
  albaran_id TEXT REFERENCES albaranes(id) ON DELETE SET NULL,

  -- Quién puso el coche
  nombre_repartidor TEXT NOT NULL,

  -- Datos del viaje
  fecha_entrega DATE NOT NULL DEFAULT CURRENT_DATE,
  kilometros_ida_vuelta DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Cálculo: km * tarifa. Se guarda tanto la tarifa usada como el importe,
  -- para que quede el histórico aunque la tarifa cambie en el futuro.
  tarifa_km DECIMAL(6, 3) NOT NULL DEFAULT 0.13,
  importe_total DECIMAL(10, 2) NOT NULL DEFAULT 0,

  -- Snapshot del cliente (para informes sin tener que cruzar con albaranes)
  cliente_nombre TEXT,

  -- Estado de reembolso al socio
  reembolsado BOOLEAN DEFAULT FALSE,
  fecha_reembolso DATE,

  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notas_km_albaran ON notas_kilometraje(albaran_id);
CREATE INDEX IF NOT EXISTS idx_notas_km_fecha ON notas_kilometraje(fecha_entrega DESC);
CREATE INDEX IF NOT EXISTS idx_notas_km_repartidor ON notas_kilometraje(nombre_repartidor);
CREATE INDEX IF NOT EXISTS idx_notas_km_reembolsado ON notas_kilometraje(reembolsado);

ALTER TABLE notas_kilometraje ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo notas_kilometraje" ON notas_kilometraje;
CREATE POLICY "Acceso completo notas_kilometraje" ON notas_kilometraje FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'notas_kilometraje') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notas_kilometraje;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V64 OK — Notas de gasto por kilometraje (0,13 €/km)' as resultado;
