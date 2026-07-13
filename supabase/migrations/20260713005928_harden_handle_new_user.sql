-- Endurece el trigger histórico de DB-05 sin cambiar su contrato:
-- crea un perfil al insertar un usuario en auth.users.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name'
  );

  RETURN NEW;
END;
$$;

-- Las funciones reciben EXECUTE para PUBLIC por defecto. Este trigger no es
-- una API RPC; solo Supabase Auth debe poder ejecutarlo en el flujo interno.
REVOKE EXECUTE ON FUNCTION public.handle_new_user()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user()
  TO supabase_auth_admin;
