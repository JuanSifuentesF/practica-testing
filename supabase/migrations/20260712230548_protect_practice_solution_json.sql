-- La solución de referencia se usa únicamente dentro de Route Handlers.
-- RLS limita filas, pero no columnas; por eso quitamos el SELECT global y
-- devolvemos al rol authenticated solo las columnas seguras para la UI.
REVOKE SELECT ON TABLE public.practice_exercises FROM anon, authenticated;

GRANT SELECT (
  id,
  user_id,
  document_id,
  study_plan_id,
  topic_code,
  level_k,
  exercise_type,
  attempt_number,
  scenario_json,
  created_at
) ON TABLE public.practice_exercises TO authenticated;

-- service_role conserva su privilegio de tabla y es el único camino usado
-- por /api/practice/evaluate para leer solution_json después de autenticar y
-- filtrar explícitamente por exercise_id + user_id.
