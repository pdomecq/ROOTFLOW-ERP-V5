-- V127: SII (Suministro Inmediato de Información del IVA). Resultado de cada factura enviada a la AEAT.
-- La función de Vercel api/sii.js inserta una fila por factura en cada envío (también los de pruebas).

CREATE TABLE IF NOT EXISTS public.sii_envios (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  libro TEXT NOT NULL,                 -- 'emitidas' | 'recibidas'
  ref_tipo TEXT,                       -- 'factura' | 'tpv' | 'gasto'
  ref_id TEXT,                         -- id de la factura, del recibo TPV o del gasto
  numero TEXT,                         -- número de la factura tal como se envió
  periodo TEXT,                        -- AAAA-MM
  entorno TEXT DEFAULT 'pruebas',      -- 'pruebas' | 'produccion'
  tipo_comunicacion TEXT DEFAULT 'A0', -- A0 alta · A1 modificación
  estado TEXT,                         -- Correcto | AceptadoConErrores | Incorrecto | Error
  codigo TEXT,
  descripcion TEXT,
  csv TEXT,                            -- código seguro de verificación del envío
  enviado_por TEXT
);
CREATE INDEX IF NOT EXISTS sii_envios_ref ON public.sii_envios (ref_tipo, ref_id, entorno, created_at DESC);

ALTER TABLE public.sii_envios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sii_envios_todo ON public.sii_envios;
CREATE POLICY sii_envios_todo ON public.sii_envios FOR ALL TO authenticated
  USING (public.usuario_activo()) WITH CHECK (public.usuario_activo());

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'sii_envios') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sii_envios;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
SELECT 'V127 OK — tabla sii_envios para el SII' AS resultado;
