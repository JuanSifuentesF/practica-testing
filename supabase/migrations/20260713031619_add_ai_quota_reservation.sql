-- ============================================================
-- AI-02: reserva atómica e idempotente de cuota managed
--
-- La función hace exclusivamente trabajo de base de datos.
-- NUNCA llama al proveedor LLM dentro de la transacción.
-- ============================================================
create or replace function public.reserve_ai_quota(
  p_user_id uuid,
  p_event_id uuid,
  p_feature text,
  p_provider text,
  p_model_name text,
  p_reserved_prompt_tokens integer,
  p_reserved_completion_tokens integer
)
returns table (
  reservation_outcome text,
  block_reason text,
  daily_requests bigint,
  daily_tokens bigint,
  monthly_requests bigint,
  monthly_tokens bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  -- Copias tipadas de las filas existentes. %rowtype evita que
  -- la función se desincronice si cambia el tipo de una columna.
  v_settings public.user_ai_settings%rowtype;
  v_existing public.ai_usage_events%rowtype;

  -- Las ventanas de cuota son UTC para que servidor, DB y UI
  -- no dependan de la zona horaria del proceso de Next.js.
  v_day_start timestamptz;
  v_month_start timestamptz;
  v_daily_requests bigint := 0;
  v_daily_tokens bigint := 0;
  v_monthly_requests bigint := 0;
  v_monthly_tokens bigint := 0;
  v_reserved_total integer;
  v_reason text;
begin
  -- Defensa previa: nunca reservar una cantidad negativa.
  if p_reserved_prompt_tokens < 0 or p_reserved_completion_tokens < 0 then
    raise exception 'AI_QUOTA_INVALID_TOKEN_RESERVATION' using errcode = '22023';
  end if;

  v_reserved_total := p_reserved_prompt_tokens + p_reserved_completion_tokens;
  v_day_start := date_trunc('day', timezone('UTC', clock_timestamp())) at time zone 'UTC';
  v_month_start := date_trunc('month', timezone('UTC', clock_timestamp())) at time zone 'UTC';

  -- Un solo lock por usuario y siempre en el mismo orden.
  -- Al ser xact_lock, PostgreSQL lo libera al salir de la función.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- Idempotencia: el event_id se genera una sola vez en el
  -- Route Handler. Si reaparece, no cobra ni inserta otra fila.
  select e.*
  into v_existing
  from public.ai_usage_events as e
  where e.id = p_event_id;

  -- Una sola agregación mensual calcula también el subconjunto
  -- diario mediante FILTER. Las reservas en curso cuentan porque
  -- ya tienen request_units/tokens conservadores.
  select
    coalesce(sum(e.request_units) filter (where e.created_at >= v_day_start), 0),
    coalesce(sum(e.total_tokens) filter (where e.created_at >= v_day_start), 0),
    coalesce(sum(e.request_units), 0),
    coalesce(sum(e.total_tokens), 0)
  into v_daily_requests, v_daily_tokens, v_monthly_requests, v_monthly_tokens
  from public.ai_usage_events as e
  where e.user_id = p_user_id
    and e.created_at >= v_month_start;

  if v_existing.id is not null then
    -- El mismo UUID nunca puede reutilizarse para otro usuario o feature.
    if v_existing.user_id <> p_user_id or v_existing.feature <> p_feature then
      raise exception 'AI_QUOTA_EVENT_ID_CONFLICT' using errcode = '22023';
    end if;

    return query select
      'duplicate'::text,
      v_existing.error_code,
      v_daily_requests,
      v_daily_tokens,
      v_monthly_requests,
      v_monthly_tokens;
    return;
  end if;

  -- FOR UPDATE serializa cambios de settings con la reserva.
  -- El advisory lock resuelve la concurrencia entre requests del usuario.
  select s.*
  into v_settings
  from public.user_ai_settings as s
  where s.user_id = p_user_id
  for update;

  if not found or v_settings.mode <> 'managed' then
    raise exception 'AI_QUOTA_MANAGED_MODE_REQUIRED' using errcode = '22023';
  end if;

  if v_settings.provider <> p_provider then
    raise exception 'AI_QUOTA_PROVIDER_MISMATCH' using errcode = '22023';
  end if;

  if v_daily_requests + 1 > v_settings.daily_request_limit then
    v_reason := 'DAILY_REQUEST_LIMIT';
  elsif v_monthly_requests + 1 > v_settings.monthly_request_limit then
    v_reason := 'MONTHLY_REQUEST_LIMIT';
  elsif v_daily_tokens + v_reserved_total > v_settings.daily_token_limit then
    v_reason := 'DAILY_TOKEN_LIMIT';
  elsif v_monthly_tokens + v_reserved_total > v_settings.monthly_token_limit then
    v_reason := 'MONTHLY_TOKEN_LIMIT';
  end if;

  if v_reason is not null then
    -- El bloqueo también es auditable, pero no consume cuota.
    insert into public.ai_usage_events (
      id, user_id, feature, mode, provider, model_name,
      prompt_tokens, completion_tokens, total_tokens,
      request_units, status, error_code
    ) values (
      p_event_id, p_user_id, p_feature, 'managed', p_provider, p_model_name,
      0, 0, 0, 0, 'blocked_quota', v_reason
    );

    return query select
      'blocked'::text, v_reason, v_daily_requests, v_daily_tokens,
      v_monthly_requests, v_monthly_tokens;
    return;
  end if;

  -- Marcador transitorio compatible con los CHECK de AI-01.
  -- Cuenta la reserva de forma conservadora hasta su finalización.
  -- AI-05 llamará recordAiUsage tanto en éxito como en error.
  insert into public.ai_usage_events (
    id, user_id, feature, mode, provider, model_name,
    prompt_tokens, completion_tokens, total_tokens,
    request_units, status, error_code
  ) values (
    p_event_id, p_user_id, p_feature, 'managed', p_provider, p_model_name,
    p_reserved_prompt_tokens, p_reserved_completion_tokens, v_reserved_total,
    1, 'error', 'QUOTA_RESERVED'
  );

  return query select
    'reserved'::text,
    null::text,
    v_daily_requests + 1,
    v_daily_tokens + v_reserved_total,
    v_monthly_requests + 1,
    v_monthly_tokens + v_reserved_total;
end;
$$;

revoke all on function public.reserve_ai_quota(
  uuid, uuid, text, text, text, integer, integer
) from public, anon, authenticated;

grant execute on function public.reserve_ai_quota(
  uuid, uuid, text, text, text, integer, integer
) to service_role;

comment on function public.reserve_ai_quota(
  uuid, uuid, text, text, text, integer, integer
) is 'Reserva atómica e idempotente de cuota managed. Solo service_role.';