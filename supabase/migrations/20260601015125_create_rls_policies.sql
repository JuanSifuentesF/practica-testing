-- ============================================================
-- MIGRACIÓN: Row Level Security (RLS) para todas las tablas
-- Guía: DB-04
-- Descripción: Habilita RLS y crea políticas CRUD (SELECT,
--              INSERT, UPDATE, DELETE) en las 6 tablas del
--              esquema público para aislar datos por usuario.
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- PASO 1: HABILITAR RLS EN TODAS LAS TABLAS PÚBLICAS
-- ══════════════════════════════════════════════════════════════
--
-- ALTER TABLE ... ENABLE ROW LEVEL SECURITY activa el motor
-- de evaluación de políticas para cada tabla.
--
-- EFECTO INMEDIATO: una vez habilitado, si no existen políticas
-- definidas, NINGÚN usuario puede leer ni escribir en la tabla
-- (excepto el superuser de PostgreSQL y el rol service_role).
--
-- Por eso definimos las políticas en los pasos siguientes
-- DENTRO DE LA MISMA MIGRACIÓN: habilitar RLS y crear políticas
-- ocurre en una sola transacción atómica.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_progress ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- TABLA 1: user_profiles
-- ══════════════════════════════════════════════════════════════
--
-- Particularidad: la columna `id` ES el UUID del usuario
-- (referencia directa a auth.users(id)), no hay columna
-- `user_id` separada. La política compara id = auth.uid().
--
-- Operaciones permitidas:
--   SELECT: ver solo tu propio perfil
--   INSERT: crear solo tu propio perfil (al registrarte)
--   UPDATE: modificar solo tu propio perfil
--   DELETE: no se permite (el perfil se borra vía CASCADE
--           cuando se elimina el usuario de auth.users)
-- ══════════════════════════════════════════════════════════════

-- SELECT: un usuario solo puede leer su propio perfil.
-- Caso de uso: el frontend muestra el nombre del usuario logueado.
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- INSERT: un usuario solo puede crear su propio perfil.
-- Caso de uso: el trigger de DB-05 (Supabase Auth) insertará
-- automáticamente una fila cuando un usuario se registre.
-- La política garantiza que nadie puede crear un perfil con
-- un ID que no sea el suyo.
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- UPDATE: un usuario solo puede actualizar su propio perfil.
-- Caso de uso: el usuario cambia su nombre completo.
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- DELETE: NO se crea política de borrado.
-- ¿Por qué? El perfil se elimina automáticamente vía
-- ON DELETE CASCADE cuando se borra el usuario de auth.users.
-- No queremos que un usuario pueda borrar su perfil desde el
-- frontend y quedar en un estado inconsistente (usuario de Auth
-- sin perfil en la base de datos).

-- ══════════════════════════════════════════════════════════════
-- TABLA 2: documents
-- ══════════════════════════════════════════════════════════════
--
-- Columna de ownership: user_id
-- Patrón: user_id = auth.uid()
--
-- Operaciones permitidas:
--   SELECT: ver solo tus documentos
--   INSERT: crear documentos solo a tu nombre
--   UPDATE: actualizar solo tus documentos (ej. topics_json)
--   DELETE: eliminar solo tus documentos
-- ══════════════════════════════════════════════════════════════

-- SELECT: un usuario solo puede ver sus propios documentos.
-- Caso de uso: listar los PDFs subidos por el usuario en el dashboard.
CREATE POLICY "documents_select_own"
  ON public.documents
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: un usuario solo puede crear documentos a su nombre.
-- Caso de uso: la API Route /api/upload registra un nuevo PDF.
-- WITH CHECK garantiza que el user_id del INSERT coincide con
-- el usuario autenticado — evita que un frontend manipulado
-- inserte documentos con el user_id de otro usuario.
CREATE POLICY "documents_insert_own"
  ON public.documents
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: un usuario solo puede actualizar sus propios documentos.
-- Caso de uso: después de la extracción, se actualiza el campo
-- extracted_text y topics_json con los resultados de FastAPI.
CREATE POLICY "documents_update_own"
  ON public.documents
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: un usuario solo puede eliminar sus propios documentos.
-- Caso de uso: el usuario decide reemplazar un PDF incorrecto.
CREATE POLICY "documents_delete_own"
  ON public.documents
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

  -- ══════════════════════════════════════════════════════════════
-- TABLA 3: study_plans
-- ══════════════════════════════════════════════════════════════
--
-- Columna de ownership: user_id
-- Patrón: user_id = auth.uid()
--
-- Operaciones permitidas:
--   SELECT: ver solo tus planes de estudio
--   INSERT: crear planes solo a tu nombre
--   UPDATE: actualizar solo tus planes (ej. status, end_date)
--   DELETE: eliminar solo tus planes (abandono del plan)
-- ══════════════════════════════════════════════════════════════

-- SELECT: un usuario solo puede ver sus propios planes.
-- Caso de uso: el dashboard muestra el plan activo del usuario.
CREATE POLICY "study_plans_select_own"
  ON public.study_plans
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: un usuario solo puede crear planes a su nombre.
-- Caso de uso: la generación del plan por OpenAI (guía UP-04)
-- inserta un nuevo registro con el user_id del solicitante.
CREATE POLICY "study_plans_insert_own"
  ON public.study_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: un usuario solo puede actualizar sus propios planes.
-- Caso de uso: el sistema adaptativo (guía SE-07) actualiza
-- estimated_end_date, actual_end_date y status cuando el plan
-- se completa, reestructura o abandona.
CREATE POLICY "study_plans_update_own"
  ON public.study_plans
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: un usuario solo puede eliminar sus propios planes.
-- Caso de uso: el usuario decide abandonar un plan y empezar
-- de cero. En la práctica, preferimos cambiar el status a
-- 'abandoned' en vez de borrar, pero la política existe por
-- completitud y seguridad.
CREATE POLICY "study_plans_delete_own"
  ON public.study_plans
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

  -- ══════════════════════════════════════════════════════════════
