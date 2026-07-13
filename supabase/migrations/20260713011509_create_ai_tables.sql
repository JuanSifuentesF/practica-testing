-- ============================================================
-- MIGRACIÓN: Tablas de AI Settings & Usage Control
-- Guía: AI-01
-- Descripción: Crea las tablas user_ai_settings (preferencias
--              de IA por usuario) y ai_usage_events (auditoría
--              de consumo de tokens/requests).
--
-- REGLA DE SEGURIDAD FUNDAMENTAL:
--   Estas tablas NO contienen columnas para almacenar API keys
--   del usuario. El modo BYOK recibe la key temporalmente en
--   la request y la descarta. Nunca persiste en la DB.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- TABLA 9: user_ai_settings
-- Propósito: Almacena las preferencias de configuración de IA
--            de cada usuario. Controla qué modo (demo/managed/byok),
--            qué proveedor (gemini/openai) y qué límites tiene.
--
-- ¿Por qué user_id como PRIMARY KEY (no UUID genérico)?
--   Cada usuario tiene exactamente UNA configuración de IA.
--   Usar user_id como PK garantiza la relación 1:1 y evita
--   duplicados. Es el mismo patrón de user_profiles (DB-02).
--
-- ¿Por qué model_name es nullable?
--   Si el usuario no especifica un modelo, el runtime server-side
--   (AI-02) elegirá el modelo por defecto según el proveedor.
--   NULL significa "usar el default del sistema".
--
-- ¿Por qué NO hay columna api_key, encrypted_key ni secret?
--   Almacenar API keys personales en la DB crea un vector de
--   ataque masivo. Si la DB se filtra (SQL injection, backup
--   expuesto, insider threat), TODAS las keys de usuario quedan
--   comprometidas. El modo BYOK usa la key solo en memoria
--   durante la request y la descarta.
--
-- CONSTRAINTS DE NEGOCIO:
--   - mode: solo 'demo', 'managed' o 'byok'
--   - provider: solo 'gemini' u 'openai'
--   - todos los límites deben ser >= 0
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.user_ai_settings (
  -- Clave primaria que referencia directamente al usuario.
  -- ON DELETE CASCADE: si se borra el usuario de Auth, se borran sus settings.
  -- Mismo patrón que user_profiles (DB-02).
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Modo de uso de IA elegido por el usuario.
  -- 'demo':    funcionalidad educativa sin llamadas LLM reales.
  --            Útil para probar la app sin costo.
  -- 'managed': usa las API keys del servidor (GEMINI_API_KEY / OPENAI_API_KEY).
  --            Sujeto a límites por usuario para controlar costos.
  -- 'byok':    "Bring Your Own Key". El usuario provee su key
  --            temporalmente en cada request. No se almacena.
  mode TEXT NOT NULL DEFAULT 'demo',

  -- Proveedor de IA preferido.
  -- El runtime (AI-02) usará este proveedor salvo que el modo
  -- sea 'demo' (que no llama a ningún proveedor externo).
  provider TEXT NOT NULL DEFAULT 'gemini',

  -- Modelo específico (nullable).
  -- NULL = usar el default del proveedor según el sistema.
  -- Ejemplo: 'gemini-2.5-flash', 'gpt-4o-mini'.
  -- No se valida contra una lista fija porque los modelos
  -- cambian frecuentemente. AI-02 DEBE validarlo contra una allowlist
  -- server-side; nunca debe pasar este texto directamente al SDK.
  model_name TEXT,

  -- ═══════════════════════════════════════════════════════════
  -- LÍMITES DE CUOTA POR USUARIO
  -- ═══════════════════════════════════════════════════════════
  --
  -- Estos límites aplican al modo 'managed'.
  -- El modo 'demo' no consume cuota (no llama al LLM).
  -- El modo 'byok' usa la key del usuario, pero igual
  -- registra consumo para auditoría.
  --
  -- ¿Por qué defaults razonables?
  --   Un usuario nuevo en modo 'demo' no se ve afectado.
  --   Si cambia a 'managed', los defaults (20 requests/día,
  --   300/mes) son suficientes para uso normal sin agotar
  --   la cuota del proyecto.
  -- ═══════════════════════════════════════════════════════════

  -- Máximo de requests LLM por día (todas las features).
  daily_request_limit INTEGER NOT NULL DEFAULT 20,

  -- Máximo de requests LLM por mes.
  monthly_request_limit INTEGER NOT NULL DEFAULT 300,

  -- Máximo de tokens consumidos por día (prompt + completion).
  daily_token_limit INTEGER NOT NULL DEFAULT 50000,

  -- Máximo de tokens consumidos por mes.
  monthly_token_limit INTEGER NOT NULL DEFAULT 500000,

  -- Última vez que se actualizó la configuración.
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ═══════════════════════════════════════════════════════════
  -- CONSTRAINTS (Reglas de negocio grabadas en piedra)
  -- ═══════════════════════════════════════════════════════════

  -- Regla 1: Solo 3 modos válidos.
  -- ¿Por qué? Cada modo tiene un flujo completamente diferente
  -- en el runtime. Un modo inventado causaría un comportamiento
  -- indefinido.
  CONSTRAINT user_ai_settings_mode_chk
    CHECK (mode IN ('demo', 'managed', 'byok')),

  -- Regla 2: Solo 2 proveedores válidos.
  -- Si en el futuro se agrega Anthropic o Mistral, se amplía
  -- este CHECK con una nueva migración.
  CONSTRAINT user_ai_settings_provider_chk
    CHECK (provider IN ('gemini', 'openai')),

  -- Regla 3: Todos los límites deben ser no-negativos.
  -- Un límite de -1 no tiene sentido lógico.
  -- Un límite de 0 significa "bloqueado" (puede ser útil
  -- para suspender temporalmente a un usuario).
  CONSTRAINT user_ai_settings_limits_chk
    CHECK (
      daily_request_limit >= 0
      AND monthly_request_limit >= 0
      AND daily_token_limit >= 0
      AND monthly_token_limit >= 0
    ),

  -- NULL usa el modelo del sistema; si se informa, no acepta vacío ni texto excesivo.
  CONSTRAINT user_ai_settings_model_name_chk
    CHECK (
      model_name IS NULL
      OR char_length(btrim(model_name)) BETWEEN 1 AND 100
    )
);

