-- ============================================================
-- MIGRACIÓN: Tablas del QA Practice Lab
-- Guía: PL-01
-- Descripción: Crea las tablas practice_exercises y
--              practice_submissions para ejercicios prácticos
--              de testing (casos de prueba, bug reports, etc.).
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- TABLA 7: practice_exercises
-- Propósito: Almacena los ejercicios prácticos generados por la IA
--            para cada tópico ISTQB. Cada ejercicio incluye un
--            escenario, una tarea, y una solución de referencia.
--
-- ¿Por qué JSONB para scenario_json y solution_json?
--   Los ejercicios tienen estructuras variables según el tipo:
--   - test_cases: { scenario, input_range, expected_partitions }
--   - bug_report: { user_story, business_rule, observed_bug }
--   - api_testing: { endpoint, validations[], expected_responses }
--   - exploratory: { charter, scope, heuristics[] }
--   JSONB permite almacenar cualquiera de estas estructuras
--   sin necesidad de tablas separadas para cada tipo.
--
-- ¿Por qué document_id?
--   Un usuario podría subir múltiples PDFs (ej. ISTQB CTFL v4.0
--   y luego ISTQB CTAL). Sin document_id, los ejercicios de
--   FL-4.2.1 de un PDF se mezclarían con los del otro.
--   document_id permite filtrar prácticas por certificación.
--
-- ¿Por qué study_plan_id es opcional (nullable)?
--   El usuario puede practicar sin tener un plan activo.
--   Por ejemplo, si ya completó su plan pero quiere seguir
--   practicando tópicos débiles. Cuando SÍ hay plan activo,
--   este vínculo permite correlacionar prácticas con sesiones.
--
-- CONSTRAINTS DE NEGOCIO:
--   - exercise_type: solo 4 tipos válidos
--   - level_k: solo K1, K2 o K3
--   - attempt_number: >= 1 (primer intento = 1)
--
-- CONSTRAINT DE OWNERSHIP CRUZADO:
--   UNIQUE (id, user_id) permite que practice_submissions
--   use una FK compuesta (exercise_id, user_id) apuntando aquí.
--   Esto garantiza a nivel de DB que un usuario NO pueda crear
--   submissions para ejercicios de otro usuario, incluso si
--   RLS falla o se desactiva temporalmente.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.practice_exercises (
  -- Identificador único generado automáticamente.
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ¿De quién es este ejercicio?
  -- ON DELETE CASCADE: si se borra el usuario, se borran sus ejercicios.
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ¿De qué documento/PDF provienen los tópicos?
  -- ON DELETE CASCADE: si se borra el documento, se borran sus ejercicios.
  -- Esto vincula la práctica con la certificación específica
  -- (ej. ISTQB CTFL v4.0) y evita ambigüedad entre PDFs con
  -- códigos de tópico similares.
  document_id     UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,

  -- ¿A qué plan de estudio pertenece esta práctica? (OPCIONAL)
  -- NULL si el usuario practica sin plan activo.
  -- ON DELETE SET NULL: si se borra el plan, la práctica queda
  -- huérfana pero no se pierde — el usuario puede seguir viéndola.
  study_plan_id   UUID REFERENCES public.study_plans(id) ON DELETE SET NULL,

  -- Código del tópico ISTQB asociado (ej. "FL-4.2.1").
  -- Permite agrupar ejercicios por tópico y vincularlos con topic_progress.
  topic_code      TEXT NOT NULL,

  -- Nivel cognitivo del ejercicio (K1=recordar, K2=comprender, K3=aplicar).
  -- Determina la complejidad y tipo de tarea generada.
  level_k         TEXT NOT NULL,

  -- Tipo de ejercicio práctico.
  -- Cada tipo tiene una estructura de escenario y evaluación diferente.
  exercise_type   TEXT NOT NULL,

  -- Número de intento/generación para este tópico+tipo.
  -- Primer ejercicio = 1, segundo = 2, etc.
  -- Permite rastrear cuántas veces se ha generado un ejercicio
  -- para el mismo tópico, y al prompt de IA le sirve para
  -- producir escenarios diferentes en cada regeneración.
  attempt_number  INTEGER NOT NULL DEFAULT 1,

  -- Escenario y tarea del ejercicio en formato JSONB.
  -- Generado por la IA (Gemini) a partir del tópico y nivel K.
  -- Estructura típica:
  --   {
  --     "scenario": "Una app permite registrar usuarios de 18 a 65 años.",
  --     "task_description": "Define particiones válidas e inválidas.",
  --     "constraints": ["Mínimo 5 casos de prueba", "Incluir positivos y negativos"],
  --     "evaluation_criteria": ["Cobertura de particiones", "Valores límite"]
  --   }
  scenario_json   JSONB NOT NULL,

  -- Solución de referencia generada por la IA.
  -- Se muestra al usuario DESPUÉS de enviar su respuesta.
  -- NULL si la solución aún no ha sido generada.
  -- Estructura típica:
  --   {
  --     "model_test_cases": [...],
  --     "explanation": "Se identificaron 3 particiones: ...",
  --     "key_points": ["Valor límite inferior: 18", "Valor límite superior: 65"]
  --   }
  solution_json   JSONB,

  -- Fecha de creación del ejercicio.
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- ═══════════════════════════════════════════════════════════
  -- CONSTRAINTS (Reglas de negocio grabadas en piedra):
  -- ═══════════════════════════════════════════════════════════

  -- Regla 1: Solo 4 tipos de ejercicio válidos.
  -- ¿Por qué? Cada tipo tiene un flujo de UI y evaluación diferente.
  -- Si el frontend envía un tipo inventado, PostgreSQL lo rechaza.
  CONSTRAINT practice_exercises_type_chk
    CHECK (exercise_type IN ('test_cases', 'bug_report', 'api_testing', 'exploratory')),

  -- Regla 2: Solo niveles K válidos del ISTQB.
  -- Coherente con el constraint de topic_progress y answers.
  CONSTRAINT practice_exercises_level_k_chk
    CHECK (level_k IN ('K1', 'K2', 'K3')),

  -- Regla 3: El número de intento siempre es >= 1.
  -- Evita valores absurdos como 0 o negativos.
  CONSTRAINT practice_exercises_attempt_chk
    CHECK (attempt_number >= 1)
);

