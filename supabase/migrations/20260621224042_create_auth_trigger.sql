-- ============================================================
-- MIGRACIÓN: Creación de Función y Trigger para Perfiles
-- Guía: DB-05
-- Descripción: Crea una función que inserta automáticamente en
--              public.user_profiles cuando un nuevo usuario se
--              registra en auth.users.
-- ============================================================

-- 1. Crear la función del Trigger en PL/pgSQL
-- SECURITY DEFINER asegura que la función tenga permisos para
-- bypassear el RLS (necesario ya que el usuario aún no está del
-- todo autenticado cuando se ejecuta).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id, full_name)
  VALUES (
    new.id,
    -- Extraemos el 'full_name' si se proporciona en los raw_user_meta_data
    -- durante el registro en el frontend. Si no, quedará nulo.
    new.raw_user_meta_data->>'full_name'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Crear el Trigger
-- Se ejecutará DESPUÉS (AFTER) de cada INSERT en el esquema auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Comentario de documentación
COMMENT ON FUNCTION public.handle_new_user IS 'Trigger automático: crea un perfil público al registrarse un usuario.';