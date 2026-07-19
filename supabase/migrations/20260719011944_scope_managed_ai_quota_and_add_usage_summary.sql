-- La cuota de plataforma corresponde solamente a llamadas Managed.
-- BYOK se conserva para auditoría, pero no puede consumir presupuesto Managed.
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
  v_settings public.user_ai_settings%rowtype;
  v_existing public.ai_usage_events%rowtype;
  v_day_start timestamptz;
  v_month_start timestamptz;
  v_daily_requests bigint := 0;
  v_daily_tokens bigint := 0;
  v_monthly_requests bigint := 0;
  v_monthly_tokens bigint := 0;
  v_reserved_total integer;
  v_reason text;
begin
  if p_reserved_prompt_tokens < 0 or p_reserved_completion_tokens < 0 then
    raise exception 'AI_QUOTA_INVALID_TOKEN_RESERVATION' using errcode = '22023';
  end if;

  v_reserved_total := p_reserved_prompt_tokens + p_reserved_completion_tokens;
  v_day_start := date_trunc('day', timezone('UTC', clock_timestamp())) at time zone 'UTC';
  v_month_start := date_trunc('month', timezone('UTC', clock_timestamp())) at time zone 'UTC';

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select e.*
  into v_existing
  from public.ai_usage_events as e
  where e.id = p_event_id;

  -- AI-04: el filtro mode = 'managed' alinea el contador con AI-01.
  select
    coalesce(sum(e.request_units) filter (where e.created_at >= v_day_start), 0),
    coalesce(sum(e.total_tokens) filter (where e.created_at >= v_day_start), 0),
    coalesce(sum(e.request_units), 0),
    coalesce(sum(e.total_tokens), 0)
  into v_daily_requests, v_daily_tokens, v_monthly_requests, v_monthly_tokens
  from public.ai_usage_events as e
  where e.user_id = p_user_id
    and e.mode = 'managed'
    and e.created_at >= v_month_start;

  if v_existing.id is not null then
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

