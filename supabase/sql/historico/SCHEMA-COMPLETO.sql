-- ============================================
-- ROOTFLOW ERP - SCHEMA COMPLETO
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- Limpiar tablas existentes (opcional - descomentar si quieres empezar de cero)
-- DROP TABLE IF EXISTS pedido_items CASCADE;
-- DROP TABLE IF EXISTS facturas CASCADE;
-- DROP TABLE IF EXISTS pedidos CASCADE;
-- DROP TABLE IF EXISTS leads CASCADE;
-- DROP TABLE IF EXISTS clientes CASCADE;
-- DROP TABLE IF EXISTS productos CASCADE;
-- DROP TABLE IF EXISTS lotes CASCADE;
-- DROP TABLE IF EXISTS gastos CASCADE;
-- DROP TABLE IF EXISTS usuarios CASCADE;

-- ==================== USUARIOS ====================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    nombre TEXT,
    rol TEXT DEFAULT 'usuario' CHECK (rol IN ('admin', 'usuario', 'vendedor')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== PRODUCTOS ====================
CREATE TABLE IF NOT EXISTS productos (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    categoria TEXT DEFAULT 'nutritivos',
    precio DECIMAL(10,2) DEFAULT 0,
    coste DECIMAL(10,2) DEFAULT 0,
    stock INTEGER DEFAULT 0,
    stock_minimo INTEGER DEFAULT 20,
    unidad TEXT DEFAULT 'bandeja 100g',
    dias_crecimiento INTEGER DEFAULT 7,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== CLIENTES ====================
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    tipo TEXT DEFAULT 'restaurante' CHECK (tipo IN ('mercamadrid', 'hotel', 'restaurante', 'catering', 'tienda', 'otro')),
    contacto TEXT,
    email TEXT,
    telefono TEXT,
    direccion TEXT,
    codigo_postal TEXT,
    ciudad TEXT DEFAULT 'Madrid',
    zona TEXT DEFAULT 'centro' CHECK (zona IN ('norte', 'centro', 'sur')),
    descuento INTEGER DEFAULT 0,
    cif TEXT,
    notas TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== LEADS ====================
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    empresa TEXT,
    tipo TEXT DEFAULT 'restaurante',
    contacto TEXT,
    email TEXT,
    telefono TEXT,
    direccion TEXT,
    codigo_postal TEXT,
    ciudad TEXT DEFAULT 'Madrid',
    zona TEXT DEFAULT 'centro',
    estado TEXT DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'contactado', 'interesado', 'negociando', 'ganado', 'perdido')),
    origen TEXT DEFAULT 'web' CHECK (origen IN ('web', 'referido', 'feria', 'llamada', 'email', 'redes', 'importado', 'otro')),
    notas TEXT,
    valor_estimado DECIMAL(10,2) DEFAULT 0,
    convertido_cliente_id INTEGER REFERENCES clientes(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== PEDIDOS ====================
CREATE TABLE IF NOT EXISTS pedidos (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    fecha DATE DEFAULT CURRENT_DATE,
    fecha_entrega DATE,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmado', 'preparando', 'enviado', 'entregado', 'cancelado')),
    total DECIMAL(10,2) DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== PEDIDO_ITEMS ====================
CREATE TABLE IF NOT EXISTS pedido_items (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    cantidad INTEGER DEFAULT 1,
    precio_unitario DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== FACTURAS ====================
CREATE TABLE IF NOT EXISTS facturas (
    id TEXT PRIMARY KEY,
    pedido_id INTEGER REFERENCES pedidos(id) ON DELETE SET NULL,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
    fecha DATE DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'vencida', 'cancelada')),
    subtotal DECIMAL(10,2) DEFAULT 0,
    descuento_aplicado DECIMAL(10,2) DEFAULT 0,
    base_imponible DECIMAL(10,2) DEFAULT 0,
    iva_porcentaje INTEGER DEFAULT 21,
    iva DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== GASTOS ====================
CREATE TABLE IF NOT EXISTS gastos (
    id SERIAL PRIMARY KEY,
    fecha DATE DEFAULT CURRENT_DATE,
    categoria TEXT DEFAULT 'otros',
    concepto TEXT,
    proveedor TEXT,
    importe DECIMAL(10,2) DEFAULT 0,
    pagado BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== LOTES (PRODUCCIÓN) ====================
CREATE TABLE IF NOT EXISTS lotes (
    id SERIAL PRIMARY KEY,
    producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
    fecha_siembra DATE DEFAULT CURRENT_DATE,
    fecha_cosecha_prevista DATE,
    bandejas INTEGER DEFAULT 20,
    estado TEXT DEFAULT 'sembrado' CHECK (estado IN ('sembrado', 'germinando', 'creciendo', 'listo', 'cosechado', 'perdido')),
    notas TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== ÍNDICES ====================
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha);
CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente ON facturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado);
CREATE INDEX IF NOT EXISTS idx_lotes_producto ON lotes(producto_id);

-- ==================== RLS (Row Level Security) ====================
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso (usuarios autenticados pueden hacer todo)
DROP POLICY IF EXISTS "auth_usuarios" ON usuarios;
DROP POLICY IF EXISTS "auth_productos" ON productos;
DROP POLICY IF EXISTS "auth_clientes" ON clientes;
DROP POLICY IF EXISTS "auth_leads" ON leads;
DROP POLICY IF EXISTS "auth_pedidos" ON pedidos;
DROP POLICY IF EXISTS "auth_pedido_items" ON pedido_items;
DROP POLICY IF EXISTS "auth_facturas" ON facturas;
DROP POLICY IF EXISTS "auth_gastos" ON gastos;
DROP POLICY IF EXISTS "auth_lotes" ON lotes;

CREATE POLICY "auth_usuarios" ON usuarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_productos" ON productos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_clientes" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_leads" ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_pedidos" ON pedidos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_pedido_items" ON pedido_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_facturas" ON facturas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_gastos" ON gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_lotes" ON lotes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ==================== DATOS DE EJEMPLO ====================
-- Productos
INSERT INTO productos (nombre, categoria, precio, coste, stock, stock_minimo, dias_crecimiento) VALUES
('Rúcula', 'picantes', 4.50, 1.20, 50, 20, 7),
('Rabanito', 'picantes', 4.00, 1.00, 45, 20, 6),
('Girasol', 'nutritivos', 5.00, 1.50, 60, 25, 10),
('Guisante', 'nutritivos', 4.50, 1.30, 40, 20, 8),
('Mostaza', 'picantes', 4.00, 1.10, 35, 15, 5),
('Remolacha', 'coloridos', 5.50, 1.60, 30, 15, 12),
('Brócoli', 'nutritivos', 4.50, 1.20, 55, 20, 6),
('Mix Premium', 'mix', 6.00, 2.00, 25, 10, 7)
ON CONFLICT DO NOTHING;

-- Clientes
INSERT INTO clientes (nombre, tipo, contacto, email, telefono, direccion, codigo_postal, ciudad, zona, descuento, cif) VALUES
('Restaurante El Jardín', 'restaurante', 'María García', 'pedidos@eljardin.es', '91 123 4567', 'Calle Mayor, 15', '28013', 'Madrid', 'centro', 10, 'B12345678'),
('Hotel Palace Madrid', 'hotel', 'Chef Ejecutivo', 'cocina@palacemadrid.com', '91 234 5678', 'Plaza de las Cortes, 7', '28014', 'Madrid', 'centro', 15, 'A87654321'),
('Mercamadrid - Puesto 45', 'mercamadrid', 'Antonio López', 'puesto45@mercamadrid.es', '91 345 6789', 'Mercamadrid, Nave A', '28053', 'Madrid', 'sur', 20, 'B11223344')
ON CONFLICT DO NOTHING;

-- Mensaje de éxito
SELECT '✅ SCHEMA CREADO CORRECTAMENTE' as resultado;
