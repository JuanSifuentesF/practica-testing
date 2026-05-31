-- ============================================================
-- MIGRACIÓN: Schema completo del ISTQB Study Agent
-- Guía: DB-02
-- Descripción: Crea todas las tablas, relaciones, constraints
--              e índices del sistema.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- TABLA 1: user_profiles
-- Propósito: Extiende auth.users con datos de perfil del negocio.
--            Cada usuario de Supabase Auth tendrá exactamente
--            un registro aquí (relación 1:1).
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.user_profiles (
  -- Clave primaria que referencia directamente al ID del usuario
  -- en la tabla interna de Supabase Auth.
  -- ON DELETE CASCADE: si se borra el usuario de Auth, se borra el perfil.
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Nombre completo del usuario (opcional al registrarse)
  full_name TEXT,

  -- Fecha de creación automática del registro.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comentario de documentación de la tabla para Supabase Studio.
COMMENT ON TABLE public.user_profiles IS 'Perfil extendido de cada usuario registrado en Supabase Auth.';

-- ──────────────────────────────────────────────────────────────
-- TABLA 2: documents
-- Propósito: Registra cada PDF subido por un usuario.
--            Almacena el texto extraído y los tópicos detectados
--            como JSONB para consultas flexibles.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.documents (
  -- Identificador único generado automáticamente por PostgreSQL.
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ¿De quién es este documento?
  -- ON DELETE CASCADE: si se borra el usuario, se borran sus documentos.
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Nombre original del archivo subido (ej. "ISTQB_CTFL_v4.0.pdf").
  file_name       TEXT NOT NULL,

  -- Ruta interna en Supabase Storage (ej. "pdfs/{user_id}/timestamp_filename.pdf").
  file_url        TEXT NOT NULL,

  -- Texto crudo extraído del PDF por FastAPI/pdfplumber.
  -- Puede ser NULL si la extracción aún no ha ocurrido.
  extracted_text  TEXT,

  -- Tópicos estructurados detectados por el algoritmo de detección.
  -- Formato esperado: { "FL-1.1.1": { "text": "...", "level_k": "K1" }, ... }
  -- JSONB permite indexar y consultar dentro del JSON directamente en SQL.
  topics_json     JSONB,

  -- Fecha de creación automática.
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.documents IS
  'Metadatos de PDFs subidos por usuarios. El archivo físico reside en Supabase Storage.';

  -- ──────────────────────────────────────────────────────────────
-- TABLA 3: study_plans
-- Propósito: Almacena el plan de estudio generado por la IA.
--            Incluye el JSON completo del plan, fechas estimadas
--            y el estado del plan (activo, completado, abandonado).
--
-- CONSTRAINTS DE NEGOCIO:
--   - objective_days debe estar entre 1 y 30.
--   - status solo puede ser: 'active', 'completed', 'abandoned'.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.study_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Dueño del plan.
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ¿De qué documento PDF se generó este plan?
  document_id         UUID NOT NULL REFERENCES public.documents(id),

  -- Número de días objetivo definido por el usuario (default: 7).
  -- CHECK: no aceptamos valores menores a 1 ni mayores a 30.
  objective_days      INT DEFAULT 7,

  -- Fecha de inicio real del plan.
  start_date          DATE NOT NULL,

  -- Fecha estimada de finalización (se recalcula dinámicamente
  -- cuando el sistema adaptativo agrega sesiones de refuerzo).
  estimated_end_date  DATE NOT NULL,

  -- Fecha real en la que el usuario completó el plan (NULL si aún no termina).
  actual_end_date     DATE,

  -- JSON completo del plan con las 14 sesiones distribuidas por día.
  -- Este campo se actualiza cuando el sistema adaptativo reestructura el plan.
  plan_json           JSONB NOT NULL,

  -- Estado actual del plan de estudio.
  status              TEXT DEFAULT 'active',

  -- Timestamps de auditoría.
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),

  -- ═══════════════════════════════════════════════════════════
  -- CONSTRAINTS (Reglas de negocio grabadas en piedra):
  -- ═══════════════════════════════════════════════════════════

  -- Regla: los días objetivo deben ser un rango razonable (1-30).
  -- ¿Por qué? Un plan de 0 días no tiene sentido,
  -- y más de 30 días viola la filosofía "sprint intensivo".
  CONSTRAINT study_plans_objective_days_chk
    CHECK (objective_days BETWEEN 1 AND 30),

  -- Regla: el status solo puede ser uno de tres valores definidos.
  -- ¿Por qué? Evita que un bug del frontend inserte
  -- estados inventados como "paused" o "deleted".
  CONSTRAINT study_plans_status_chk
    CHECK (status IN ('active', 'completed', 'abandoned'))
);

