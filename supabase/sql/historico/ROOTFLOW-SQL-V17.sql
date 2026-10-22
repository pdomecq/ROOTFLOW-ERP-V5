-- =====================================================
-- ROOTFLOW ERP V17 - SQL UPDATES
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Añadir columnas a pedidos para concepto y horario
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS concepto TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS horario_entrega TEXT;

-- 2. Tabla recetas_produccion (si no existe)
CREATE TABLE IF NOT EXISTS recetas_produccion (
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
  campos_personalizados JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla muestras (si no existe)
CREATE TABLE IF NOT EXISTS muestras (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  nombre_contacto TEXT NOT NULL,
  empresa TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  tipo_negocio TEXT DEFAULT 'restaurante',
  fecha_entrega DATE NOT NULL,
  fecha_siguiente DATE,
  estado TEXT DEFAULT 'pendiente',
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabla muestra_items (si no existe)
CREATE TABLE IF NOT EXISTS muestra_items (
  id SERIAL PRIMARY KEY,
  muestra_id INTEGER REFERENCES muestras(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
  cantidad INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabla pagos_proveedor (si no existe)
CREATE TABLE IF NOT EXISTS pagos_proveedor (
  id SERIAL PRIMARY KEY,
  proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE CASCADE,
  importe DECIMAL(10,2) NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  fecha_pago DATE,
  referencia TEXT,
  notas TEXT,
  pagado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Habilitar RLS en todas las tablas nuevas
ALTER TABLE recetas_produccion ENABLE ROW LEVEL SECURITY;
ALTER TABLE muestras ENABLE ROW LEVEL SECURITY;
ALTER TABLE muestra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_proveedor ENABLE ROW LEVEL SECURITY;

-- 7. Políticas RLS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo recetas') THEN
    CREATE POLICY "Acceso completo recetas" ON recetas_produccion FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo muestras') THEN
    CREATE POLICY "Acceso completo muestras" ON muestras FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo muestra_items') THEN
    CREATE POLICY "Acceso completo muestra_items" ON muestra_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo pagos_proveedor') THEN
    CREATE POLICY "Acceso completo pagos_proveedor" ON pagos_proveedor FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 8. Verificar que existe tabla tarifas_cliente
CREATE TABLE IF NOT EXISTS tarifas_cliente (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
  precio_especial DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cliente_id, producto_id)
);

ALTER TABLE tarifas_cliente ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo tarifas_cliente') THEN
    CREATE POLICY "Acceso completo tarifas_cliente" ON tarifas_cliente FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 9. Tabla presupuestos (si no existe)
CREATE TABLE IF NOT EXISTS presupuestos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  fecha DATE NOT NULL,
  fecha_validez DATE,
  estado TEXT DEFAULT 'pendiente',
  subtotal DECIMAL(10,2) DEFAULT 0,
  iva DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  notas TEXT,
  condiciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS presupuesto_items (
  id SERIAL PRIMARY KEY,
  presupuesto_id INTEGER REFERENCES presupuestos(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
  cantidad INTEGER DEFAULT 1,
  precio_unitario DECIMAL(10,2) DEFAULT 0,
  subtotal DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo presupuestos') THEN
    CREATE POLICY "Acceso completo presupuestos" ON presupuestos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo presupuesto_items') THEN
    CREATE POLICY "Acceso completo presupuesto_items" ON presupuesto_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- FIN
SELECT 'SQL V17 ejecutado correctamente' as resultado;
