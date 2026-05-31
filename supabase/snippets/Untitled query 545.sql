select id, email from auth.users LIMIT 1;

-- Este INSERT debe FALLAR porque 'paused' no es un status válido.
INSERT INTO public.study_plans (user_id, document_id, start_date, estimated_end_date, plan_json, status)
VALUES (
  'e1f92162-5f1f-4546-9397-d6fcd89b7b59',  -- Usa un user_id real aquí
  gen_random_uuid(),
  CURRENT_DATE,
  CURRENT_DATE + 7,
  '{"sessions": []}',
  'paused'  -- ← ESTADO INVÁLIDO: esto debe ser rechazado
);

-- Este INSERT debe FALLAR porque 150 está fuera del rango [0, 100].
INSERT INTO public.sessions (study_plan_id, user_id, topic_codes, session_type, day_number, score_percent)
VALUES (
  gen_random_uuid(),
  'e1f92162-5f1f-4546-9397-d6fcd89b7b59',
  ARRAY['FL-1.1.1'],
  'morning',
  1,
  150  -- ← SCORE INVÁLIDO: fuera de rango [0, 100]
);

-- Este INSERT debe FALLAR porque 'e' no es una opción válida.
INSERT INTO public.answers (session_id, user_id, question_text, options_json, correct_answer, user_answer, is_correct, topic_code)
VALUES (
  gen_random_uuid(),
  'e1f92162-5f1f-4546-9397-d6fcd89b7b59',
  'Pregunta de prueba',
  '{"a": "opción A", "b": "opción B", "c": "opción C", "d": "opción D"}',
  'a',
  'e',  -- ← RESPUESTA INVÁLIDA: solo se acepta a, b, c, d
  false,
  'FL-1.1.1'
);

-- Este INSERT debe FALLAR porque 'completed' no es un status válido para topic_progress.
INSERT INTO public.topic_progress (user_id, study_plan_id, topic_code, status)
VALUES (
  'e1f92162-5f1f-4546-9397-d6fcd89b7b59',
  gen_random_uuid(),
  'FL-1.1.1',
  'completed'  -- ← ESTADO INVÁLIDO: debería ser 'mastered', no 'completed'
);

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;