-- ═══════════════════════════════════════════════════════════
-- CONSTRAINT ÚNICO PARA OWNERSHIP CRUZADO
-- ═══════════════════════════════════════════════════════════
-- ¿Por qué UNIQUE (id, user_id) si id ya es PRIMARY KEY?
--
-- Porque la tabla practice_submissions necesita una FK COMPUESTA
-- (exercise_id, user_id) que apunte aquí. PostgreSQL requiere
-- que el target de una FK compuesta tenga un UNIQUE o PK
-- sobre esas mismas columnas.
--
-- Esto garantiza que un usuario NO pueda crear submissions
-- para ejercicios de otro usuario, incluso sin RLS.
-- Es una defensa en profundidad (defense-in-depth).
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.practice_exercises
  ADD CONSTRAINT practice_exercises_id_user_unique
  UNIQUE (id, user_id);

-- Documentación de la tabla para Supabase Studio.
COMMENT ON TABLE public.practice_exercises IS
  'Ejercicios prácticos de QA generados por IA, vinculados a tópicos ISTQB por código FL-x.x.x y documento fuente.';

-- ──────────────────────────────────────────────────────────────
-- TABLA 8: practice_submissions
-- Propósito: Almacena cada intento de respuesta del usuario a un
--            ejercicio práctico. Incluye lo que escribió, el score
--            obtenido, y el feedback detallado de la IA.
--
-- RELACIÓN CON practice_exercises:
--   Cada submission pertenece a UN ejercicio (FK exercise_id).
--   Un ejercicio puede tener MÚLTIPLES submissions (reintentos).
--   ON DELETE CASCADE: si se borra el ejercicio, se borran sus submissions.
--
-- FK COMPUESTA (exercise_id, user_id):
--   ¿Por qué no solo exercise_id?
--   Porque con una FK simple, un usuario malicioso podría
--   insertar una submission con el exercise_id de OTRO usuario.
--   RLS lo bloquearía normalmente, pero si RLS se desactiva
--   (ej. por error del admin, o en un test), la FK compuesta
--   sigue protegiendo la integridad.
--   Es como tener DOS cerraduras en tu puerta:
--   - RLS = cerradura principal (software)
--   - FK compuesta = cerrojo físico (hardware/DB)
--
-- ¿Por qué JSONB para submission_json y feedback_json?
--   - submission_json: contiene la tabla de test cases que el usuario
--     redactó, o el bug report completo. La estructura varía según
--     exercise_type del ejercicio padre.
--   - feedback_json: contiene el análisis detallado de la IA con
--     criterios evaluados, casos faltantes, fortalezas y mejoras.
--     Estructura variable según el tipo de evaluación.
--
-- CONSTRAINTS DE NEGOCIO:
--   - score_percent: NULL (aún no evaluado) o entre 0 y 100
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.practice_submissions (
  -- Identificador único generado automáticamente.
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ¿Quién envió esta respuesta?
  -- ON DELETE CASCADE: si se borra el usuario, se borran sus submissions.
  -- Desnormalizado desde practice_exercises.user_id para:
  --   1. RLS directo sin necesidad de JOINs (mismo patrón que sessions.user_id)
  --   2. FK compuesta que protege ownership cruzado (ver abajo)
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ¿A qué ejercicio responde?
  -- NOTA: exercise_id NO tiene FK simple aquí.
  -- La FK real es COMPUESTA y se define con ALTER TABLE más abajo.
  exercise_id     UUID NOT NULL,

  -- Lo que el usuario escribió/redactó en formato JSONB.
  -- Para test_cases:
  --   {
  --     "test_cases": [
  --       { "id": "TC-001", "scenario": "Edad mínima válida", "test_data": "18",
  --         "expected_result": "Registro permitido", "type": "positive" },
  --       ...
  --     ]
  --   }
  -- Para bug_report:
  --   {
  --     "title": "Campo edad acepta valores menores a 18",
  --     "preconditions": "Usuario en página de registro",
  --     "steps": ["1. Ingresar edad 17", "2. Click en Registrar"],
  --     "actual_result": "El sistema permite el registro",
  --     "expected_result": "El sistema muestra error de validación",
  --     "severity": "high",
  --     "priority": "medium"
  --   }
  submission_json JSONB NOT NULL,

  -- Score obtenido en la evaluación (0-100).
  -- NULL si la submission aún no ha sido evaluada por la IA.
  score_percent   NUMERIC(5,2),

  -- Feedback detallado de la IA en formato JSONB.
  -- NULL si aún no se ha evaluado.
  -- Estructura típica:
  --   {
  --     "feedback_summary": "Buena cobertura pero faltaron valores límite.",
  --     "criteria_results": [
  --       { "criterion": "Cobertura de particiones", "passed": true, "detail": "..." },
  --       { "criterion": "Valores límite", "passed": false, "detail": "Faltó 17 y 66" }
  --     ],
  --     "missing_cases": ["Valor límite inferior -1 (17)", "Texto no numérico"],
  --     "strengths": ["Buenos nombres de escenario", "Tipos bien clasificados"],
  --     "improvements": ["Agregar caso de valor no numérico", "Considerar campo vacío"],
  --     "model_answer": { ... }
  --   }
  feedback_json   JSONB,

  -- Fecha y hora en que el usuario envió su respuesta.
  submitted_at    TIMESTAMPTZ DEFAULT NOW(),

  -- ═══════════════════════════════════════════════════════════
  -- CONSTRAINTS:
  -- ═══════════════════════════════════════════════════════════

  -- Regla: El score puede ser NULL (no evaluado aún)
  -- pero si existe, debe estar entre 0 y 100.
  -- Coherente con sessions.score_percent y topic_progress.best_score.
  CONSTRAINT practice_submissions_score_chk
    CHECK (score_percent IS NULL OR score_percent BETWEEN 0 AND 100)
);