COMMENT ON TABLE public.user_ai_settings IS
  'Preferencias de IA por usuario: modo (demo/managed/byok), proveedor, modelo y límites de cuota. NO almacena API keys.';

-- updated_at lo controla PostgreSQL; el cliente no recibe privilegio para editarlo.
CREATE OR REPLACE FUNCTION public.set_user_ai_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_ai_settings_updated_at()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER set_user_ai_settings_updated_at
  BEFORE UPDATE ON public.user_ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_ai_settings_updated_at();

  -- ──────────────────────────────────────────────────────────────
-- TABLA 10: ai_usage_events
-- Propósito: Registra cada interacción con un proveedor de IA.
--            Permite auditar consumo, detectar abuso, calcular
--            costos y mostrar métricas al usuario.
--
-- ¿Por qué una tabla separada de user_ai_settings?
--   - user_ai_settings: configuración (1 fila por usuario).
--   - ai_usage_events: log inmutable (N filas por usuario).
--   Son datos con ciclos de vida diferentes. Los settings
--   cambian raramente; los events crecen con cada request.
--
-- ¿Por qué registrar tanto 'success' como 'blocked_quota'?
--   Los eventos bloqueados son igual de valiosos para auditoría.
--   Permiten detectar si un usuario está siendo bloqueado
--   injustamente (límites muy bajos) o si está intentando
--   abusar del sistema.
--
-- ¿Por qué prompt_tokens, completion_tokens y total_tokens?
--   Gemini y OpenAI devuelven estos contadores en cada response.
--   Registrarlos permite calcular costos reales por usuario,
--   feature y proveedor. Si el proveedor no los devuelve,
--   el runtime guarda 0 y usa un estimado conservador.
--
-- ¿Por qué request_units DEFAULT 1?
--   Una llamada externa = 1 request unit. Demo y blocked_quota
--   deben enviar 0. Esto simplifica el
--   cálculo de cuota diaria/mensual sin contar tokens
--   (que son más granulares pero más difíciles de estimar
--   antes de hacer la llamada).
--
-- CONSTRAINTS DE NEGOCIO:
--   - feature: solo las 6 features que llaman al LLM
--   - mode: coherente con user_ai_settings.mode
--   - provider/model_name: NULL en demo; reales en managed/byok
--   - status: solo 'success', 'blocked_quota' o 'error'
--   - tokens y request_units: >= 0
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.ai_usage_events (
  -- Identificador único del evento.
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ¿Quién generó este evento?
  -- ON DELETE CASCADE: si se borra el usuario, se borran sus eventos.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ¿Qué feature de la app generó la llamada LLM?
  -- Cada feature corresponde a un endpoint que llama al LLM.
  -- Esto permite analizar consumo por feature:
  --   "¿Cuántos tokens gasta en promedio generar un plan?"
  --   "¿practice_evaluate consume más que theory?"
  feature TEXT NOT NULL,

  -- Modo de IA activo al momento de la llamada.
  -- Se captura aquí (no se lee de user_ai_settings) porque
  -- el usuario podría cambiar de modo entre llamadas.
  -- Así cada evento refleja el modo exacto que se usó.
  mode TEXT NOT NULL,

  -- Proveedor usado en esta llamada específica.
  -- NULL en modo demo porque no hubo proveedor externo.
  -- Puede diferir del provider de user_ai_settings si hubo fallback.
  provider TEXT,

  -- Modelo real que respondió; NULL en modo demo.
  model_name TEXT,

  -- Tokens del prompt (input).
  -- 0 si el proveedor no reportó usage o si status = 'blocked_quota'.
  prompt_tokens INTEGER NOT NULL DEFAULT 0,

  -- Tokens de la respuesta (output).
  completion_tokens INTEGER NOT NULL DEFAULT 0,

  -- Tokens totales (prompt + completion).
  -- Redundante, pero facilita consultas de agregación
  -- sin calcular la suma cada vez.
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- Unidades de request consumidas.
  -- Normalmente 1 por llamada LLM. Podría ser 0 para
  -- eventos bloqueados que no consumieron cuota real.
  request_units INTEGER NOT NULL DEFAULT 1,

  -- Resultado de la interacción.
  -- 'success':       llamada exitosa al LLM.
  -- 'blocked_quota': bloqueada por límite diario/mensual.
  -- 'error':         falló la llamada al proveedor.
  status TEXT NOT NULL,

  -- Código de error opcional (NULL si success).
  -- Ejemplos: 'RATE_LIMIT', 'TIMEOUT', 'INVALID_JSON',
  -- 'PROVIDER_DOWN', 'DAILY_LIMIT', 'MONTHLY_LIMIT'.
  -- Permite filtrar y agrupar errores por tipo.
  error_code TEXT,

  -- Timestamp del evento (inmutable, no se actualiza).
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ═══════════════════════════════════════════════════════════
  -- CONSTRAINTS (Reglas de negocio)
  -- ═══════════════════════════════════════════════════════════

  -- Regla 1: Solo las 6 features que llaman al LLM.
  -- Coherente con las API Routes existentes:
  --   plan           → /api/plan/generate
  --   theory         → /api/sessions/[id]/theory
  --   quiz           → /api/sessions/[id]/quiz
  --   evaluate       → /api/sessions/[id]/evaluate
  --   practice_generate  → /api/practice/generate
  --   practice_evaluate  → /api/practice/evaluate
  CONSTRAINT ai_usage_events_feature_chk
    CHECK (feature IN (
      'plan', 'theory', 'quiz', 'evaluate',
      'practice_generate', 'practice_evaluate'
    )),

  -- Regla 2: Modo coherente con los 3 modos válidos.
  CONSTRAINT ai_usage_events_mode_chk
    CHECK (mode IN ('demo', 'managed', 'byok')),

  -- Regla 3: demo no inventa proveedor; managed/byok exigen proveedor real.
  CONSTRAINT ai_usage_events_provider_chk
    CHECK (
      (mode = 'demo' AND provider IS NULL)
      OR (
        mode IN ('managed', 'byok')
        AND provider IS NOT NULL
        AND provider IN ('gemini', 'openai')
      )
    ),

  -- Regla 4: Solo 3 estados de resultado válidos.
  CONSTRAINT ai_usage_events_status_chk
    CHECK (status IN ('success', 'blocked_quota', 'error')),

  -- Regla 5: Tokens y request units no pueden ser negativos.
  -- Un valor negativo es claramente un bug del runtime.
  CONSTRAINT ai_usage_events_tokens_chk
    CHECK (
      prompt_tokens >= 0
      AND completion_tokens >= 0
      AND total_tokens >= 0
      AND request_units >= 0
    ),

  -- Evita métricas contradictorias entre el desglose y el total.
  CONSTRAINT ai_usage_events_total_tokens_chk
    CHECK (total_tokens = prompt_tokens + completion_tokens),

  -- Un evento exitoso no lleva error; bloqueos y errores sí deben clasificarse.
  CONSTRAINT ai_usage_events_error_code_chk
    CHECK (
      (status = 'success' AND error_code IS NULL)
      OR (
        status IN ('blocked_quota', 'error')
        AND error_code IS NOT NULL
        AND char_length(btrim(error_code)) BETWEEN 1 AND 100
      )
    ),

  CONSTRAINT ai_usage_events_model_name_chk
    CHECK (
      (mode = 'demo' AND model_name IS NULL)
      OR (
        mode IN ('managed', 'byok')
        AND model_name IS NOT NULL
        AND char_length(btrim(model_name)) BETWEEN 1 AND 100
      )
    ),

  -- Demo y bloqueos no consumen proveedor; un éxito externo consume >=1 unidad.
  CONSTRAINT ai_usage_events_request_status_chk
    CHECK (
      (
        status = 'blocked_quota'
        AND mode = 'managed'
        AND request_units = 0
        AND total_tokens = 0
      )
      OR (
        status = 'success'
        AND (
          (mode = 'demo' AND request_units = 0 AND total_tokens = 0)
          OR (mode IN ('managed', 'byok') AND request_units >= 1)
        )
      )
      OR (
        status = 'error'
        AND (
          mode IN ('managed', 'byok')
          OR (mode = 'demo' AND request_units = 0 AND total_tokens = 0)
        )
      )
    )
);

