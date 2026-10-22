-- =====================================================
-- ROOTFLOW ERP V21 - FIXES SCHEMA
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Este SQL arregla varios problemas de schema:
-- 1. presupuestos.id debe ser TEXT (P-2026-0001) no SERIAL
-- 2. Verificar tablas pedidos_recurrentes y items
-- 3. Asegurar que muestras y muestra_items tienen permisos
-- =====================================================

-- 1. FIX: presupuestos.id debe ser TEXT
-- Si la tabla existe con id SERIAL, hay que recrear o alterar

DO $$
DECLARE
  col_type TEXT;
BEGIN
  -- Verificar tipo actual de presupuestos.id
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'presupuestos' AND column_name = 'id';
  
  IF col_type = 'integer' THEN
    -- Hay datos? Si no, podemos recrear
    -- Si hay datos, necesita migración manual (raro porque el id no funciona)
    RAISE NOTICE 'presupuestos.id es INTEGER, hay que recrear la tabla con TEXT';
    
    -- Eliminar items dependientes
    DROP TABLE IF EXISTS presupuesto_items CASCADE;
    DROP TABLE IF EXISTS presupuestos CASCADE;
    
    -- Recrear con id TEXT
    CREATE TABLE presupuestos (
      id TEXT PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      fecha DATE NOT NULL DEFAULT CURRENT_DATE,
      validez INTEGER DEFAULT 15,
      estado TEXT DEFAULT 'pendiente',
      subtotal DECIMAL(10,2) DEFAULT 0,
      descuento_aplicado DECIMAL(10,2) DEFAULT 0,
      base_imponible DECIMAL(10,2) DEFAULT 0,
      iva_porcentaje DECIMAL(5,2) DEFAULT 4,
      iva DECIMAL(10,2) DEFAULT 0,
      recargo_equivalencia BOOLEAN DEFAULT FALSE,
      re_importe DECIMAL(10,2) DEFAULT 0,
      total DECIMAL(10,2) DEFAULT 0,
      notas TEXT,
      condiciones TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    CREATE TABLE presupuesto_items (
      id SERIAL PRIMARY KEY,
      presupuesto_id TEXT REFERENCES presupuestos(id) ON DELETE CASCADE,
      producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
      cantidad INTEGER DEFAULT 1,
      precio_unitario DECIMAL(10,2) DEFAULT 0,
      subtotal DECIMAL(10,2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
    ALTER TABLE presupuesto_items ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Acceso completo presupuestos" ON presupuestos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
    CREATE POLICY "Acceso completo presupuesto_items" ON presupuesto_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
    
    RAISE NOTICE 'presupuestos recreada con id TEXT';
  ELSE
    RAISE NOTICE 'presupuestos.id ya es TEXT u otro tipo correcto';
  END IF;
END $$;

-- 2. Si las tablas no existen aún, crearlas con id TEXT
CREATE TABLE IF NOT EXISTS presupuestos (
  id TEXT PRIMARY KEY,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  validez INTEGER DEFAULT 15,
  estado TEXT DEFAULT 'pendiente',
  subtotal DECIMAL(10,2) DEFAULT 0,
  descuento_aplicado DECIMAL(10,2) DEFAULT 0,
  base_imponible DECIMAL(10,2) DEFAULT 0,
  iva_porcentaje DECIMAL(5,2) DEFAULT 4,
  iva DECIMAL(10,2) DEFAULT 0,
  recargo_equivalencia BOOLEAN DEFAULT FALSE,
  re_importe DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  notas TEXT,
  condiciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS presupuesto_items (
  id SERIAL PRIMARY KEY,
  presupuesto_id TEXT REFERENCES presupuestos(id) ON DELETE CASCADE,
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

-- 3. Tabla pedidos_recurrentes (si no existe)
CREATE TABLE IF NOT EXISTS pedidos_recurrentes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
  frecuencia TEXT DEFAULT 'semanal',
  dia_semana INTEGER DEFAULT 1,
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  ultimo_ejecutado DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pedidos_recurrentes_items (
  id SERIAL PRIMARY KEY,
  pedido_recurrente_id INTEGER REFERENCES pedidos_recurrentes(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
  cantidad INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pedidos_recurrentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_recurrentes_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo pedidos_recurrentes') THEN
    CREATE POLICY "Acceso completo pedidos_recurrentes" ON pedidos_recurrentes FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo pedidos_recurrentes_items') THEN
    CREATE POLICY "Acceso completo pedidos_recurrentes_items" ON pedidos_recurrentes_items FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Verificar muestras y muestra_items
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

CREATE TABLE IF NOT EXISTS muestra_items (
  id SERIAL PRIMARY KEY,
  muestra_id INTEGER REFERENCES muestras(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE CASCADE,
  cantidad INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE muestras ENABLE ROW LEVEL SECURITY;
ALTER TABLE muestra_items ENABLE ROW LEVEL SECURITY;

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

-- FIN
SELECT 'SQL V21 - Fixes de schema aplicados correctamente' as resultado;