-- ═══════════════════════════════════════════════════════════
-- FK COMPUESTA: PROTECCIÓN DE OWNERSHIP CRUZADO
-- ═══════════════════════════════════════════════════════════
-- Esta FK apunta al UNIQUE (id, user_id) de practice_exercises.
-- PostgreSQL garantiza que:
--   1. El exercise_id existe en practice_exercises
--   2. El user_id de la submission coincide con el user_id
--      del ejercicio padre
--
-- Si un usuario intenta insertar una submission con un
-- exercise_id que pertenece a otro usuario, PostgreSQL
-- rechaza el INSERT con un error de FK violation.
--
-- ON DELETE CASCADE: si se borra el ejercicio, las
-- submissions se borran automáticamente.
-- ═══════════════════════════════════════════════════════════
ALTER TABLE public.practice_submissions
  ADD CONSTRAINT practice_submissions_exercise_user_fk
  FOREIGN KEY (exercise_id, user_id)
  REFERENCES public.practice_exercises(id, user_id)
  ON DELETE CASCADE;

-- Documentación de la tabla para Supabase Studio.
COMMENT ON TABLE public.practice_submissions IS
  'Respuestas del usuario a ejercicios prácticos, con score y feedback de la IA. FK compuesta protege ownership.';

-- ══════════════════════════════════════════════════════════════
-- ÍNDICES DE PERFORMANCE — PRACTICE LAB
-- ══════════════════════════════════════════════════════════════
-- Estos índices optimizan las consultas más frecuentes del
-- Practice Lab. Siguen el mismo patrón de nomenclatura que
-- los índices de DB-02 (idx_tabla_columnas).
-- ══════════════════════════════════════════════════════════════