COMMENT ON TABLE public.ai_usage_events IS
  'Log inmutable de cada interacción con proveedores de IA: tokens, status y feature. NO contiene API keys ni secretos.';

  -- ══════════════════════════════════════════════════════════════
-- ÍNDICES DE PERFORMANCE — AI SETTINGS & USAGE
-- ══════════════════════════════════════════════════════════════
-- Estos índices optimizan las consultas más frecuentes del
-- Bloque I. user_ai_settings no necesita índices adicionales
-- porque user_id ya es PK (y por lo tanto tiene índice único).
-- ══════════════════════════════════════════════════════════════

-- Índice 10: Buscar eventos de un usuario ordenados por fecha.
-- Caso de uso: "Últimos 20 eventos de consumo del usuario X"
-- Consulta típica:
--   SELECT * FROM ai_usage_events
--   WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20
-- El orden DESC es importante: siempre mostramos los más recientes primero.
CREATE INDEX idx_ai_usage_events_user_date
  ON public.ai_usage_events(user_id, created_at DESC);

-- Índice 11: Filtrar eventos por feature dentro de una ventana temporal.
-- Caso de uso: "¿Cuántos tokens gastó el usuario X en 'theory' hoy?"
-- Consulta típica:
--   SELECT SUM(total_tokens) FROM ai_usage_events
--   WHERE user_id = $1 AND feature = $2 AND created_at >= $3
-- Igualdades primero; rango/orden temporal al final.
CREATE INDEX idx_ai_usage_events_user_feature_date
  ON public.ai_usage_events(user_id, feature, created_at DESC);

