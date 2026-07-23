-- Apply each completed session's adaptation exactly once. The response is
-- persisted so retries return the same reinforcement session identifiers.

set lock_timeout = '5s';
set statement_timeout = '2min';

create table private.session_adaptations (
  source_session_id uuid primary key,
  user_id uuid not null,
  response_json jsonb not null,
  created_at timestamptz not null default now(),

  constraint session_adaptations_source_user_fk
    foreign key (source_session_id, user_id)
    references public.sessions (id, user_id)
    on delete cascade,
  constraint session_adaptations_response_chk
    check (jsonb_typeof(response_json) = 'object')
);

grant select, insert on private.session_adaptations to service_role;

create or replace function public.apply_session_adaptation(
  p_user_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_plan public.study_plans%rowtype;
  v_existing private.session_adaptations%rowtype;
  v_score numeric;
  v_expected_action text;
  v_topic_status text;
  v_next_method text;
  v_reinforcement_count integer;
  v_max_day integer;
  v_reinforcement_ids uuid[] := array[]::uuid[];
  v_new_estimated_end_date date;
  v_now timestamptz := clock_timestamp();
  v_message text;
  v_response jsonb;
begin
  if p_user_id is null or p_session_id is null then
    raise exception 'ADAPT_IDENTITY_REQUIRED' using errcode = '22023';
  end if;

  select s.*
  into v_session
  from public.sessions as s
  where s.id = p_session_id
    and s.user_id = p_user_id
  for update;

  if not found then
    raise exception 'ADAPT_SESSION_NOT_FOUND' using errcode = '22023';
  end if;

  select a.*
  into v_existing
  from private.session_adaptations as a
  where a.source_session_id = p_session_id
    and a.user_id = p_user_id;

  if found then
    return v_existing.response_json || jsonb_build_object(
      'already_processed', true,
      'message', 'La adaptación ya había sido aplicada previamente.'
    );
  end if;

  if v_session.status <> 'completed'
    or v_session.completed_at is null
    or v_session.score_percent is null
    or v_session.action_taken is null
  then
    raise exception 'ADAPT_SESSION_NOT_COMPLETED' using errcode = 'P0001';
  end if;

  if cardinality(v_session.topic_codes) = 0 then
    raise exception 'ADAPT_TOPICS_REQUIRED' using errcode = '22023';
  end if;

  v_score := v_session.score_percent;
  v_expected_action := case
    when v_score >= 70 then 'advance'
    when v_score >= 50 then 'reinforce'
    else 'restructure'
  end;

  if v_session.action_taken <> v_expected_action then
    raise exception 'ADAPT_ACTION_SCORE_MISMATCH' using errcode = '22023';
  end if;

  v_topic_status := case v_expected_action
    when 'advance' then 'mastered'
    when 'reinforce' then 'in_progress'
    else 'failed'
  end;
  v_next_method := case
    when v_expected_action = 'advance' then v_session.method_used
    when v_session.method_used = 'theory' then 'examples'
    when v_session.method_used = 'examples' then 'analogies'
    else 'theory'
  end;
  v_reinforcement_count := case v_expected_action
    when 'advance' then 0
    when 'reinforce' then 1
    else 2
  end;

  select sp.*
  into v_plan
  from public.study_plans as sp
  where sp.id = v_session.study_plan_id
    and sp.user_id = p_user_id
  for update;

  if not found then
    raise exception 'ADAPT_PLAN_NOT_FOUND' using errcode = '22023';
  end if;

  insert into public.topic_progress (
    user_id,
    study_plan_id,
    topic_code,
    attempts,
    best_score,
    last_score,
    status,
    mastered_at,
    updated_at
  )
  select
    p_user_id,
    v_plan.id,
    topic.topic_code,
    1,
    v_score,
    v_score,
    v_topic_status,
    case when v_expected_action = 'advance' then v_now else null end,
    v_now
  from unnest(v_session.topic_codes) as topic(topic_code)
  on conflict (user_id, study_plan_id, topic_code)
  do update set
    attempts = coalesce(public.topic_progress.attempts, 0) + 1,
    best_score = greatest(
      coalesce(public.topic_progress.best_score, 0),
      excluded.best_score
    ),
    last_score = excluded.last_score,
    status = excluded.status,
    mastered_at = case
      when excluded.status = 'mastered'
        then coalesce(public.topic_progress.mastered_at, excluded.mastered_at)
      else null
    end,
    updated_at = excluded.updated_at;

  select coalesce(max(s.day_number), v_session.day_number)
  into v_max_day
  from public.sessions as s
  where s.study_plan_id = v_plan.id
    and s.user_id = p_user_id;

  if v_reinforcement_count > 0 then
    with inserted as (
      insert into public.sessions (
        study_plan_id,
        user_id,
        topic_codes,
        session_type,
        day_number,
        duration_minutes,
        method_used,
        attempt_number,
        status
      )
      select
        v_plan.id,
        p_user_id,
        v_session.topic_codes,
        'reinforcement',
        v_max_day + ordinal,
        case when v_expected_action = 'reinforce' then 15 else 30 end,
        v_next_method,
        v_session.attempt_number + ordinal,
        'pending'
      from generate_series(1, v_reinforcement_count) as generated(ordinal)
      returning id, day_number
    )
    select array_agg(i.id order by i.day_number)
    into v_reinforcement_ids
    from inserted as i;
  end if;

  if v_expected_action = 'restructure' then
    v_new_estimated_end_date := v_plan.estimated_end_date + 2;
    update public.study_plans
    set
      estimated_end_date = v_new_estimated_end_date,
      updated_at = v_now
    where id = v_plan.id
      and user_id = p_user_id;
  end if;

  v_message := case v_expected_action
    when 'advance' then
      'Dominas los tópicos de esta sesión. El plan continúa sin cambios.'
    when 'reinforce' then
      format(
        'Se agendó una sesión de refuerzo de 15 minutos con método %s.',
        v_next_method
      )
    else
      format(
        'El plan fue reestructurado con 2 sesiones de refuerzo de 30 minutos y método %s.',
        v_next_method
      )
  end;

  v_response := jsonb_build_object(
    'action', v_expected_action,
    'reinforcement_session_ids', to_jsonb(v_reinforcement_ids),
    'new_estimated_end_date', to_jsonb(v_new_estimated_end_date),
    'already_processed', false,
    'message', v_message
  );

  insert into private.session_adaptations (
    source_session_id,
    user_id,
    response_json,
    created_at
  ) values (
    p_session_id,
    p_user_id,
    v_response,
    v_now
  );

  return v_response;
end;
$$;

revoke all on function public.apply_session_adaptation(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_session_adaptation(uuid, uuid)
  to service_role;

comment on table private.session_adaptations is
  'Exactly-once marker and replayable response for a completed session adaptation.';
comment on function public.apply_session_adaptation(uuid, uuid) is
  'Atomically updates topic progress, creates reinforcement sessions, adjusts the plan, and persists an idempotent response.';

reset lock_timeout;
reset statement_timeout;
