-- =====================================================
-- ROOTFLOW ERP V36 - DOCUMENTOS CORPORATIVOS
-- Ejecutar en Supabase SQL Editor
-- =====================================================
-- Tabla para archivar documentos importantes de la empresa
-- (constitución, contratos, escrituras, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS documentos_corporativos (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  categoria TEXT DEFAULT 'otros',
  -- categorías sugeridas:
  -- 'constitucion'        Constitución sociedad, escrituras
  -- 'contratos_alquiler'  Contratos de alquiler de naves, oficinas
  -- 'contratos_banco'     Contratos bancarios, mandatos
  -- 'contratos_proveed'   Contratos con proveedores clave
  -- 'contratos_cliente'   Contratos marco con clientes
  -- 'seguros'             Pólizas de seguro
  -- 'fiscal'              Modelos, declaraciones, IRPF, IS
  -- 'laboral'             Contratos laborales, nóminas, SS
  -- 'licencias'           Licencias actividad, sanitarias, certificados
  -- 'dominio_web'         Dominio, hosting, SSL
  -- 'marca_propiedad'     Registro de marca, propiedad intelectual
  -- 'subvenciones'        Resoluciones, justificantes de ayudas
  -- 'otros'               Otros
  
  emisor TEXT,                          -- Quién emite el documento (BBVA, ICEX, etc.)
  numero_referencia TEXT,               -- Nº contrato, nº escritura, etc.
  fecha_documento DATE,                 -- Fecha del documento
  fecha_vencimiento DATE,               -- Si tiene fecha de caducidad
  importe_relacionado DECIMAL(12, 2),   -- Si tiene importe asociado
  
  archivo_url TEXT NOT NULL,            -- URL del fichero en Storage
  archivo_nombre TEXT,                  -- Nombre original del archivo
  archivo_tipo TEXT,                    -- 'pdf', 'docx', 'jpg', etc.
  archivo_tamano_bytes INTEGER,         -- Tamaño en bytes
  
  importante BOOLEAN DEFAULT FALSE,     -- Marcar como crítico (constitución, etc.)
  tags TEXT[],                          -- Etiquetas libres
  notas TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_docs_categoria ON documentos_corporativos(categoria);
CREATE INDEX IF NOT EXISTS idx_docs_fecha ON documentos_corporativos(fecha_documento DESC);
CREATE INDEX IF NOT EXISTS idx_docs_importante ON documentos_corporativos(importante) WHERE importante = TRUE;

ALTER TABLE documentos_corporativos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Acceso completo documentos_corporativos') THEN
    CREATE POLICY "Acceso completo documentos_corporativos" ON documentos_corporativos FOR ALL TO authenticated, anon USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'documentos_corporativos') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE documentos_corporativos;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'V36 OK - Documentos corporativos' as resultado;

-- =====================================================
-- IMPORTANTE: STORAGE BUCKET
-- =====================================================
-- Crear bucket en Supabase Dashboard → Storage:
-- Nombre: documentos-corporativos
-- Public: TRUE (para que los enlaces funcionen sin auth)
-- 
-- Después crear policies (SELECT, INSERT, DELETE) que permitan a anon y authenticated.
-- =====================================================