-- TABLA 4: sessions
-- ══════════════════════════════════════════════════════════════
--
-- Columna de ownership: user_id (desnormalizada desde study_plans)
-- Patrón: user_id = auth.uid()
--
-- Nota: user_id fue deliberadamente desnormalizada en DB-02
-- para evitar JOINs costosos en las políticas RLS. Sin esta
-- desnormalización, PostgreSQL tendría que hacer un JOIN con
-- study_plans en CADA consulta para verificar el ownership.
--
-- Operaciones permitidas:
--   SELECT: ver solo tus sesiones
--   INSERT: crear sesiones solo a tu nombre
--   UPDATE: actualizar solo tus sesiones (score, status, etc.)
--   DELETE: eliminar solo tus sesiones
-- ══════════════════════════════════════════════════════════════

-- SELECT: un usuario solo puede ver sus propias sesiones.
-- Caso de uso: el endpoint /api/sessions/next busca la próxima
-- sesión pendiente del usuario para continuar su estudio.
CREATE POLICY "sessions_select_own"
  ON public.sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: un usuario solo puede crear sesiones a su nombre.
-- Caso de uso: al generar el plan (UP-05), se insertan las 14
-- sesiones iniciales. El sistema adaptativo (SE-07) puede
-- insertar sesiones adicionales de refuerzo.
CREATE POLICY "sessions_insert_own"
  ON public.sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: un usuario solo puede actualizar sus propias sesiones.
-- Caso de uso: al completar un quiz, se actualiza score_percent,
-- action_taken, completed_at y status de la sesión.
CREATE POLICY "sessions_update_own"
  ON public.sessions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: un usuario solo puede eliminar sus propias sesiones.
-- Caso de uso: el sistema adaptativo puede necesitar eliminar
-- sesiones futuras al reestructurar un plan.
CREATE POLICY "sessions_delete_own"
  ON public.sessions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

  -- ══════════════════════════════════════════════════════════════
-- TABLA 5: answers
-- ══════════════════════════════════════════════════════════════
--
-- Columna de ownership: user_id (desnormalizada desde sessions)
-- Patrón: user_id = auth.uid()
--
-- Operaciones permitidas:
--   SELECT: ver solo tus respuestas
--   INSERT: crear respuestas solo a tu nombre
--   UPDATE: NO se permite (las respuestas son inmutables)
--   DELETE: NO se permite (preservar historial de aprendizaje)
-- ══════════════════════════════════════════════════════════════

-- SELECT: un usuario solo puede ver sus propias respuestas.
-- Caso de uso: el FeedbackPanel (SE-08) muestra las preguntas
-- fallidas con su explicación. El dashboard analiza patrones
-- de error por tópico y nivel K.
CREATE POLICY "answers_select_own"
  ON public.answers
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: un usuario solo puede insertar respuestas a su nombre.
-- Caso de uso: al enviar el quiz completo (SE-06), el endpoint
-- /api/sessions/[id]/evaluate inserta una fila por cada respuesta.
CREATE POLICY "answers_insert_own"
  ON public.answers
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE y DELETE: NO se crean políticas.
-- ¿Por qué?
--   1. Las respuestas del quiz son INMUTABLES. Una vez enviadas,
--      no se pueden cambiar (sería como alterar un examen ya entregado).
--   2. El historial de respuestas alimenta el análisis de patrones
--      del sistema adaptativo. Eliminar respuestas corrompería
--      las métricas de progreso.
--   3. Sin política de UPDATE/DELETE, estas operaciones están
--      BLOQUEADAS por RLS para todos los usuarios autenticados.

-- ══════════════════════════════════════════════════════════════
-- TABLA 6: topic_progress
-- ══════════════════════════════════════════════════════════════
--
-- Columna de ownership: user_id
-- Patrón: user_id = auth.uid()
--
-- Operaciones permitidas:
--   SELECT: ver solo tu progreso
--   INSERT: crear registros de progreso solo a tu nombre
--   UPDATE: actualizar solo tu progreso (score, status, attempts)
--   DELETE: eliminar solo tu progreso (al abandonar un plan)
-- ══════════════════════════════════════════════════════════════

-- SELECT: un usuario solo puede ver su propio progreso.
-- Caso de uso: el dashboard (DA-02 a DA-05) muestra el heatmap
-- de tópicos, gráficas de score y la fecha estimada de examen.
CREATE POLICY "topic_progress_select_own"
  ON public.topic_progress
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: un usuario solo puede crear registros a su nombre.
-- Caso de uso: al guardar el plan en Supabase (UP-05), se
-- insertan 40 registros de progreso (uno por tópico ISTQB)
-- con status 'pending' y score 0.
CREATE POLICY "topic_progress_insert_own"
  ON public.topic_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: un usuario solo puede actualizar su propio progreso.
-- Caso de uso: el sistema adaptativo (SE-07) actualiza status
-- ('pending' → 'mastered' o 'failed'), best_score, last_score,
-- attempts y mastered_at después de cada evaluación.
CREATE POLICY "topic_progress_update_own"
  ON public.topic_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: un usuario solo puede eliminar su propio progreso.
-- Caso de uso: si un plan se elimina o reinicia, el progreso
-- asociado se puede limpiar. También cubierto por CASCADE
-- desde study_plans si se configura.
CREATE POLICY "topic_progress_delete_own"
  ON public.topic_progress
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());