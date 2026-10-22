-- ============================================
-- ROOTFLOW ERP - MEJORAS V13
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ==================== CAMPO ASIGNADO_A EN TAREAS ====================
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS asignado_a TEXT;

-- ==================== CAMPO DIAS_CRECIMIENTO EN PRODUCTOS ====================
ALTER TABLE productos ADD COLUMN IF NOT EXISTS dias_crecimiento INTEGER DEFAULT 7;

-- Actualizar productos existentes con valores típicos
UPDATE productos SET dias_crecimiento = 
  CASE 
    WHEN LOWER(nombre) LIKE '%rábano%' THEN 5
    WHEN LOWER(nombre) LIKE '%mostaza%' THEN 6
    WHEN LOWER(nombre) LIKE '%girasol%' THEN 8
    WHEN LOWER(nombre) LIKE '%guisante%' THEN 10
    WHEN LOWER(nombre) LIKE '%remolacha%' THEN 12
    WHEN LOWER(nombre) LIKE '%albahaca%' THEN 14
    ELSE 7
  END
WHERE dias_crecimiento IS NULL OR dias_crecimiento = 7;

-- ==================== PEDIDOS RECURRENTES ====================
CREATE TABLE IF NOT EXISTS pedidos_recurrentes (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    frecuencia TEXT DEFAULT 'semanal', -- semanal, quincenal, mensual
    dia_semana INTEGER DEFAULT 1, -- 1=Lunes, 2=Martes, etc.
    activo BOOLEAN DEFAULT true,
    ultima_ejecucion DATE,
    proxima_ejecucion DATE,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items de pedidos recurrentes
CREATE TABLE IF NOT EXISTS pedidos_recurrentes_items (
    id SERIAL PRIMARY KEY,
    pedido_recurrente_id INTEGER REFERENCES pedidos_recurrentes(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    cantidad INTEGER DEFAULT 1
);

-- ==================== HISTÓRICO DE PRECIOS ====================
CREATE TABLE IF NOT EXISTS historico_precios (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
    precio_anterior DECIMAL(10,2),
    precio_nuevo DECIMAL(10,2),
    coste_anterior DECIMAL(10,2),
    coste_nuevo DECIMAL(10,2),
    fecha TIMESTAMPTZ DEFAULT NOW(),
    usuario TEXT
);

-- ==================== RLS ====================
ALTER TABLE pedidos_recurrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_recurrentes_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_precios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedidos_recurrentes_all" ON pedidos_recurrentes;
DROP POLICY IF EXISTS "pedidos_recurrentes_items_all" ON pedidos_recurrentes_items;
DROP POLICY IF EXISTS "historico_precios_all" ON historico_precios;

CREATE POLICY "pedidos_recurrentes_all" ON pedidos_recurrentes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "pedidos_recurrentes_items_all" ON pedidos_recurrentes_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "historico_precios_all" ON historico_precios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==================== FUNCIÓN PARA HISTÓRICO DE PRECIOS ====================
CREATE OR REPLACE FUNCTION log_precio_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.precio IS DISTINCT FROM NEW.precio OR OLD.coste IS DISTINCT FROM NEW.coste THEN
        INSERT INTO historico_precios (producto_id, precio_anterior, precio_nuevo, coste_anterior, coste_nuevo)
        VALUES (NEW.id, OLD.precio, NEW.precio, OLD.coste, NEW.coste);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para registrar cambios de precio
DROP TRIGGER IF EXISTS trigger_precio_change ON productos;
CREATE TRIGGER trigger_precio_change
    AFTER UPDATE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION log_precio_change();

-- ==================== VERIFICACIÓN ====================
SELECT '✅ Columna dias_crecimiento añadida a productos' as resultado;
SELECT '✅ Tablas creadas: pedidos_recurrentes, pedidos_recurrentes_items, historico_precios' as resultado;
SELECT '✅ Trigger creado: log_precio_change' as resultado;

-- ==================== CONDICIONES AMBIENTALES ====================
CREATE TABLE IF NOT EXISTS condiciones_ambientales (
    id SERIAL PRIMARY KEY,
    temperatura DECIMAL(5,2),
    humedad INTEGER,
    co2 INTEGER,
    luz INTEGER,
    notas TEXT,
    fecha TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE condiciones_ambientales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "condiciones_all" ON condiciones_ambientales;
CREATE POLICY "condiciones_all" ON condiciones_ambientales FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Índice para ordenar por fecha
CREATE INDEX IF NOT EXISTS idx_condiciones_fecha ON condiciones_ambientales(fecha DESC);

SELECT '✅ Tabla creada: condiciones_ambientales' as resultado;
