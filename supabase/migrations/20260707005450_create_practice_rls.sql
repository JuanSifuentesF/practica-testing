-- ============================================================
-- MIGRACIÓN: Row Level Security (RLS) para tablas del Practice Lab
-- Guía: PL-02
-- Descripción: Habilita RLS y crea políticas CRUD en
--              practice_exercises y practice_submissions
--              para aislar datos por usuario.
--
-- DIFERENCIA con DB-04:
--   Además del patrón básico (user_id = auth.uid()), esta
--   migración incluye VALIDACIONES DE OWNERSHIP CRUZADO:
--   - INSERT en practice_exercises valida que document_id
--     pertenezca al mismo usuario.
--   - INSERT en practice_exercises valida que study_plan_id
--     pertenezca al mismo usuario cuando viene informado.
--   - INSERT en practice_submissions valida que exercise_id
--     pertenezca al mismo usuario (vía subquery).
--
--   Estas validaciones se suman a la FK compuesta de PL-01
--   para crear una defensa en profundidad (defense-in-depth).
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- PASO 1: HABILITAR RLS EN LAS TABLAS DEL PRACTICE LAB
-- ══════════════════════════════════════════════════════════════
--
-- EFECTO INMEDIATO: una vez habilitado, si no existen políticas,
-- NINGÚN usuario puede leer ni escribir (excepto service_role).
-- Por eso las políticas se crean en la misma migración.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.practice_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_submissions ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- TABLA 7: practice_exercises
-- ══════════════════════════════════════════════════════════════
--
-- Columna de ownership: user_id
-- Patrón base: user_id = auth.uid()
--
-- PARTICULARIDAD DE ESTA TABLA:
--   El INSERT requiere validación adicional de document_id
--   y study_plan_id cuando viene informado.
--   No basta con que user_id = auth.uid(); también debemos
--   verificar que las referencias proporcionadas pertenecen
--   al mismo usuario. Sin esto, un usuario podría:
--     1. Obtener el document_id de otro usuario (ej. por URL)
--     2. Obtener el study_plan_id de otro usuario (ej. por logs)
--     3. Crear ejercicios vinculados a datos ajenos
--     4. Potencialmente acceder a tópicos privados
--
-- Operaciones permitidas:
--   SELECT: ver solo tus ejercicios
--   INSERT: crear ejercicios solo con TUS documentos y, si aplica, TUS planes
--   UPDATE: NO se permite (los ejercicios son generados por IA
--           y no deben ser modificados por el usuario)
--   DELETE: eliminar solo tus ejercicios
-- ══════════════════════════════════════════════════════════════

-- SELECT: un usuario solo puede ver sus propios ejercicios.
-- Caso de uso: el Hub de prácticas (/practice) lista los ejercicios
-- disponibles agrupados por tópico y tipo.
CREATE POLICY "practice_exercises_select_own"
  ON public.practice_exercises
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: un usuario solo puede crear ejercicios a su nombre.
-- Además, el document_id debe pertenecer al mismo usuario y,
-- si study_plan_id viene informado, también debe ser suyo.
--
-- ¿Por qué validar document_id?
--   La tabla practice_exercises tiene una FK a documents(id),
--   pero esa FK solo verifica que el documento EXISTE, no que
--   pertenezca al usuario que crea el ejercicio.
--   Sin esta validación RLS, un usuario malicioso podría:
--     INSERT INTO practice_exercises (user_id, document_id, ...)
--     VALUES (su_uid, documento_de_otro_usuario, ...)
--   Y el FK no lo bloquearía porque el documento sí existe.
--
-- La subquery EXISTS verifica ownership del documento:
--   "¿Hay un documento con este ID donde user_id = yo?"
--   Si no existe → PostgreSQL rechaza el INSERT.
--
-- ¿Por qué validar study_plan_id si es opcional?
--   Porque una FK solo verifica que el plan EXISTE, no que
--   pertenece al usuario que crea el ejercicio. Si un usuario
--   conoce el UUID de un plan ajeno, podría vincular su práctica
--   a ese plan si no validamos ownership explícitamente.
--   Permitimos NULL, pero si viene informado exigimos:
--     study_plans.id = study_plan_id AND study_plans.user_id = auth.uid()
CREATE POLICY "practice_exercises_insert_own"
  ON public.practice_exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM public.documents
      WHERE id = document_id
      AND user_id = auth.uid()
    )
    AND
    (
      study_plan_id IS NULL
      OR
      EXISTS (
        SELECT 1 FROM public.study_plans
        WHERE id = study_plan_id
        AND user_id = auth.uid()
      )
    )
  );

