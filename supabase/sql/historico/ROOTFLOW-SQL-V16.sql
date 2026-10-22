-- =====================================================
-- SQL PARA ROOTFLOW ERP V16
-- Ejecutar en Supabase → SQL Editor
-- Incluye: Todo V15 + Recetas con campos personalizables
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
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS re_porcentaje DECIMAL(5,2) DEFAULT 0.5;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS re_importe DECIMAL(12,2) DEFAULT 0;

-- =====================================================
-- CAMPOS ADICIONALES PARA CLIENTES
-- =====================================================

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo_fiscal TEXT DEFAULT 'normal';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS recargo_equivalencia BOOLEAN DEFAULT FALSE;

-- =====================================================
-- CAMPOS ADICIONALES PARA GASTOS (CAPEX/OPEX)
-- =====================================================

ALTER TABLE gastos ADD COLUMN IF NOT EXISTS forma_pago TEXT DEFAULT 'banco';
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS iva_tipo TEXT DEFAULT 'general';
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS es_capex BOOLEAN DEFAULT FALSE;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS vida_util_anios INTEGER;

-- =====================================================
-- TABLA DE PERFILES DE USUARIO
-- =====================================================

DROP TABLE IF EXISTS user_profiles CASCADE;

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nombre TEXT,
  rol TEXT DEFAULT 'usuario',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios pueden ver su perfil" ON user_profiles;
CREATE POLICY "Usuarios pueden ver su perfil" ON user_profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Usuarios pueden actualizar su perfil" ON user_profiles;
CREATE POLICY "Usuarios pueden actualizar su perfil" ON user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Acceso anon user_profiles" ON user_profiles;
CREATE POLICY "Acceso anon user_profiles" ON user_profiles
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA DE AUDITORÍA
-- =====================================================

DROP TABLE IF EXISTS audit_log CASCADE;

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID,
  usuario_email TEXT,
  accion TEXT NOT NULL,
  tabla TEXT NOT NULL,
  registro_id TEXT,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  descripcion TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_fecha ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_tabla ON audit_log(tabla);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo audit" ON audit_log;
CREATE POLICY "Acceso completo audit" ON audit_log
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA DE TARIFAS POR CLIENTE
-- =====================================================

DROP TABLE IF EXISTS tarifas_cliente CASCADE;

CREATE TABLE tarifas_cliente (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio_especial DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cliente_id, producto_id)
);

CREATE INDEX idx_tarifas_cliente ON tarifas_cliente(cliente_id);

ALTER TABLE tarifas_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo tarifas" ON tarifas_cliente;
CREATE POLICY "Acceso completo tarifas" ON tarifas_cliente
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================================================
-- TABLAS DE PRESUPUESTOS
-- =====================================================

DROP TABLE IF EXISTS presupuesto_items CASCADE;
DROP TABLE IF EXISTS presupuestos CASCADE;

