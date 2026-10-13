-- Sunny POS — convierte una cuenta ya creada en Authentication en la dueña (superadmin).
-- Uso: reemplazar CORREO_DE_LA_DUENA (una vez) y correr una vez.
-- Las demás personas se dan de alta después desde Configuración → Usuarios y Permisos.
BEGIN;

DO $$
DECLARE v_email text := lower('CORREO_DE_LA_DUENA');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RAISE EXCEPTION 'No existe la cuenta %: créala primero en Authentication → Users', v_email;
  END IF;

  -- El servidor toma el rol de config.user_permissions (fuente autoritativa)
  INSERT INTO public.config (id, value)
  VALUES ('user_permissions', jsonb_build_object(v_email, jsonb_build_object('role', 'superadmin'))::text)
  ON CONFLICT (id) DO UPDATE
    SET value = (public.config.value::jsonb || jsonb_build_object(v_email, jsonb_build_object('role', 'superadmin')))::text;

  -- Respaldo visual del cliente mientras carga get_my_permissions()
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"superadmin"}'::jsonb
  WHERE lower(email) = v_email;
END $$;

COMMIT;