COMMENT ON TABLE public.study_plans IS
  'Plan de estudio adaptativo generado por la IA, con fechas dinámicas y estado de progreso.';

  -- ──────────────────────────────────────────────────────────────
-- TABLA 4: sessions
-- Propósito: Cada sesión de estudio individual (mañana/noche/refuerzo).
--            Contiene los tópicos asignados, score, método de enseñanza
--            y la decisión adaptativa tomada por la IA.
--
-- CONSTRAINTS DE NEGOCIO (6 reglas):
--   - session_type: 'morning', 'night', 'reinforcement', 'mock_exam'
--   - method_used: 'theory', 'examples', 'analogies'
--   - action_taken: NULL (aún no evaluada) o 'advance'/'reinforce'/'restructure'
--   - status: 'pending', 'active', 'completed', 'skipped'
--   - duration_minutes > 0
--   - score_percent: NULL o entre 0 y 100
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ¿A qué plan pertenece esta sesión?
  study_plan_id     UUID NOT NULL REFERENCES public.study_plans(id) ON DELETE CASCADE,

  -- ¿De quién es la sesión? (redundante con study_plans.user_id
  -- pero necesario para RLS directo sin JOINs).
  user_id           UUID NOT NULL REFERENCES auth.users(id),

  -- Array de códigos de tópicos cubiertos en esta sesión.
  -- Ejemplo: ["FL-1.1.1", "FL-1.2.1"]
  -- PostgreSQL nativo soporta arrays como tipo de columna.
  topic_codes       TEXT[] NOT NULL,

  -- Tipo de sesión: mañana, noche, refuerzo, o simulacro final.
  session_type      TEXT NOT NULL,

  -- Número del día dentro del plan (1-30).
  day_number        INT NOT NULL,

  -- Fecha/hora programada para esta sesión.
  scheduled_at      TIMESTAMPTZ,

  -- Fecha/hora real en que el usuario inició la sesión.
  started_at        TIMESTAMPTZ,

  -- Fecha/hora real en que la sesión se completó.
  completed_at      TIMESTAMPTZ,

  -- Duración planificada en minutos (default: 90).
  duration_minutes  INT DEFAULT 90,

  -- Score obtenido en el quiz (NULL si aún no se ha evaluado).
  score_percent     NUMERIC(5,2),

  -- Número de intento para este grupo de tópicos (1 = primera vez).
  attempt_number    INT DEFAULT 1,

  -- Método de enseñanza usado en la teoría de esta sesión.
  method_used       TEXT DEFAULT 'theory',

  -- Decisión tomada por el sistema adaptativo tras evaluar el quiz.
  -- NULL si la sesión aún no ha sido evaluada.
  action_taken      TEXT,

  -- Estado actual de la sesión.
  status            TEXT DEFAULT 'pending',

  -- Contenido teórico generado por OpenAI para esta sesión.
  theory_content    TEXT,

  -- Fecha de creación del registro.
  created_at        TIMESTAMPTZ DEFAULT NOW(),

  -- ═══════════════════════════════════════════════════════════
  -- CONSTRAINTS (6 reglas de negocio):
  -- ═══════════════════════════════════════════════════════════

  -- Regla 1: Solo 4 tipos de sesión válidos.
  CONSTRAINT sessions_session_type_chk
    CHECK (session_type IN ('morning', 'night', 'reinforcement', 'mock_exam')),

  -- Regla 2: Solo 3 métodos de enseñanza válidos.
  -- El sistema adaptativo rota entre ellos cuando el score es bajo.
  CONSTRAINT sessions_method_used_chk
    CHECK (method_used IN ('theory', 'examples', 'analogies')),

  -- Regla 3: La acción puede ser NULL (no evaluada aún)
  -- o uno de los 3 resultados del sistema adaptativo.
  CONSTRAINT sessions_action_taken_chk
    CHECK (action_taken IS NULL OR action_taken IN ('advance', 'reinforce', 'restructure')),

  -- Regla 4: Solo 4 estados válidos para una sesión.
  CONSTRAINT sessions_status_chk
    CHECK (status IN ('pending', 'active', 'completed', 'skipped')),

  -- Regla 5: La duración siempre debe ser positiva.
  -- Un valor de 0 o negativo no tiene sentido lógico.
  CONSTRAINT sessions_duration_chk
    CHECK (duration_minutes > 0),

  -- Regla 6: El score puede ser NULL (no evaluado)
  -- pero si existe, debe estar entre 0 y 100.
  CONSTRAINT sessions_score_chk
    CHECK (score_percent IS NULL OR score_percent BETWEEN 0 AND 100)
);

