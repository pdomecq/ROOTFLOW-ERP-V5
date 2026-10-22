-- =====================================================
-- SQL PARA ROOTFLOW ERP V15
-- Ejecutar en Supabase → SQL Editor
-- Incluye: Contabilidad, Auditoría, Presupuestos, Tarifas, Muestras, CAPEX
-- =====================================================

-- =====================================================
-- TABLAS DE CONTABILIDAD
-- =====================================================

DROP TABLE IF EXISTS asiento_lineas CASCADE;
DROP TABLE IF EXISTS asientos_contables CASCADE;

CREATE TABLE asientos_contables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  numero TEXT NOT NULL,
  concepto TEXT NOT NULL,
  referencia TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE asiento_lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asiento_id UUID NOT NULL REFERENCES asientos_contables(id) ON DELETE CASCADE,
  cuenta TEXT NOT NULL,
  concepto TEXT,
  debe DECIMAL(12,2) DEFAULT 0,
  haber DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_asiento_lineas_asiento_id ON asiento_lineas(asiento_id);

ALTER TABLE asientos_contables ENABLE ROW LEVEL SECURITY;
ALTER TABLE asiento_lineas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo asientos" ON asientos_contables;
CREATE POLICY "Acceso completo asientos" ON asientos_contables
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso completo lineas" ON asiento_lineas;
CREATE POLICY "Acceso completo lineas" ON asiento_lineas
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================================================
-- CAMPOS ADICIONALES PARA FACTURAS
-- =====================================================

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS estado_cobro TEXT DEFAULT 'pendiente';
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS fecha_cobro DATE;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS iva_porcentaje DECIMAL(5,2) DEFAULT 4;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS recargo_equivalencia BOOLEAN DEFAULT FALSE;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS re_porcentaje DECIMAL(5,2) DEFAULT 0;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS re_importe DECIMAL(12,2) DEFAULT 0;

UPDATE facturas SET fecha_vencimiento = fecha WHERE fecha_vencimiento IS NULL;

-- =====================================================
-- CAMPOS ADICIONALES PARA CLIENTES
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_fiscal TEXT DEFAULT 'empresa';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS recargo_equivalencia BOOLEAN DEFAULT FALSE;

-- =====================================================
-- CAMPOS ADICIONALES PARA GASTOS (IVA tipo + CAPEX)
-- =====================================================

ALTER TABLE gastos ADD COLUMN IF NOT EXISTS forma_pago TEXT DEFAULT 'banco';
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS iva_tipo TEXT DEFAULT 'general';
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS es_capex BOOLEAN DEFAULT FALSE;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS vida_util_anios INTEGER; -- Para amortización

-- =====================================================
-- TABLA DE PERFILES DE USUARIO
-- =====================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nombre TEXT,
  rol TEXT DEFAULT 'usuario',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo user_profiles" ON user_profiles;
CREATE POLICY "Acceso completo user_profiles" ON user_profiles
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, nombre, rol)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)), 'usuario');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- TABLA DE AUDITORÍA
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_email TEXT,
  user_nombre TEXT,
  accion TEXT NOT NULL,
  tabla TEXT NOT NULL,
  registro_id TEXT,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo audit_log" ON audit_log;
CREATE POLICY "Acceso completo audit_log" ON audit_log
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_tabla ON audit_log(tabla);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- =====================================================
-- TABLA DE TARIFAS POR CLIENTE (PRECIOS ESPECIALES)
-- =====================================================

CREATE TABLE IF NOT EXISTS tarifas_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio_especial DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cliente_id, producto_id)
);

ALTER TABLE tarifas_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo tarifas_cliente" ON tarifas_cliente;
CREATE POLICY "Acceso completo tarifas_cliente" ON tarifas_cliente
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_tarifas_cliente_cliente ON tarifas_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_tarifas_cliente_producto ON tarifas_cliente(producto_id);

-- =====================================================
-- TABLA DE PRESUPUESTOS
-- =====================================================