-- Índice 5: Buscar ejercicios de un usuario por tópico.
-- Caso de uso: "Dame todos los ejercicios del usuario X para FL-4.2.1"
-- Consulta típica:
--   SELECT * FROM practice_exercises
--   WHERE user_id = $1 AND topic_code = $2
-- Este es el query más frecuente: cuando el usuario entra a
-- /practice/FL-4.2.1, necesitamos cargar sus ejercicios previos.
CREATE INDEX idx_practice_exercises_user_topic
  ON public.practice_exercises(user_id, topic_code);

-- Índice 6: Buscar ejercicios de un usuario por tipo.
-- Caso de uso: "Cuántos ejercicios de tipo bug_report tiene el usuario X"
-- Consulta típica:
--   SELECT COUNT(*) FROM practice_exercises
--   WHERE user_id = $1 AND exercise_type = $2
-- Usado por el Hub de prácticas (/practice) para los contadores.
CREATE INDEX idx_practice_exercises_user_type
  ON public.practice_exercises(user_id, exercise_type);

-- Índice 7: Buscar ejercicios por documento.
-- Caso de uso: "Dame todos los ejercicios del documento X"
-- Consulta típica:
--   SELECT * FROM practice_exercises
--   WHERE document_id = $1
-- Necesario para filtrar prácticas por PDF/certificación.
-- También útil para ON DELETE CASCADE performance.
CREATE INDEX idx_practice_exercises_document
  ON public.practice_exercises(document_id);

-- Índice 8: Buscar submissions por ejercicio.
-- Caso de uso: "Dame todos los intentos del ejercicio X"
-- Consulta típica:
--   SELECT * FROM practice_submissions
--   WHERE exercise_id = $1 ORDER BY submitted_at DESC
-- Necesario para mostrar el historial de intentos de un ejercicio.
CREATE INDEX idx_practice_submissions_exercise
  ON public.practice_submissions(exercise_id);

-- Índice 9: Buscar submissions de un usuario (para Dashboard).
-- Caso de uso: "Score promedio de práctica del usuario X"
-- Consulta típica:
--   SELECT AVG(score_percent) FROM practice_submissions
--   WHERE user_id = $1 AND score_percent IS NOT NULL
-- Usado por /api/dashboard/metrics para las métricas de práctica (PL-13).
CREATE INDEX idx_practice_submissions_user
  ON public.practice_submissions(user_id);