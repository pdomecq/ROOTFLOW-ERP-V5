-- ============================================
-- ROOTFLOW ERP - TABLAS Y PERMISOS V12
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ==================== PROVEEDORES ====================
CREATE TABLE IF NOT EXISTS proveedores (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    categoria TEXT DEFAULT 'otros',
    contacto TEXT,
    email TEXT,
    telefono TEXT,
    direccion TEXT,
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== TAREAS ====================
CREATE TABLE IF NOT EXISTS tareas (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    categoria TEXT DEFAULT 'otro',
    prioridad TEXT DEFAULT 'media',
    fecha_limite DATE,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    completada BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== MERMAS ====================
CREATE TABLE IF NOT EXISTS mermas (
    id SERIAL PRIMARY KEY,
    lote_id TEXT,
    cantidad INTEGER DEFAULT 0,
    motivo TEXT DEFAULT 'otros',
    fecha DATE DEFAULT CURRENT_DATE,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== COLUMNAS ADICIONALES ====================
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS fecha_cosecha_real DATE;
ALTER TABLE lotes ADD COLUMN IF NOT EXISTS codigo TEXT;

-- ==================== HABILITAR RLS ====================
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mermas ENABLE ROW LEVEL SECURITY;

-- ==================== ELIMINAR POLÍTICAS EXISTENTES ====================
DROP POLICY IF EXISTS "proveedores_all" ON proveedores;
DROP POLICY IF EXISTS "tareas_all" ON tareas;
DROP POLICY IF EXISTS "mermas_all" ON mermas;
DROP POLICY IF EXISTS "auth_proveedores" ON proveedores;
DROP POLICY IF EXISTS "auth_tareas" ON tareas;
DROP POLICY IF EXISTS "auth_mermas" ON mermas;

-- ==================== CREAR POLÍTICAS PERMISIVAS ====================
-- Proveedores: permitir todo a usuarios autenticados
CREATE POLICY "proveedores_all" ON proveedores 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Tareas: permitir todo a usuarios autenticados
CREATE POLICY "tareas_all" ON tareas 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Mermas: permitir todo a usuarios autenticados
CREATE POLICY "mermas_all" ON mermas 
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- ==================== DATOS DE EJEMPLO ====================
INSERT INTO proveedores (nombre, categoria, contacto, email, telefono, direccion) VALUES
('Semillas Bio España', 'semillas', 'Pedro García', 'pedidos@semillasbio.es', '91 555 1234', 'Pol. Ind. Norte, Madrid'),
('Sustratos Naturales SL', 'sustratos', 'María López', 'info@sustratosnaturales.com', '91 555 5678', 'C/ Agricultura 45, Getafe'),
('Envases Eco Madrid', 'envases', 'Juan Martín', 'comercial@envaseseco.es', '91 555 9012', 'Av. Industria 23, Alcorcón'),
('Transportes Rápidos', 'transporte', 'Luis Fernández', 'info@transportesrapidos.es', '91 666 1234', 'C/ Logística 12, Coslada'),
('TechGrow Solutions', 'tecnologia', 'Ana Ruiz', 'soporte@techgrow.es', '91 777 5678', 'Parque Tecnológico, Tres Cantos'),
('Limpieza Industrial Pro', 'limpieza', 'Carlos Sánchez', 'info@limpiezapro.es', '91 888 9012', 'C/ Servicios 8, Las Rozas')
ON CONFLICT DO NOTHING;

INSERT INTO tareas (titulo, descripcion, categoria, prioridad, fecha_limite) VALUES
('Llamar a Hotel Palace', 'Seguimiento del presupuesto enviado', 'cliente', 'alta', CURRENT_DATE + 2),
('Revisar stock de semillas', 'Verificar inventario y hacer pedido', 'compras', 'media', CURRENT_DATE + 7),
('Preparar facturación mensual', 'Generar y revisar facturas del mes', 'admin', 'baja', CURRENT_DATE + 14),
('Mantenimiento sistema riego', 'Revisión trimestral', 'produccion', 'media', CURRENT_DATE + 5),
('Reunión con Mercamadrid', 'Negociar nuevos términos', 'cliente', 'alta', CURRENT_DATE + 3)
ON CONFLICT DO NOTHING;

-- ==================== VERIFICACIÓN ====================
SELECT '✅ Tablas creadas: proveedores, tareas, mermas' as resultado;