COMMENT ON TABLE public.sessions IS
  'Sesiones individuales de estudio: mañana, noche, refuerzo o simulacro.';

  -- ──────────────────────────────────────────────────────────────
-- TABLA 5: answers
-- Propósito: Almacena cada respuesta individual del quiz.
--            Permite análisis de patrones de error por tópico,
--            nivel K y tipo de pregunta.
--
-- CONSTRAINTS DE NEGOCIO:
--   - correct_answer y user_answer: solo 'a', 'b', 'c', 'd'
--   - level_k: NULL o 'K1', 'K2', 'K3'
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ¿En qué sesión se respondió esta pregunta?
  session_id      UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,

  -- ¿Quién respondió? (desnormalizado para RLS).
  user_id         UUID NOT NULL REFERENCES auth.users(id),

  -- Texto completo de la pregunta del quiz.
  question_text   TEXT NOT NULL,

  -- Las 4 opciones de respuesta en formato JSON.
  -- Ejemplo: { "a": "Un defecto en el código", "b": "Un error humano", ... }
  options_json    JSONB NOT NULL,

  -- La respuesta correcta (a, b, c o d).
  correct_answer  TEXT NOT NULL,

  -- La respuesta que dio el usuario (a, b, c o d).
  user_answer     TEXT NOT NULL,

  -- ¿Acertó? Calculado al momento de insertar.
  is_correct      BOOLEAN NOT NULL,

  -- Código del tópico al que pertenece la pregunta (ej. "FL-1.1.1").
  topic_code      TEXT NOT NULL,

  -- Nivel K de la pregunta (K1=recordar, K2=entender, K3=aplicar).
  level_k         TEXT,

  -- Explicación detallada de por qué la respuesta correcta es correcta.
  -- Generada por OpenAI durante la evaluación.
  explanation     TEXT,

  -- Fecha de creación del registro.
  created_at      TIMESTAMPTZ DEFAULT NOW(),

  -- ═══════════════════════════════════════════════════════════
  -- CONSTRAINTS:
  -- ═══════════════════════════════════════════════════════════

  -- La respuesta correcta solo puede ser a, b, c o d.
  -- Esto protege contra errores del backend que podrían enviar "e" o "1".
  CONSTRAINT answers_correct_answer_chk
    CHECK (correct_answer IN ('a', 'b', 'c', 'd')),

  -- La respuesta del usuario solo puede ser a, b, c o d.
  CONSTRAINT answers_user_answer_chk
    CHECK (user_answer IN ('a', 'b', 'c', 'd')),

  -- El nivel K puede ser NULL (si el quiz no lo especifica)
  -- o uno de los 3 niveles válidos del ISTQB.
  CONSTRAINT answers_level_k_chk
    CHECK (level_k IS NULL OR level_k IN ('K1', 'K2', 'K3'))
);

COMMENT ON TABLE public.answers IS
  'Respuestas individuales del quiz, con análisis de correctitud por tópico y nivel K.';

  -- ──────────────────────────────────────────────────────────────
