-- =====================================================================
-- ROOTFLOW ERP · SQL V105 · Usuarios, permisos e historial de cambios
-- 1) user_profiles: + last_login, avatar_url, permisos (jsonb: secciones permitidas; null = las de su rol), socio.
--    Se crea el perfil de cada usuario de Auth que no lo tenga. Los tres socios pasan a «admin».
-- 2) Solo un ADMIN puede cambiar el rol, los permisos o activar/desactivar usuarios (trigger). Las cuentas nuevas
--    nacen DESACTIVADAS: hasta que un admin las active no ven ningún dato (aunque alguien se registre).
-- 3) Todas las políticas «con sesión» exigen además usuario ACTIVO (usuario_activo()).
-- 4) Historial: audit_log + usuario_nombre; se rellena SOLO con un trigger en las tablas principales (quién, qué
--    tabla, qué registro y qué campos cambiaron: antes → después). Nadie puede editar ni borrar el historial.
-- 5) usuarios_sistema(): último acceso real de cada usuario (de auth.users), solo para usuarios activos.
-- Idempotente.
-- =====================================================================

-- 1) Columnas
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS permisos JSONB;
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS socio TEXT;
ALTER TABLE public.user_profiles ALTER COLUMN activo SET DEFAULT false;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS usuario_nombre TEXT;
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_tabla_idx ON public.audit_log (tabla, registro_id);

-- Perfiles que faltan (usuarios de Auth sin perfil) y socios como administradores
INSERT INTO public.user_profiles (id, email, nombre, rol, activo)
SELECT u.id, u.email, split_part(u.email, '@', 1), 'usuario', true
FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = u.id);
UPDATE public.user_profiles SET rol = 'admin', activo = true, socio = 'peri', nombre = COALESCE(NULLIF(nombre, 'p.domecq'), 'Peri') WHERE email = 'p.domecq@rootflow.es';
UPDATE public.user_profiles SET rol = 'admin', activo = true, socio = 'nico', nombre = CASE WHEN nombre IS NULL OR nombre = 'n.bustamante' THEN 'Nico' ELSE nombre END WHERE email = 'n.bustamante@rootflow.es';
UPDATE public.user_profiles SET rol = 'admin', activo = true, socio = 'guzman', nombre = CASE WHEN nombre IS NULL OR nombre = 'g.greus' THEN 'Guzmán' ELSE nombre END WHERE email = 'g.greus@rootflow.es';

-- 2) Funciones de permisos
CREATE OR REPLACE FUNCTION public.usuario_activo() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT activo FROM public.user_profiles WHERE id = auth.uid()), false)
$$;
CREATE OR REPLACE FUNCTION public.es_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND rol = 'admin' AND activo)
$$;
REVOKE ALL ON FUNCTION public.usuario_activo() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.es_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuario_activo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.es_admin() TO authenticated;

-- Las cuentas nuevas nacen desactivadas
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, nombre, rol, activo)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)), 'usuario', false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

-- Solo un admin cambia rol, permisos, socio o activo (el resto puede cambiar su nombre, avatar y último acceso)
CREATE OR REPLACE FUNCTION public.proteger_perfil() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.es_admin() THEN RETURN NEW; END IF; -- SQL Editor, service role, alta en Auth o admin
  IF TG_OP = 'INSERT' THEN
    NEW.rol := 'usuario'; NEW.activo := false; NEW.permisos := NULL; NEW.socio := NULL;
    RETURN NEW;
  END IF;
  IF NEW.rol IS DISTINCT FROM OLD.rol OR NEW.activo IS DISTINCT FROM OLD.activo
     OR NEW.permisos IS DISTINCT FROM OLD.permisos OR NEW.socio IS DISTINCT FROM OLD.socio THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar roles, permisos o activar usuarios';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_proteger_perfil ON public.user_profiles;
CREATE TRIGGER trg_proteger_perfil BEFORE INSERT OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.proteger_perfil();

DROP POLICY IF EXISTS "Admins gestionan perfiles" ON public.user_profiles;
CREATE POLICY "Admins gestionan perfiles" ON public.user_profiles FOR UPDATE TO authenticated USING ((SELECT public.es_admin())) WITH CHECK ((SELECT public.es_admin()));

