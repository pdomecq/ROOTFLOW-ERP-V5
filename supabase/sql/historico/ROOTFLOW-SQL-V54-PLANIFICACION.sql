-- =====================================================
-- ROOTFLOW ERP V54 — PLANIFICACIÓN DE PRODUCCIÓN
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Permite definir planes recurrentes de producción por cliente
-- y generar automáticamente el calendario de tareas (sembrar,
-- pasar a luz, cosechar) con todos los cálculos del PDF.
-- =====================================================

-- 1. Extender VARIEDADES con datos de ciclo completo
ALTER TABLE variedades ADD COLUMN IF NOT EXISTS dias_germinacion INTEGER DEFAULT 6;
ALTER TABLE variedades ADD COLUMN IF NOT EXISTS dias_luz INTEGER DEFAULT 10;
ALTER TABLE variedades ADD COLUMN IF NOT EXISTS gramos_produccion_por_tray DECIMAL(10, 2) DEFAULT 100;
-- Nota: ya existían gramos_semilla_por_bandeja y rendimiento_g_por_bandeja en V48
-- 'gramos_semilla_por_bandeja' lo reutilizamos como semilla por TRAY (bandeja física de cultivo)

-- 2. PLANES DE PRODUCCIÓN (cliente + variedad + cantidad recurrente)
CREATE TABLE IF NOT EXISTS planes_produccion (
  id SERIAL PRIMARY KEY,
  nombre TEXT,                                   -- ej: "Pizzería Rossi - Cilantro"
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  variedad_id INTEGER NOT NULL REFERENCES variedades(id) ON DELETE CASCADE,
  
  -- Pedido base
  bandejas_venta_semanales INTEGER NOT NULL,    -- ej: 90 (las cajitas finales de venta)
  peso_bandeja_venta_g DECIMAL(8, 2) DEFAULT 30,-- ej: 30g por cajita
  
  -- Días de entrega (array JSON con días de la semana en minúscula)
  dias_entrega JSONB DEFAULT '["lunes", "jueves"]'::jsonb,
  
  -- Merma de seguridad
  merma_pct DECIMAL(5, 2) DEFAULT 10,
  
  -- Overrides opcionales del ciclo (si vacío, usa la variedad)
  dias_germinacion_override INTEGER,
  dias_luz_override INTEGER,
  produccion_tray_override DECIMAL(10,2),
  semilla_tray_override DECIMAL(10,2),
  
  -- Estado
  activo BOOLEAN DEFAULT TRUE,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE,                                -- NULL = sin fin definido
  notas TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planes_activo ON planes_produccion(activo);
CREATE INDEX IF NOT EXISTS idx_planes_cliente ON planes_produccion(cliente_id);

ALTER TABLE planes_produccion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo planes_produccion" ON planes_produccion;
CREATE POLICY "Acceso completo planes_produccion" ON planes_produccion FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'planes_produccion') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE planes_produccion;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 3. TAREAS DE CALENDARIO (generadas a partir de los planes)
CREATE TABLE IF NOT EXISTS tareas_calendario (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER REFERENCES planes_produccion(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL,  -- 'sembrar' | 'pasar_luz' | 'cosechar' | 'entregar'
  variedad_id INTEGER REFERENCES variedades(id) ON DELETE SET NULL,
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  
  -- Cantidades calculadas
  trays INTEGER NOT NULL DEFAULT 0,
  semilla_g DECIMAL(10, 2) DEFAULT 0,
  bandejas_venta INTEGER,  -- cajitas finales (para cosechas)
  
  -- Vinculación con lote real (Fase 2)
  lote_id INTEGER REFERENCES lotes(id) ON DELETE SET NULL,
  
  -- Estado
  estado TEXT DEFAULT 'pendiente',  -- 'pendiente' | 'hecho' | 'omitido'
  fecha_completado TIMESTAMPTZ,
  notas TEXT,
  
  -- Para dedupe al regenerar
  fecha_entrega_origen DATE,  -- de qué día de entrega proviene esta tarea
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(plan_id, fecha, tipo, fecha_entrega_origen)
);

CREATE INDEX IF NOT EXISTS idx_tareas_fecha ON tareas_calendario(fecha);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas_calendario(estado, fecha);
CREATE INDEX IF NOT EXISTS idx_tareas_plan ON tareas_calendario(plan_id);

ALTER TABLE tareas_calendario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo tareas_calendario" ON tareas_calendario;
CREATE POLICY "Acceso completo tareas_calendario" ON tareas_calendario FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'tareas_calendario') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tareas_calendario;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V54 OK — Planificación de producción' as resultado;