-- Índice 12: Acelerar la observabilidad de bloqueos y errores.
-- Es parcial para no indexar la mayoría de eventos exitosos.
-- Consulta típica:
--   SELECT COUNT(*) FROM ai_usage_events
--   WHERE user_id = $1 AND status <> 'success' AND created_at >= $2
CREATE INDEX idx_ai_usage_events_user_non_success_date
  ON public.ai_usage_events(user_id, created_at DESC)
  WHERE status <> 'success';

  -- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — AI TABLES
-- ══════════════════════════════════════════════════════════════
--
-- Mismo patrón de ownership que DB-04/PL-02, optimizado con
-- (select auth.uid()). Los eventos son visibles pero inmutables para el usuario.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.user_ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────────────
-- TABLA 9: user_ai_settings — Policies
-- ──────────────────────────────────────────────────────────────
--
-- Particularidad: la PK es user_id (como user_profiles).
-- La policy compara (select auth.uid()) con user_id para evitar reevaluarla por fila.
--
-- Operaciones permitidas:
--   SELECT: ver solo tu propia configuración
--   INSERT: crear tu propia configuración (primera vez)
--   UPDATE: modificar tu propia configuración (cambiar modo/provider)
--   DELETE: NO se permite (la config se borra vía CASCADE
--           cuando se elimina el usuario de auth.users)
-- ──────────────────────────────────────────────────────────────

