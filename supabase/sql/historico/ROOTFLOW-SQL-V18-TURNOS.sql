-- =====================================================
-- ROOTFLOW ERP V18 - SISTEMA DE TURNOS
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- ⚠️ IMPORTANTE: Ejecutar primero ROOTFLOW-SQL-V17.sql si no se ha hecho

-- 1. Tabla socios
CREATE TABLE IF NOT EXISTS socios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT,
  telefono TEXT,
  rol TEXT DEFAULT 'socio',
  color TEXT DEFAULT '#F97316',
  activo BOOLEAN DEFAULT TRUE,
  notificaciones_email BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE socios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo socios') THEN
    CREATE POLICY "Acceso completo socios" ON socios FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 2. Tabla turnos
CREATE TABLE IF NOT EXISTS turnos (
  id SERIAL PRIMARY KEY,
  socio_id INTEGER REFERENCES socios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'riego',
  fecha DATE NOT NULL,
  hora TIME DEFAULT '09:00',
  duracion_minutos INTEGER DEFAULT 60,
  notas TEXT,
  completado BOOLEAN DEFAULT FALSE,
  enviar_alerta BOOLEAN DEFAULT TRUE,
  alerta_enviada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON turnos(fecha);
CREATE INDEX IF NOT EXISTS idx_turnos_socio ON turnos(socio_id);

ALTER TABLE turnos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo turnos') THEN
    CREATE POLICY "Acceso completo turnos" ON turnos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 3. Insertar los 3 socios de Rootflow (solo si la tabla está vacía)
INSERT INTO socios (nombre, email, rol, color, activo, notificaciones_email)
SELECT * FROM (VALUES
  ('Pedro Domecq Vergara', 'peri@rootflow.es', 'socio', '#F97316', TRUE, TRUE),
  ('Domingo de Guzmán Greus', 'domingo@rootflow.es', 'socio', '#10B981', TRUE, TRUE),
  ('Nicolás Bustamante Thams', 'nicolas@rootflow.es', 'socio', '#3B82F6', TRUE, TRUE)
) AS new_socios(nombre, email, rol, color, activo, notificaciones_email)
WHERE NOT EXISTS (SELECT 1 FROM socios LIMIT 1);

-- FIN
SELECT 'SQL V18 - Sistema de turnos creado' as resultado, COUNT(*) as socios_existentes FROM socios;