-- TABLA 6: topic_progress
-- Propósito: Rastrea el progreso del usuario por cada tópico
--            individual dentro de un plan de estudio.
--            Alimenta el dashboard y las decisiones adaptativas.
--
-- CONSTRAINTS DE NEGOCIO:
--   - level_k: NULL o 'K1', 'K2', 'K3'
--   - best_score y last_score: entre 0 y 100
--   - status: 'pending', 'in_progress', 'mastered', 'failed'
-- CONSTRAINT ÚNICO:
--   - Un usuario solo puede tener UN progreso por tópico por plan.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.topic_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ¿De quién es este progreso?
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ¿En qué plan de estudio se está rastreando?
  study_plan_id   UUID NOT NULL REFERENCES public.study_plans(id),

  -- Código del tópico ISTQB (ej. "FL-1.1.1").
  topic_code      TEXT NOT NULL,

  -- Nombre legible del tópico (ej. "¿Qué es el Testing?").
  topic_name      TEXT,

  -- Nivel K del tópico (K1/K2/K3).
  level_k         TEXT,

  -- Número de intentos del usuario en este tópico.
  attempts        INT DEFAULT 0,

  -- Mejor score obtenido en cualquier intento.
  best_score      NUMERIC(5,2) DEFAULT 0,

  -- Score del último intento.
  last_score      NUMERIC(5,2) DEFAULT 0,

  -- Estado actual del progreso en este tópico.
  status          TEXT DEFAULT 'pending',

  -- Fecha en la que el usuario dominó este tópico (score >= 70%).
  -- NULL si aún no lo ha dominado.
  mastered_at     TIMESTAMPTZ,

  -- Última vez que se actualizó este registro.
  updated_at      TIMESTAMPTZ DEFAULT NOW(),

  -- ═══════════════════════════════════════════════════════════
  -- CONSTRAINT ÚNICO COMPUESTO:
  -- Un usuario solo puede tener un registro de progreso
  -- por cada combinación (usuario, plan, tópico).
  -- Esto evita duplicados que corromperían las métricas.
  -- ═══════════════════════════════════════════════════════════
  UNIQUE(user_id, study_plan_id, topic_code),

  -- ═══════════════════════════════════════════════════════════
  -- CONSTRAINTS:
  -- ═══════════════════════════════════════════════════════════

  -- Nivel K válido o NULL.
  CONSTRAINT topic_progress_level_k_chk
    CHECK (level_k IS NULL OR level_k IN ('K1', 'K2', 'K3')),

  -- Scores siempre en rango [0, 100].
  -- Un score de -5 o 150 es claramente un bug.
  CONSTRAINT topic_progress_scores_chk
    CHECK (best_score BETWEEN 0 AND 100 AND last_score BETWEEN 0 AND 100),

  -- Solo 4 estados válidos para el progreso de un tópico.
  CONSTRAINT topic_progress_status_chk
    CHECK (status IN ('pending', 'in_progress', 'mastered', 'failed'))
);

COMMENT ON TABLE public.topic_progress IS
  'Progreso individual por tópico ISTQB dentro de un plan: intentos, scores y estado.';

  -- ══════════════════════════════════════════════════════════════
-- ÍNDICES DE PERFORMANCE
-- ══════════════════════════════════════════════════════════════
-- Cada índice optimiza las consultas más frecuentes del sistema.
-- Sin ellos, PostgreSQL haría un "Sequential Scan" (lectura completa
-- de la tabla) en cada consulta — O(n) en vez de O(log n).
-- ══════════════════════════════════════════════════════════════

-- Índice 1: Buscar sesiones pendientes/activas de un usuario.
-- Caso de uso: "Dame la próxima sesión pendiente del usuario X"
-- Consulta típica: SELECT * FROM sessions WHERE user_id = $1 AND status = 'pending'
CREATE INDEX idx_sessions_user_status
  ON public.sessions(user_id, status);

-- Índice 2: Ordenar sesiones por plan y fecha programada.
-- Caso de uso: "Muestra las sesiones del plan X ordenadas cronológicamente"
-- Consulta típica: SELECT * FROM sessions WHERE study_plan_id = $1 ORDER BY scheduled_at
CREATE INDEX idx_sessions_plan_schedule
  ON public.sessions(study_plan_id, scheduled_at);

-- Índice 3: Buscar respuestas por sesión.
-- Caso de uso: "Dame todas las respuestas del quiz de la sesión X"
-- Consulta típica: SELECT * FROM answers WHERE session_id = $1
CREATE INDEX idx_answers_session
  ON public.answers(session_id);

-- Índice 4: Buscar progreso de tópicos por usuario y plan.
-- Caso de uso: "Muestra el progreso de todos los tópicos del usuario X en el plan Y"
-- Consulta típica: SELECT * FROM topic_progress WHERE user_id = $1 AND study_plan_id = $2
CREATE INDEX idx_topic_progress_user
  ON public.topic_progress(user_id, study_plan_id);