CREATE TABLE presupuestos (
  id TEXT PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE presupuesto_items (
  id SERIAL PRIMARY KEY,
  presupuesto_id TEXT NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  cantidad INTEGER DEFAULT 1,
  precio_unitario DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(12,2) DEFAULT 0
);

CREATE INDEX idx_presupuesto_items ON presupuesto_items(presupuesto_id);

ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo presupuestos" ON presupuestos;
CREATE POLICY "Acceso completo presupuestos" ON presupuestos
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso completo presupuesto_items" ON presupuesto_items;
CREATE POLICY "Acceso completo presupuesto_items" ON presupuesto_items
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA DE PAGOS A PROVEEDORES
-- =====================================================

DROP TABLE IF EXISTS pagos_proveedor CASCADE;

CREATE TABLE pagos_proveedor (
  id SERIAL PRIMARY KEY,
  proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE CASCADE,
  gasto_id INTEGER REFERENCES gastos(id) ON DELETE SET NULL,
  concepto TEXT NOT NULL,
  importe DECIMAL(12,2) NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  fecha_pago DATE,
  estado TEXT DEFAULT 'pendiente',
  forma_pago TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pagos_proveedor_estado ON pagos_proveedor(estado);
CREATE INDEX idx_pagos_proveedor_vencimiento ON pagos_proveedor(fecha_vencimiento);

ALTER TABLE pagos_proveedor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo pagos_proveedor" ON pagos_proveedor;
CREATE POLICY "Acceso completo pagos_proveedor" ON pagos_proveedor
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================================================
-- TABLAS DE MUESTRAS GRATUITAS
-- =====================================================

DROP TABLE IF EXISTS muestra_items CASCADE;
DROP TABLE IF EXISTS muestras CASCADE;

CREATE TABLE muestras (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  nombre_contacto TEXT NOT NULL,
  empresa TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  fecha_programada DATE,
  fecha_entrega DATE,
  estado TEXT DEFAULT 'pendiente',
  coste_estimado DECIMAL(10,2) DEFAULT 0,
  notas TEXT,
  resultado TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE muestra_items (
  id SERIAL PRIMARY KEY,
  muestra_id INTEGER NOT NULL REFERENCES muestras(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  cantidad INTEGER DEFAULT 1
);

CREATE INDEX idx_muestra_items ON muestra_items(muestra_id);

ALTER TABLE muestras ENABLE ROW LEVEL SECURITY;
ALTER TABLE muestra_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo muestras" ON muestras;
CREATE POLICY "Acceso completo muestras" ON muestras
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acceso completo muestra_items" ON muestra_items;
CREATE POLICY "Acceso completo muestra_items" ON muestra_items
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================================================
-- TABLA DE RECETAS DE PRODUCCIÓN (CON CAMPOS PERSONALIZABLES)
-- =====================================================

DROP TABLE IF EXISTS recetas_produccion CASCADE;

CREATE TABLE recetas_produccion (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
  variedad TEXT,
  dias_ciclo INTEGER DEFAULT 10,
  rendimiento_esperado INTEGER DEFAULT 85,
  semillas_por_bandeja TEXT,
  sustrato TEXT,
  riego_frecuencia TEXT,
  luz_horas INTEGER DEFAULT 16,
  temperatura_min INTEGER DEFAULT 18,
  temperatura_max INTEGER DEFAULT 24,
  humedad_min INTEGER DEFAULT 50,
  humedad_max INTEGER DEFAULT 70,
  instrucciones_siembra TEXT,
  instrucciones_cosecha TEXT,
  notas TEXT,
  -- CAMPOS PERSONALIZABLES EN JSONB
  campos_personalizados JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentario explicativo del formato de campos_personalizados:
-- [
--   { "id": 1, "nombre": "pH agua", "tipo": "numero", "valor": "6.5", "unidad": "pH" },
--   { "id": 2, "nombre": "EC nutrientes", "tipo": "numero", "valor": "1.2", "unidad": "mS/cm" },
--   { "id": 3, "nombre": "Remojo previo", "tipo": "booleano", "valor": true },
--   { "id": 4, "nombre": "Tiempo remojo", "tipo": "tiempo", "valor": "8", "unidad": "horas" }
-- ]

CREATE INDEX idx_recetas_producto ON recetas_produccion(producto_id);

ALTER TABLE recetas_produccion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso completo recetas" ON recetas_produccion;
CREATE POLICY "Acceso completo recetas" ON recetas_produccion
  FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

-- =====================================================
-- MENSAJE DE ÉXITO
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ SQL V16 ejecutado correctamente';
  RAISE NOTICE '   - Tablas de contabilidad creadas';
  RAISE NOTICE '   - Campos de factura actualizados';
  RAISE NOTICE '   - Campos de gastos (CAPEX/OPEX) añadidos';
  RAISE NOTICE '   - Tabla de perfiles de usuario creada';
  RAISE NOTICE '   - Tabla de auditoría creada';
  RAISE NOTICE '   - Tabla de tarifas por cliente creada';
  RAISE NOTICE '   - Tablas de presupuestos creadas';
  RAISE NOTICE '   - Tabla de pagos a proveedores creada';
  RAISE NOTICE '   - Tablas de muestras creadas';
  RAISE NOTICE '   - Tabla de recetas con campos personalizables (JSONB)';
END $$;
