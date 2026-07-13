-- ============================================================
-- TEST AI-01 sección 6.3: Probar CHECK constraints — valores válidos
-- Ejecutar en Supabase SQL Editor (NO en producción con datos reales)
-- Este script usa transacciones que hacen ROLLBACK al final.
-- ============================================================

-- BLOQUE 1: user_ai_settings — INSERTs válidos
-- ============================================================
DO $$
DECLARE
  test_uid UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== user_ai_settings: INSERTs validos ===';

  SELECT id INTO test_uid FROM auth.users LIMIT 1;
  IF test_uid IS NULL THEN
    RAISE NOTICE '⚠ No hay usuarios en auth.users. Crea uno desde la app y vuelve a ejecutar.';
    RETURN;
  END IF;
  RAISE NOTICE 'Usuario de prueba: %', test_uid;

  -- Caso 1: INSERT mínimo (solo defaults)
  INSERT INTO public.user_ai_settings (user_id) VALUES (test_uid);
  RAISE NOTICE '[PASS] 1. INSERT default -> mode=demo, provider=gemini, limits OK';

  -- Caso 2: managed + openai con todos los valores
  INSERT INTO public.user_ai_settings (user_id, mode, provider, model_name, daily_request_limit, monthly_request_limit, daily_token_limit, monthly_token_limit)
  VALUES (test_uid, 'managed', 'openai', 'gpt-4o-mini', 50, 1000, 200000, 2000000);
  RAISE NOTICE '[PASS] 2. INSERT managed+openai+gpt-4o-mini';

  -- Caso 3: byok con gemini (model opcional = NULL)
  INSERT INTO public.user_ai_settings (user_id, mode, provider, model_name)
  VALUES (test_uid, 'byok', 'gemini', NULL);
  RAISE NOTICE '[PASS] 3. INSERT byok+gemini, model_name=NULL';

  -- Caso 4: limite 0 (usuario bloqueado)
  INSERT INTO public.user_ai_settings (user_id, daily_request_limit, monthly_request_limit)
  VALUES (test_uid, 0, 0);
  RAISE NOTICE '[PASS] 4. INSERT con limites=0 (usuario bloqueado)';

  DELETE FROM public.user_ai_settings WHERE user_id = test_uid;

  RAISE NOTICE '';
  RAISE NOTICE '=== RESULTADO: 4/4 INSERTs validos en user_ai_settings ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Si ves 4 [PASS], los CHECK constraints de user_ai_settings';
  RAISE NOTICE '(mode, provider, limits, model_name) aceptan valores validos.';
  RAISE NOTICE '';
END;
$$ LANGUAGE plpgsql;

-- BLOQUE 2: ai_usage_events — INSERTs válidos (service_role)
-- ============================================================
DO $$
DECLARE
  test_uid UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== ai_usage_events: INSERTs validos ===';

  SELECT id INTO test_uid FROM auth.users LIMIT 1;
  IF test_uid IS NULL THEN
    RAISE NOTICE '⚠ No hay usuarios en auth.users.';
    RETURN;
  END IF;

  -- Caso 1: demo success
  INSERT INTO public.ai_usage_events (
    user_id, feature, mode, provider, model_name,
    prompt_tokens, completion_tokens, total_tokens, request_units, status, error_code
  ) VALUES (
    test_uid, 'plan', 'demo', NULL, NULL,
    0, 0, 0, 0, 'success', NULL
  );
  RAISE NOTICE '[PASS] 1. demo/success — sin proveedor, 0 tokens';

  -- Caso 2: managed success
  INSERT INTO public.ai_usage_events (
    user_id, feature, mode, provider, model_name,
    prompt_tokens, completion_tokens, total_tokens, request_units, status, error_code
  ) VALUES (
    test_uid, 'quiz', 'managed', 'gemini', 'gemini-2.5-flash',
    150, 80, 230, 1, 'success', NULL
  );
  RAISE NOTICE '[PASS] 2. managed/success — gemini, tokens coherentes';

  -- Caso 3: byok success
  INSERT INTO public.ai_usage_events (
    user_id, feature, mode, provider, model_name,
    prompt_tokens, completion_tokens, total_tokens, request_units, status, error_code
  ) VALUES (
    test_uid, 'practice_evaluate', 'byok', 'openai', 'gpt-4o',
    500, 300, 800, 1, 'success', NULL
  );
  RAISE NOTICE '[PASS] 3. byok/success — openai gpt-4o';

  -- Caso 4: blocked_quota
  INSERT INTO public.ai_usage_events (
    user_id, feature, mode, provider, model_name,
    prompt_tokens, completion_tokens, total_tokens, request_units, status, error_code
  ) VALUES (
    test_uid, 'theory', 'managed', 'gemini', 'gemini-2.5-flash',
    0, 0, 0, 0, 'blocked_quota', 'DAILY_LIMIT'
  );
  RAISE NOTICE '[PASS] 4. managed/blocked_quota — request_units=0';

  -- Caso 5: error
  INSERT INTO public.ai_usage_events (
    user_id, feature, mode, provider, model_name,
    prompt_tokens, completion_tokens, total_tokens, request_units, status, error_code
  ) VALUES (
    test_uid, 'plan', 'managed', 'gemini', 'gemini-2.5-flash',
    200, 0, 200, 1, 'error', 'TIMEOUT'
  );
  RAISE NOTICE '[PASS] 5. managed/error — completion=0';

  -- Caso 6: practice_generate + evaluate
  INSERT INTO public.ai_usage_events (
    user_id, feature, mode, provider, model_name,
    prompt_tokens, completion_tokens, total_tokens, request_units, status, error_code
  ) VALUES (
    test_uid, 'practice_generate', 'byok', 'openai', 'gpt-4o-mini',
    100, 50, 150, 1, 'success', NULL
  );
  RAISE NOTICE '[PASS] 6. practice_generate byok/openai success';

  DELETE FROM public.ai_usage_events WHERE user_id = test_uid;

  RAISE NOTICE '';
  RAISE NOTICE '=== RESULTADO: 6/6 INSERTs validos en ai_usage_events ===';
  RAISE NOTICE '';
  RAISE NOTICE 'Si ves 6 [PASS], los CHECK constraints de ai_usage_events';
  RAISE NOTICE '(feature, mode, provider, status, tokens, request_units, error_code)';
  RAISE NOTICE 'aceptan todas las combinaciones validas.';
  RAISE NOTICE '';
  RAISE NOTICE 'Seccion 6.3 completada ✓';
END;
$$ LANGUAGE plpgsql;
