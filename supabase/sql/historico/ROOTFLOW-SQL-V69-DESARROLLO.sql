-- =====================================================
-- ROOTFLOW ERP V69 — DESARROLLO Y FINANCIACIÓN (pipeline)
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- CRM de desarrollo de negocio: inversores, bancos, VCs, FFF,
-- empresas del sector, colaboradores, organismos públicos...
-- Pipeline de estados + historial de interacciones por contacto.
-- =====================================================

CREATE TABLE IF NOT EXISTS contactos_desarrollo (
  id SERIAL PRIMARY KEY,

  -- Entidad
  nombre_entidad TEXT NOT NULL,
  tipo_entidad TEXT DEFAULT 'inversor_privado',
  -- 'banco' | 'vc' | 'inversor_privado' | 'fff' | 'empresa_sector' |
  -- 'organismo_publico' | 'aceleradora' | 'colaborador' | 'otro'

  -- Persona de contacto
  persona_contacto TEXT,
  cargo TEXT,
  email TEXT,
  telefono TEXT,
  linkedin TEXT,
  web TEXT,

  -- Oportunidad
  tipo_oportunidad TEXT DEFAULT 'equity',
  -- 'equity' | 'prestamo_participativo' | 'deuda_bancaria' | 'subvencion' |
  -- 'partnership' | 'advisory' | 'mixto' | 'otro'
  estado TEXT DEFAULT 'identificado',
  -- 'identificado' | 'contactado' | 'reunion' | 'negociacion' |
  -- 'compromiso' | 'cerrado_ganado' | 'descartado'
  prioridad TEXT DEFAULT 'media',              -- 'alta' | 'media' | 'baja'

  -- Términos
  importe_potencial DECIMAL(14, 2),            -- € que podría aportar
  condiciones TEXT,                            -- resumen de términos ofrecidos/pedidos
  valoracion_pre DECIMAL(14, 2),               -- pre-money si equity
  interes_pct DECIMAL(6, 3),                   -- tipo de interés si deuda/participativo

  -- Origen y seguimiento
  como_llegamos TEXT,                          -- referido, evento, LinkedIn...
  proximo_paso TEXT,
  fecha_proximo_paso DATE,

  notas TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contactos_dev_estado ON contactos_desarrollo(estado);
CREATE INDEX IF NOT EXISTS idx_contactos_dev_tipo ON contactos_desarrollo(tipo_entidad);
CREATE INDEX IF NOT EXISTS idx_contactos_dev_proximo ON contactos_desarrollo(fecha_proximo_paso);

ALTER TABLE contactos_desarrollo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo contactos_desarrollo" ON contactos_desarrollo;
CREATE POLICY "Acceso completo contactos_desarrollo" ON contactos_desarrollo FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'contactos_desarrollo') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE contactos_desarrollo;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Historial de interacciones (reuniones, llamadas, emails...)
CREATE TABLE IF NOT EXISTS interacciones_desarrollo (
  id SERIAL PRIMARY KEY,
  contacto_id INTEGER NOT NULL REFERENCES contactos_desarrollo(id) ON DELETE CASCADE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT DEFAULT 'reunion',                 -- 'reunion' | 'videollamada' | 'llamada' | 'email' | 'whatsapp' | 'evento' | 'otro'
  resumen TEXT,                                -- qué se habló
  acuerdos TEXT,                               -- next steps / compromisos
  asistentes TEXT,                             -- quiénes estuvieron (por ambas partes)
  documentos_enviados TEXT,                    -- deck, modelo financiero, NDA...
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interacciones_dev_contacto ON interacciones_desarrollo(contacto_id, fecha DESC);

ALTER TABLE interacciones_desarrollo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso completo interacciones_desarrollo" ON interacciones_desarrollo;
CREATE POLICY "Acceso completo interacciones_desarrollo" ON interacciones_desarrollo FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'interacciones_desarrollo') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE interacciones_desarrollo;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V69 OK — Módulo Desarrollo y Financiación' as resultado;