-- 3) Todas las políticas abiertas a «authenticated» exigen además usuario activo (menos user_profiles: cada uno
--    tiene que poder leer su perfil para saber que está desactivado)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname, cmd FROM pg_policies
           WHERE schemaname = 'public' AND roles = '{authenticated}' AND tablename NOT IN ('user_profiles', 'audit_log')
             AND qual = 'true'
  LOOP
    IF p.cmd IN ('ALL', 'UPDATE') THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING ((SELECT public.usuario_activo())) WITH CHECK ((SELECT public.usuario_activo()))', p.policyname, p.tablename);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I USING ((SELECT public.usuario_activo()))', p.policyname, p.tablename);
    END IF;
  END LOOP;
END $$;

-- 4) Historial: solo leer e insertar (nadie lo modifica ni lo borra)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'audit_log' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.audit_log', p.policyname);
  END LOOP;
END $$;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Historial: leer" ON public.audit_log FOR SELECT TO authenticated USING ((SELECT public.usuario_activo()));
CREATE POLICY "Historial: apuntar" ON public.audit_log FOR INSERT TO authenticated WITH CHECK ((SELECT public.usuario_activo()));

CREATE OR REPLACE FUNCTION public.auditar_cambios() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old jsonb; v_new jsonb; ant jsonb; nue jsonb; k text;
  uid uuid := auth.uid(); mail text; nom text;
BEGIN
  IF TG_OP <> 'INSERT' THEN v_old := to_jsonb(OLD); END IF;
  IF TG_OP <> 'DELETE' THEN v_new := to_jsonb(NEW); END IF;
  IF TG_OP = 'UPDATE' THEN
    ant := '{}'::jsonb; nue := '{}'::jsonb;
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      IF k NOT IN ('updated_at') AND (v_new -> k) IS DISTINCT FROM (v_old -> k) THEN
        ant := ant || jsonb_build_object(k, v_old -> k);
        nue := nue || jsonb_build_object(k, v_new -> k);
      END IF;
    END LOOP;
    IF nue = '{}'::jsonb THEN RETURN NEW; END IF;
  ELSIF TG_OP = 'INSERT' THEN nue := v_new;
  ELSE ant := v_old;
  END IF;
  IF uid IS NOT NULL THEN SELECT email, nombre INTO mail, nom FROM public.user_profiles WHERE id = uid; END IF;
  INSERT INTO public.audit_log (usuario_id, usuario_email, usuario_nombre, accion, tabla, registro_id, datos_anteriores, datos_nuevos)
  VALUES (uid, COALESCE(mail, CASE WHEN uid IS NULL THEN 'automático' END), COALESCE(nom, CASE WHEN uid IS NULL THEN 'Automático' END),
          CASE TG_OP WHEN 'INSERT' THEN 'CREAR' WHEN 'UPDATE' THEN 'ACTUALIZAR' ELSE 'ELIMINAR' END,
          TG_TABLE_NAME, COALESCE(v_new ->> 'id', v_old ->> 'id'), ant, nue);
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes', 'productos', 'tarifas_cliente', 'pedidos', 'pedidos_recurrentes', 'albaranes', 'facturas',
    'gastos', 'proveedores', 'compras_particulares', 'aportaciones_socios', 'reembolsos_socios', 'movimientos_banco', 'materiales',
    'compras_material', 'recuentos_material', 'lotes', 'mermas', 'variedades', 'user_profiles', 'asientos_contables']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_auditar ON public.%I', t);
      EXECUTE format('CREATE TRIGGER trg_auditar AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.auditar_cambios()', t);
    END IF;
  END LOOP;
END $$;

-- 5) Último acceso real de cada usuario
CREATE OR REPLACE FUNCTION public.usuarios_sistema()
RETURNS TABLE (id uuid, email text, ultimo_acceso timestamptz, alta timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.id, u.email::text, u.last_sign_in_at, u.created_at FROM auth.users u WHERE public.usuario_activo()
$$;
REVOKE ALL ON FUNCTION public.usuarios_sistema() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.usuarios_sistema() TO authenticated;

NOTIFY pgrst, 'reload schema';
SELECT 'V105 OK — ' || (SELECT count(*) FROM public.user_profiles) || ' perfiles, ' || (SELECT count(*) FROM public.user_profiles WHERE rol = 'admin') || ' admins' AS resultado;
