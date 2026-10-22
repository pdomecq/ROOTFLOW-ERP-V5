-- =====================================================
-- ROOTFLOW ERP V19 - MÚLTIPLES CONTACTOS POR CLIENTE
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- ⚠️ IMPORTANTE: Ejecutar primero ROOTFLOW-SQL-V17.sql y V18 si no se ha hecho

-- 1. Tabla cliente_contactos (contactos adicionales por cliente)
-- El contacto principal sigue en la tabla clientes (campos contacto/email/telefono)
-- Esta tabla es para chef, jefe de compras, encargado, etc.
CREATE TABLE IF NOT EXISTS cliente_contactos (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cargo TEXT,
  email TEXT,
  telefono TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cliente_contactos_cliente ON cliente_contactos(cliente_id);

ALTER TABLE cliente_contactos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo cliente_contactos') THEN
    CREATE POLICY "Acceso completo cliente_contactos" ON cliente_contactos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- FIN
SELECT 'SQL V19 - Tabla cliente_contactos creada' as resultado;