-- UPDATE: NO se crea política de actualización.
-- ¿Por qué?
--   Los ejercicios son generados por la IA (Gemini) y su contenido
--   es inmutable una vez creado. Si el usuario quiere un ejercicio
--   diferente, genera uno nuevo (attempt_number se incrementa).
--   Permitir UPDATE podría:
--     1. Modificar el scenario_json (alterar la pregunta)
--     2. Modificar la solution_json (ver la respuesta antes de intentar)
--   Ambos escenarios comprometen la integridad del ejercicio.
--
--   Sin política de UPDATE, esta operación está BLOQUEADA
--   por RLS para todos los usuarios autenticados.

-- DELETE: un usuario solo puede eliminar sus propios ejercicios.
-- Caso de uso: el usuario quiere limpiar ejercicios antiguos o
-- reiniciar su práctica para un tópico específico.
-- Las submissions asociadas se borran por CASCADE (FK de PL-01).
CREATE POLICY "practice_exercises_delete_own"
  ON public.practice_exercises
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════
-- TABLA 8: practice_submissions
-- ══════════════════════════════════════════════════════════════
--
-- Columna de ownership: user_id
-- Patrón base: user_id = auth.uid()
--
-- PARTICULARIDAD DE ESTA TABLA:
--   El INSERT requiere validación de que exercise_id
--   pertenece al mismo usuario. Esto se suma a la FK
--   compuesta (exercise_id, user_id) de PL-01.
--
--   ¿Por qué ambos mecanismos?
--     - FK compuesta: protege a nivel de integridad referencial.
--       Si RLS se desactiva (ej. service_role), la FK sigue ahí.
--     - RLS policy: protege a nivel de acceso.
--       Funciona incluso si alguien modifica el frontend.
--     → Defensa en profundidad: dos capas independientes.
--
-- Operaciones permitidas:
--   SELECT: ver solo tus submissions
--   INSERT: crear submissions solo para TUS ejercicios
--   UPDATE: actualizar solo tus submissions (score y feedback)
--   DELETE: eliminar solo tus submissions
-- ══════════════════════════════════════════════════════════════

-- SELECT: un usuario solo puede ver sus propias submissions.
-- Caso de uso: el FeedbackPanel de práctica (PL-10) muestra
-- el score, los criterios evaluados y la comparación con la
-- solución de referencia.
CREATE POLICY "practice_submissions_select_own"
  ON public.practice_submissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT: un usuario solo puede crear submissions a su nombre
-- Y el exercise_id debe pertenecer al mismo usuario.
--
-- ¿Por qué validar exercise_id vía RLS además de la FK compuesta?
--   La FK compuesta ya garantiza coherencia de ownership,
--   pero RLS agrega una capa visible y auditable.
--   Si en el futuro alguien modifica la FK o agrega un nuevo
--   camino de inserción (ej. función PL/pgSQL con SECURITY DEFINER),
--   la policy RLS sigue protegiendo.
--
-- La subquery EXISTS verifica ownership del ejercicio:
--   "¿Hay un exercise con este ID donde user_id = yo?"
CREATE POLICY "practice_submissions_insert_own"
  ON public.practice_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM public.practice_exercises
      WHERE id = exercise_id
      AND user_id = auth.uid()
    )
  );

-- UPDATE: un usuario solo puede actualizar sus propias submissions.
-- Caso de uso: la API Route /api/practice/evaluate (PL-09)
-- actualiza score_percent y feedback_json después de que la IA
-- evalúa la respuesta del usuario.
--
-- ¿Por qué SÍ se permite UPDATE aquí pero NO en exercises?
--   Las submissions se crean primero con score_percent = NULL
--   y feedback_json = NULL. Luego, la evaluación llena esos campos.
--   Es un patrón de "crear → evaluar → actualizar con resultado".
--   En cambio, los exercises se generan completos por la IA.
CREATE POLICY "practice_submissions_update_own"
  ON public.practice_submissions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: un usuario solo puede eliminar sus propias submissions.
-- Caso de uso: el usuario quiere reintentar un ejercicio desde cero,
-- borrando intentos anteriores. También útil para limpiar datos
-- de práctica al reiniciar.
CREATE POLICY "practice_submissions_delete_own"
  ON public.practice_submissions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());