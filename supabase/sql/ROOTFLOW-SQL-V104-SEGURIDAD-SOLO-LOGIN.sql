-- =====================================================================
-- ROOTFLOW ERP · SQL V104 · Seguridad: las tablas solo se leen y modifican con sesión iniciada
-- Hasta ahora 53 tablas tenían políticas para `anon`/`public`: con la clave anon (que va dentro del JavaScript
-- público de la web) cualquiera podía leer y borrar albaranes, asientos, mandatos SEPA, compras a particulares…
-- 1) En cada tabla de `public` con alguna política para anon/public: se borran ESAS políticas y se crea
--    «Solo con sesión <tabla>» FOR ALL TO authenticated (la app siempre trabaja con sesión iniciada; las Edge
--    Functions usan la service role y no dependen de RLS; el área de cliente solo habla con portal-cliente).
-- 2) user_profiles: sin acceso anónimo; cada usuario ve todos los perfiles y crea/edita el suyo.
-- 3) Storage «documentos-corporativos»: subir, cambiar, listar y borrar solo con sesión (los enlaces públicos
--    de los archivos siguen funcionando porque el bucket es público).
-- Idempotente. Para volver atrás habría que recrear las políticas antiguas (no se recomienda).
-- =====================================================================
DO $$
DECLARE t text; p record;
BEGIN
  FOR t IN SELECT DISTINCT tablename FROM pg_policies
           WHERE schemaname = 'public' AND roles && ARRAY['anon', 'public']::name[] AND tablename <> 'user_profiles'
  LOOP
    FOR p IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = t AND roles && ARRAY['anon', 'public']::name[]
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Solo con sesión ' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', 'Solo con sesión ' || t, t);
  END LOOP;
END $$;

-- user_profiles
DROP POLICY IF EXISTS "Acceso anon user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Usuarios pueden crear su perfil" ON public.user_profiles;
CREATE POLICY "Usuarios pueden crear su perfil" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Storage: documentos-corporativos
DROP POLICY IF EXISTS "Acceso completo documentos 1nzusgv_0" ON storage.objects;
DROP POLICY IF EXISTS "Acceso completo documentos 1nzusgv_1" ON storage.objects;
DROP POLICY IF EXISTS "Acceso completo documentos 1nzusgv_2" ON storage.objects;
DROP POLICY IF EXISTS "Acceso completo documentos 1nzusgv_3" ON storage.objects;
DROP POLICY IF EXISTS "documentos_sesion_select" ON storage.objects;
DROP POLICY IF EXISTS "documentos_sesion_insert" ON storage.objects;
DROP POLICY IF EXISTS "documentos_sesion_update" ON storage.objects;
DROP POLICY IF EXISTS "documentos_sesion_delete" ON storage.objects;
CREATE POLICY "documentos_sesion_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos-corporativos');
CREATE POLICY "documentos_sesion_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos-corporativos');
CREATE POLICY "documentos_sesion_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'documentos-corporativos');
CREATE POLICY "documentos_sesion_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documentos-corporativos');

NOTIFY pgrst, 'reload schema';
SELECT 'V104 OK — ' || (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND roles && ARRAY['anon','public']::name[]) || ' políticas anónimas quedan en public' AS resultado;
