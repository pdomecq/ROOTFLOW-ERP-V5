-- =====================================================
-- ROOTFLOW ERP V13 - SQL COMPLETO
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Campo asignado_a para tareas
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS asignado_a TEXT;

-- 2. Campo dias_crecimiento para productos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS dias_crecimiento INTEGER DEFAULT 7;

-- 3. Tabla de pedidos recurrentes
CREATE TABLE IF NOT EXISTS pedidos_recurrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES clientes(id),
  frecuencia TEXT NOT NULL CHECK (frecuencia IN ('diario', 'semanal', 'quincenal', 'mensual')),
  dia_semana INTEGER, -- 0=Domingo, 1=Lunes, etc.
  dia_mes INTEGER, -- Para frecuencia mensual
  activo BOOLEAN DEFAULT true,
  ultima_generacion DATE,
  proxima_generacion DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedidos_recurrentes_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_recurrente_id UUID REFERENCES pedidos_recurrentes(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  cantidad INTEGER NOT NULL DEFAULT 1
);

-- 4. Histórico de precios
CREATE TABLE IF NOT EXISTS historico_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID REFERENCES productos(id) ON DELETE CASCADE,
  precio_anterior DECIMAL(10,2),
  precio_nuevo DECIMAL(10,2),
  fecha_cambio TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger para registrar cambios de precio automáticamente
CREATE OR REPLACE FUNCTION registrar_cambio_precio()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.precio IS DISTINCT FROM NEW.precio THEN
    INSERT INTO historico_precios (producto_id, precio_anterior, precio_nuevo)
    VALUES (NEW.id, OLD.precio, NEW.precio);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_precio_producto ON productos;
CREATE TRIGGER trigger_precio_producto
  AFTER UPDATE ON productos
  FOR EACH ROW
  EXECUTE FUNCTION registrar_cambio_precio();

-- 5. Condiciones ambientales
CREATE TABLE IF NOT EXISTS condiciones_ambientales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha TIMESTAMPTZ DEFAULT NOW(),
  temperatura DECIMAL(4,1),
  humedad INTEGER,
  co2 INTEGER,
  luz INTEGER,
  notas TEXT
);

CREATE INDEX IF NOT EXISTS idx_condiciones_fecha ON condiciones_ambientales(fecha DESC);

-- 6. Políticas RLS
ALTER TABLE pedidos_recurrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_recurrentes_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE condiciones_ambientales ENABLE ROW LEVEL SECURITY;

-- Políticas para pedidos_recurrentes
DROP POLICY IF EXISTS "Acceso completo pedidos_recurrentes" ON pedidos_recurrentes;
CREATE POLICY "Acceso completo pedidos_recurrentes" ON pedidos_recurrentes
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso completo pedidos_recurrentes_items" ON pedidos_recurrentes_items;
CREATE POLICY "Acceso completo pedidos_recurrentes_items" ON pedidos_recurrentes_items
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso completo historico_precios" ON historico_precios;
CREATE POLICY "Acceso completo historico_precios" ON historico_precios
  FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso completo condiciones_ambientales" ON condiciones_ambientales;
CREATE POLICY "Acceso completo condiciones_ambientales" ON condiciones_ambientales
  FOR ALL USING (true) WITH CHECK (true);

-- 7. Datos de ejemplo para condiciones ambientales
INSERT INTO condiciones_ambientales (temperatura, humedad, co2, luz, notas) VALUES
  (21.5, 62, 800, 12000, 'Condiciones óptimas'),
  (22.0, 58, 750, 11500, 'Mañana'),
  (20.8, 65, 820, 13000, 'Tarde');

-- =====================================================
-- FIN DE MIGRACIONES V13
-- =====================================================