CREATE TABLE IF NOT EXISTS presupuestos (
  id TEXT PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id),
  fecha DATE NOT NULL,
  validez INTEGER DEFAULT 15,
  estado TEXT DEFAULT 'pendiente',
  subtotal DECIMAL(12,2) DEFAULT 0,
  descuento_aplicado DECIMAL(12,2) DEFAULT 0,
  base_imponible DECIMAL(12,2) DEFAULT 0,
  iva_porcentaje DECIMAL(5,2) DEFAULT 4,
  iva DECIMAL(12,2) DEFAULT 0,
  recargo_equivalencia BOOLEAN DEFAULT FALSE,
  re_importe DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  notas TEXT,
  pedido_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo presupuestos" ON presupuestos;
CREATE POLICY "Acceso completo presupuestos" ON presupuestos
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_presupuestos_cliente ON presupuestos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado ON presupuestos(estado);

-- =====================================================
-- TABLA DE ITEMS DE PRESUPUESTO
-- =====================================================

CREATE TABLE IF NOT EXISTS presupuesto_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id TEXT NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id),
  cantidad INTEGER DEFAULT 1,
  precio_unitario DECIMAL(12,2) DEFAULT 0,
  subtotal DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE presupuesto_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo presupuesto_items" ON presupuesto_items;
CREATE POLICY "Acceso completo presupuesto_items" ON presupuesto_items
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA DE PAGOS A PROVEEDORES
-- =====================================================

CREATE TABLE IF NOT EXISTS pagos_proveedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id INTEGER REFERENCES proveedores(id),
  gasto_id INTEGER REFERENCES gastos(id),
  importe DECIMAL(12,2) NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  fecha_pago DATE,
  pagado BOOLEAN DEFAULT FALSE,
  forma_pago TEXT DEFAULT 'banco',
  referencia TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pagos_proveedor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo pagos_proveedor" ON pagos_proveedor;
CREATE POLICY "Acceso completo pagos_proveedor" ON pagos_proveedor
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pagos_proveedor_proveedor ON pagos_proveedor(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_pagos_proveedor_vencimiento ON pagos_proveedor(fecha_vencimiento);

-- =====================================================
-- TABLA DE MUESTRAS GRATUITAS
-- =====================================================

CREATE TABLE IF NOT EXISTS muestras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  nombre_contacto TEXT NOT NULL,
  empresa TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  tipo_negocio TEXT DEFAULT 'restaurante',
  fecha_entrega DATE NOT NULL,
  fecha_siguiente DATE, -- Próxima muestra programada
  estado TEXT DEFAULT 'pendiente', -- pendiente, programada, entregada, seguimiento, convertido, rechazado
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE muestras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo muestras" ON muestras;
CREATE POLICY "Acceso completo muestras" ON muestras
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_muestras_estado ON muestras(estado);
CREATE INDEX IF NOT EXISTS idx_muestras_fecha_entrega ON muestras(fecha_entrega);
CREATE INDEX IF NOT EXISTS idx_muestras_lead ON muestras(lead_id);

-- =====================================================
-- TABLA DE ITEMS DE MUESTRA
-- =====================================================

CREATE TABLE IF NOT EXISTS muestra_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  muestra_id UUID NOT NULL REFERENCES muestras(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id),
  cantidad INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE muestra_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo muestra_items" ON muestra_items;
CREATE POLICY "Acceso completo muestra_items" ON muestra_items
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_muestra_items_muestra ON muestra_items(muestra_id);

-- =====================================================
-- VERIFICACIÓN FINAL
-- =====================================================

SELECT '✅ TABLAS CREADAS CORRECTAMENTE:' AS mensaje;

SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'asientos_contables', 'asiento_lineas', 
  'user_profiles', 'audit_log',
  'tarifas_cliente', 'presupuestos', 'presupuesto_items', 
  'pagos_proveedor', 'muestras', 'muestra_items'
)
ORDER BY table_name;

SELECT '✅ V15 - Funcionalidades incluidas:' AS mensaje;
SELECT '   - Contabilidad partida doble (PGC España)' AS funcionalidad
UNION ALL SELECT '   - Auditoría de cambios'
UNION ALL SELECT '   - Presupuestos y conversión a pedidos'
UNION ALL SELECT '   - Tarifas especiales por cliente'
UNION ALL SELECT '   - Muestras gratuitas para captación'
UNION ALL SELECT '   - CAPEX vs OPEX en gastos'
UNION ALL SELECT '   - Pagos a proveedores'
UNION ALL SELECT '   - IVA 4% alimentos + Recargo Equivalencia'
UNION ALL SELECT '   - Exportación ZIP con facturas';