-- SELECT: un usuario solo puede leer su propia configuración de IA.
-- Caso de uso: la UI de /settings/ai carga los settings actuales.
CREATE POLICY "user_ai_settings_select_own"
  ON public.user_ai_settings
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- INSERT: un usuario solo puede crear su propia configuración.
-- Caso de uso: primera vez que el usuario visita /settings/ai,
-- el runtime crea la fila con valores por defecto.
CREATE POLICY "user_ai_settings_insert_own"
  ON public.user_ai_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- UPDATE: un usuario solo puede modificar su propia configuración.
-- Caso de uso: el usuario cambia de modo 'demo' a 'managed'.
-- USING + WITH CHECK garantiza que no pueda cambiar el user_id.
CREATE POLICY "user_ai_settings_update_own"
  ON public.user_ai_settings
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- DELETE: NO se crea política de borrado.
-- La configuración se elimina automáticamente vía ON DELETE CASCADE
-- cuando se borra el usuario de auth.users.

-- ──────────────────────────────────────────────────────────────
-- TABLA 10: ai_usage_events — Policies
-- ──────────────────────────────────────────────────────────────
--
-- Los eventos de uso son un LOG INMUTABLE.
-- El usuario puede verlos pero no modificarlos ni borrarlos.
-- Solo el runtime (service_role) puede insertar eventos.
--
-- ¿Por qué el INSERT es para service_role y no authenticated?
--   Los eventos se crean desde los Route Handlers que ya
--   validaron la autenticación. Usar service_role para INSERT
--   evita que un usuario malicioso fabrique eventos falsos
--   (ej. reportar menos tokens de los que realmente consumió
--   para evadir la cuota).
--
-- Operaciones permitidas:
--   SELECT: usuario puede ver sus propios eventos
--   INSERT: solo el runtime (service_role) puede crear eventos
--   UPDATE: NO se permite (log inmutable)
--   DELETE: NO se permite (log inmutable, CASCADE limpia al borrar usuario)
-- ──────────────────────────────────────────────────────────────

-- SELECT: un usuario solo puede ver sus propios eventos de consumo.
-- Caso de uso: la UI de /settings/ai/usage muestra el historial.
CREATE POLICY "ai_usage_events_select_own"
  ON public.ai_usage_events
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- PRIVILEGIOS: RLS decide filas; GRANT/REVOKE decide operaciones y columnas.
-- No dependemos de privilegios predeterminados del proyecto.
REVOKE ALL ON TABLE public.user_ai_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_usage_events FROM anon, authenticated;

-- El usuario puede leer su fila y crearla con defaults administrados.
-- Solo puede elegir preferencias; no puede elevar sus propias cuotas.
GRANT SELECT ON TABLE public.user_ai_settings TO authenticated;
GRANT INSERT (user_id, mode, provider, model_name)
  ON TABLE public.user_ai_settings TO authenticated;
GRANT UPDATE (mode, provider, model_name)
  ON TABLE public.user_ai_settings TO authenticated;

-- El historial es visible para su dueño, pero solo el servidor lo escribe.
GRANT SELECT ON TABLE public.ai_usage_events TO authenticated;

-- service_role es exclusivamente server-only y omite RLS; los Route Handlers
-- deben autenticar primero y aportar el user_id verificado.
GRANT ALL ON TABLE public.user_ai_settings TO service_role;
GRANT ALL ON TABLE public.ai_usage_events TO service_role;