-- La finalización usa el mismo lock que la reserva. Así una request nueva no
-- agrega tokens mientras la request anterior está reemplazando su estimación
-- reservada por el uso final observado.
create or replace function public.finalize_managed_ai_usage(
  p_user_id uuid,
  p_event_id uuid,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_status text,
  p_error_code text
)
returns table (
  finalization_outcome text,
  accounted_prompt_tokens integer,
  accounted_completion_tokens integer,
  accounted_total_tokens integer
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing public.ai_usage_events%rowtype;
  v_total integer;
begin
  if p_user_id is null or p_event_id is null then
    raise exception 'AI_USAGE_FINALIZATION_ID_REQUIRED' using errcode = '22023';
  end if;

  if (
    p_prompt_tokens is null
    or p_completion_tokens is null
    or p_prompt_tokens < 0
    or p_completion_tokens < 0
  ) then
    raise exception 'AI_USAGE_FINALIZATION_INVALID_TOKENS' using errcode = '22023';
  end if;

  if p_status is null or p_status not in ('success', 'error') then
    raise exception 'AI_USAGE_FINALIZATION_INVALID_STATUS' using errcode = '22023';
  end if;

  if (
    (p_status = 'success' and p_error_code is not null)
    or (
      p_status = 'error'
      and (
        p_error_code is null
        or char_length(btrim(p_error_code)) not between 1 and 100
        -- Este valor identifica una reserva transitoria; nunca es un error
        -- final que deba conservarse en una fila ya terminada.
        or p_error_code = 'QUOTA_RESERVED'
      )
    )
  ) then
    raise exception 'AI_USAGE_FINALIZATION_INVALID_ERROR_CODE' using errcode = '22023';
  end if;

  v_total := p_prompt_tokens + p_completion_tokens;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select e.*
  into v_existing
  from public.ai_usage_events as e
  where e.id = p_event_id
  for update;

  if not found then
    raise exception 'AI_USAGE_RESERVATION_NOT_FOUND' using errcode = '22023';
  end if;

  if (
    v_existing.user_id is distinct from p_user_id
    or v_existing.mode <> 'managed'
  ) then
    raise exception 'AI_USAGE_RESERVATION_IDENTITY_CONFLICT' using errcode = '22023';
  end if;

  -- Repetir exactamente la misma finalización es seguro. Una segunda
  -- finalización con cifras/estado distintos se rechaza, nunca reescribe el log.
  if (
    v_existing.status = p_status
    and v_existing.prompt_tokens = p_prompt_tokens
    and v_existing.completion_tokens = p_completion_tokens
    and v_existing.total_tokens = v_total
    and v_existing.error_code is not distinct from p_error_code
  ) then
    return query select
      'duplicate'::text,
      v_existing.prompt_tokens,
      v_existing.completion_tokens,
      v_existing.total_tokens;
    return;
  end if;

  if (
    v_existing.status <> 'error'
    or v_existing.error_code is distinct from 'QUOTA_RESERVED'
  ) then
    raise exception 'AI_USAGE_FINALIZATION_CONFLICT' using errcode = '22023';
  end if;

  -- Guardar el uso observado, aunque supere la estimación inicial. Recortarlo
  -- ocultaría costo; gracias al mismo lock, la siguiente reserva verá este valor
  -- final y se bloqueará si ya no queda presupuesto.
  update public.ai_usage_events
  set
    prompt_tokens = p_prompt_tokens,
    completion_tokens = p_completion_tokens,
    total_tokens = v_total,
    status = p_status,
    error_code = p_error_code
  where id = p_event_id
  returning * into v_existing;

  return query select
    'finalized'::text,
    v_existing.prompt_tokens,
    v_existing.completion_tokens,
    v_existing.total_tokens;
end;
$$;

revoke all on function public.finalize_managed_ai_usage(
  uuid, uuid, integer, integer, text, text
) from public, anon, authenticated;

grant execute on function public.finalize_managed_ai_usage(
  uuid, uuid, integer, integer, text, text
) to service_role;

comment on function public.finalize_managed_ai_usage(
  uuid, uuid, integer, integer, text, text
) is 'Finaliza una reserva Managed bajo el mismo advisory lock de reserve_ai_quota; idempotente por event_id.';

-- Devuelve siempre una sola fila. No recibe user_id: el dueño procede de auth.uid().
create or replace function public.get_ai_usage_summary()
returns table (
  observed_at timestamptz,
  day_start timestamptz,
  month_start timestamptz,
  activity_daily_requests bigint,
  activity_daily_tokens bigint,
  activity_monthly_requests bigint,
  activity_monthly_tokens bigint,
  quota_daily_requests bigint,
  quota_daily_tokens bigint,
  quota_monthly_requests bigint,
  quota_monthly_tokens bigint,
  blocked_daily_events bigint,
  blocked_monthly_events bigint,
  pending_finalizations bigint
)
language sql
security invoker
set search_path = ''
as $$
  with sampled_now as (
    select clock_timestamp() as observed_at
  ),
  bounds as (
    select
      observed_at,
      date_trunc('day', timezone('UTC', observed_at)) at time zone 'UTC' as day_start,
      date_trunc('month', timezone('UTC', observed_at)) at time zone 'UTC' as month_start
    from sampled_now
  ),
  monthly_events as (
    select e.*
    from public.ai_usage_events as e
    cross join bounds as b
    where e.user_id = (select auth.uid())
      and e.created_at >= b.month_start
  )
  select
    b.observed_at,
    b.day_start,
    b.month_start,
    coalesce(sum(e.request_units) filter (where e.created_at >= b.day_start), 0)::bigint,
    coalesce(sum(e.total_tokens) filter (where e.created_at >= b.day_start), 0)::bigint,
    coalesce(sum(e.request_units), 0)::bigint,
    coalesce(sum(e.total_tokens), 0)::bigint,
    coalesce(sum(e.request_units) filter (
      where e.mode = 'managed' and e.created_at >= b.day_start
    ), 0)::bigint,
    coalesce(sum(e.total_tokens) filter (
      where e.mode = 'managed' and e.created_at >= b.day_start
    ), 0)::bigint,
    coalesce(sum(e.request_units) filter (where e.mode = 'managed'), 0)::bigint,
    coalesce(sum(e.total_tokens) filter (where e.mode = 'managed'), 0)::bigint,
    count(*) filter (
      where e.status = 'blocked_quota' and e.created_at >= b.day_start
    )::bigint,
    count(*) filter (where e.status = 'blocked_quota')::bigint,
    count(*) filter (
      where e.mode = 'managed'
        and e.status = 'error'
        and e.error_code = 'QUOTA_RESERVED'
    )::bigint
  from bounds as b
  left join monthly_events as e on true
  group by b.observed_at, b.day_start, b.month_start;
$$;

revoke all on function public.get_ai_usage_summary() from public, anon;
grant execute on function public.get_ai_usage_summary() to authenticated, service_role;

comment on function public.get_ai_usage_summary() is
  'Resumen UTC del dueño autenticado: actividad total y cuota Managed; no expone eventos ni acepta user_id.';