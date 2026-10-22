-- ============================================
-- EJECUTAR ESTO EN SUPABASE SQL EDITOR
-- Añade la tabla LEADS y campos que faltan
-- ============================================

-- TABLA: LEADS
CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,
    empresa TEXT,
    tipo TEXT CHECK (tipo IN ('mercamadrid', 'hotel', 'restaurante', 'catering', 'tienda', 'otro')),
    contacto TEXT,
    email TEXT,
    telefono TEXT,
    direccion TEXT,
    codigo_postal TEXT,
    ciudad TEXT DEFAULT 'Madrid',
    zona TEXT CHECK (zona IN ('norte', 'centro', 'sur')),
    estado TEXT DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'contactado', 'interesado', 'negociando', 'ganado', 'perdido')),
    origen TEXT CHECK (origen IN ('web', 'referido', 'feria', 'llamada', 'email', 'redes', 'importado', 'otro')),
    notas TEXT,
    valor_estimado DECIMAL(10,2) DEFAULT 0,
    latitud DECIMAL(10,8),
    longitud DECIMAL(11,8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    convertido_cliente_id INTEGER REFERENCES clientes(id)
);

-- Añadir campos a clientes si no existen
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_postal TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ciudad TEXT DEFAULT 'Madrid';

-- Índices
CREATE INDEX IF NOT EXISTS idx_leads_estado ON leads(estado);
CREATE INDEX IF NOT EXISTS idx_leads_codigo_postal ON leads(codigo_postal);

-- RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_leads" ON leads;
CREATE POLICY "auth_leads" ON leads FOR ALL TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE leads;

-- Datos de ejemplo
INSERT INTO leads (nombre, empresa, tipo, contacto, email, telefono, direccion, codigo_postal, ciudad, zona, estado, origen, valor_estimado) VALUES
('Grupo Lateral', 'Lateral Restaurantes', 'restaurante', 'Compras', 'compras@lateral.com', '91 111 2222', 'Calle Velázquez, 57', '28001', 'Madrid', 'centro', 'interesado', 'web', 500),
('Hotel Wellington', 'Wellington Hotel', 'hotel', 'Chef Ejecutivo', 'cocina@wellington.es', '91 222 3333', 'Velázquez, 8', '28001', 'Madrid', 'centro', 'contactado', 'feria', 800),
('Catering La Máquina', 'La Máquina Catering', 'catering', 'Director', 'info@lamaquina.es', '91 333 4444', 'Paseo Castellana, 89', '28046', 'Madrid', 'norte', 'nuevo', 'referido', 1200)
ON CONFLICT DO NOTHING;

SELECT 'LEADS TABLE CREATED SUCCESSFULLY!' as result;
