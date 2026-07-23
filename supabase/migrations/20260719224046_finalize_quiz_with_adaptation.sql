-- Close the gap between grading and adaptation, and make attempt numbers
-- unique for a canonical topic set within a study plan.

begin;

set lock_timeout = '5s';
set statement_timeout = '2min';

create or replace function private.canonical_topic_codes(p_codes text[])
returns text[]
language sql
immutable
strict
set search_path = ''
as $$
  select coalesce(array_agg(code order by code), array[]::text[])
  from (
    select distinct btrim(code) as code
    from unnest(p_codes) as topics(code)
    where nullif(btrim(code), '') is not null
  ) as canonical;
$$;

revoke all on function private.canonical_topic_codes(text[])
  from public, anon, authenticated;
grant execute on function private.canonical_topic_codes(text[])
  to service_role;

create or replace function private.normalize_session_attempt_numbers()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated integer;
begin
  with ranked as (
    select
      s.id,
      row_number() over (
        partition by
          s.user_id,
          s.study_plan_id,
          private.canonical_topic_codes(s.topic_codes)
        order by s.attempt_number, s.created_at, s.id
      )::integer as normalized_attempt
    from public.sessions as s
  ), updated as (
    update public.sessions as s
    set attempt_number = ranked.normalized_attempt
    from ranked
    where ranked.id = s.id
      and s.attempt_number is distinct from ranked.normalized_attempt
    returning 1
  )
  select count(*)::integer into v_updated
  from updated;

  return v_updated;
end;
$$;

revoke all on function private.normalize_session_attempt_numbers()
  from public, anon, authenticated, service_role;

-- Historical adaptive writes did not serialize attempt assignment. Renumber
-- each topic chain deterministically before enforcing the invariant.
-- EXCLUSIVE also waits for SELECT ... FOR UPDATE used by every adaptation RPC,
-- so progress/child/marker evidence cannot change underneath the backfill.
lock table public.sessions in exclusive mode;

do $$
begin
  if to_regclass('public.sessions_plan_topics_attempt_unique') is null then
    perform private.normalize_session_attempt_numbers();
  end if;
end;
$$;

create unique index if not exists sessions_plan_topics_attempt_unique
  on public.sessions (
    user_id,
    study_plan_id,
    (private.canonical_topic_codes(topic_codes)),
    attempt_number
  );

-- Backfill only adaptations that have complete, observable legacy evidence.
create or replace function private.backfill_session_adaptations()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_nonadvance_inserted integer;
  v_advance_inserted integer;
begin
  with completed_sources as (
    select
      source.id as source_session_id,
      source.user_id,
      source.study_plan_id,
      source.action_taken,
      source.completed_at,
      source.attempt_number,
      plan.estimated_end_date,
      private.canonical_topic_codes(source.topic_codes) as canonical_topics,
      case source.action_taken
        when 'advance' then 0
        when 'reinforce' then 1
        else 2
      end as required_reinforcements
    from public.sessions as source
    join public.study_plans as plan
      on plan.id = source.study_plan_id
     and plan.user_id = source.user_id
    where source.status = 'completed'
      and source.completed_at is not null
      and source.score_percent is not null
      and source.action_taken = case
        when source.score_percent >= 70 then 'advance'
        when source.score_percent >= 50 then 'reinforce'
        else 'restructure'
      end
      and cardinality(private.canonical_topic_codes(source.topic_codes)) > 0
  -- Legacy child rows were inserted immediately after adaptation. A child is
  -- evidence only when exactly one completed source falls in that tight window.
  ), candidate_matches as (
    select
      source.source_session_id,
      child.id as child_session_id,
      child.attempt_number as child_attempt_number,
      abs(extract(epoch from child.created_at - source.completed_at))
        as temporal_distance,
      count(*) over (partition by child.id) as candidate_count
    from completed_sources as source
    join public.sessions as child
      on child.user_id = source.user_id
     and child.study_plan_id = source.study_plan_id
     and private.canonical_topic_codes(child.topic_codes) = source.canonical_topics
     and child.id <> source.source_session_id
     and child.session_type = 'reinforcement'
     and child.attempt_number > source.attempt_number
     and abs(extract(epoch from child.created_at - source.completed_at)) <= 5
    where source.required_reinforcements > 0
  ), owned_children as (
    select
      candidate.source_session_id,
      candidate.child_session_id,
      candidate.child_attempt_number,
      candidate.temporal_distance
    from candidate_matches as candidate
    where candidate.candidate_count = 1
  ), evidence as (
    select
      source.source_session_id,
      source.user_id,
      source.action_taken,
      source.estimated_end_date,
      source.completed_at,
      source.required_reinforcements,
      count(owned.child_session_id)::integer as owned_count,
      coalesce(
        jsonb_agg(
          to_jsonb(owned.child_session_id)
          order by
            owned.temporal_distance,
            owned.child_attempt_number,
            owned.child_session_id
        ) filter (where owned.child_session_id is not null),
        '[]'::jsonb
      ) as reinforcement_session_ids
    from completed_sources as source
    left join owned_children as owned
      on owned.source_session_id = source.source_session_id
    group by
      source.source_session_id,
      source.user_id,
      source.action_taken,
      source.estimated_end_date,
      source.completed_at,
      source.required_reinforcements
  )
  insert into private.session_adaptations (
    source_session_id,
    user_id,
    response_json,
    created_at
  )
  select
    evidence.source_session_id,
    evidence.user_id,
    jsonb_build_object(
      'action', evidence.action_taken,
      'reinforcement_session_ids', evidence.reinforcement_session_ids,
      'new_estimated_end_date', case
        when evidence.action_taken = 'restructure'
          then to_jsonb(evidence.estimated_end_date)
        else null
      end,
      'already_processed', false,
      'message', 'Adaptación histórica reconocida por evidencia persistida.'
    ),
    evidence.completed_at
  from evidence
  where evidence.action_taken <> 'advance'
    and evidence.owned_count = evidence.required_reinforcements
  on conflict (source_session_id) do nothing;

  get diagnostics v_nonadvance_inserted = row_count;

  -- Advance creates no child rows. It is attributable only when every
  -- non-advance source in the chain is already identified and the aggregate
  -- progress count proves that all remaining advance sources ran.
  with completed_sources as (
    select
      source.id as source_session_id,
      source.user_id,
      source.study_plan_id,
      source.action_taken,
      source.completed_at,
      private.canonical_topic_codes(source.topic_codes) as canonical_topics
    from public.sessions as source
    where source.status = 'completed'
      and source.completed_at is not null
      and source.score_percent is not null
      and source.action_taken = case
        when source.score_percent >= 70 then 'advance'
        when source.score_percent >= 50 then 'reinforce'
        else 'restructure'
      end
      and cardinality(private.canonical_topic_codes(source.topic_codes)) > 0
  ), chains as (
    select distinct
      source.user_id,
      source.study_plan_id,
      source.canonical_topics
    from completed_sources as source
  ), chain_progress as (
    select
      chain.user_id,
      chain.study_plan_id,
      chain.canonical_topics,
      case
        when count(progress.topic_code) = 0 then 0
        when count(distinct progress.topic_code) = cardinality(chain.canonical_topics)
          and min(progress.attempts) = max(progress.attempts)
          then min(progress.attempts)
        else -1
      end::integer as progress_attempts
    from chains as chain
    left join public.topic_progress as progress
      on progress.user_id = chain.user_id
     and progress.study_plan_id = chain.study_plan_id
     and progress.topic_code = any(chain.canonical_topics)
    group by chain.user_id, chain.study_plan_id, chain.canonical_topics
  ), chain_state as (
    select
      source.user_id,
      source.study_plan_id,
      source.canonical_topics,
      progress.progress_attempts,
      count(adaptation.source_session_id)::integer as marker_count,
      count(*) filter (
        where source.action_taken <> 'advance'
          and adaptation.source_session_id is null
      )::integer as unmarked_nonadvance_count,
      count(*) filter (
        where source.action_taken = 'advance'
          and adaptation.source_session_id is null
      )::integer as unmarked_advance_count
    from completed_sources as source
    join chain_progress as progress
      on progress.user_id = source.user_id
     and progress.study_plan_id = source.study_plan_id
     and progress.canonical_topics = source.canonical_topics
    left join private.session_adaptations as adaptation
      on adaptation.source_session_id = source.source_session_id
     and adaptation.user_id = source.user_id
    group by
      source.user_id,
      source.study_plan_id,
      source.canonical_topics,
      progress.progress_attempts
  ), attributable_chains as (
    select chain.*
    from chain_state as chain
    where chain.unmarked_nonadvance_count = 0
      and chain.unmarked_advance_count > 0
      and chain.progress_attempts
        = chain.marker_count + chain.unmarked_advance_count
  )
  insert into private.session_adaptations (
    source_session_id,
    user_id,
    response_json,
    created_at
  )
  select
    source.source_session_id,
    source.user_id,
    jsonb_build_object(
      'action', 'advance',
      'reinforcement_session_ids', '[]'::jsonb,
      'new_estimated_end_date', null,
      'already_processed', false,
      'message', 'Adaptación histórica reconocida por evidencia persistida.'
    ),
    source.completed_at
  from completed_sources as source
  join attributable_chains as chain
    on chain.user_id = source.user_id
   and chain.study_plan_id = source.study_plan_id
   and chain.canonical_topics = source.canonical_topics
  left join private.session_adaptations as adaptation
    on adaptation.source_session_id = source.source_session_id
   and adaptation.user_id = source.user_id
  where source.action_taken = 'advance'
    and adaptation.source_session_id is null
  on conflict (source_session_id) do nothing;

  get diagnostics v_advance_inserted = row_count;
  return v_nonadvance_inserted + v_advance_inserted;
end;
$$;

revoke all on function private.backfill_session_adaptations()
  from public, anon, authenticated, service_role;

select private.backfill_session_adaptations();

-- Progress attempt counts prove that adaptation already ran. If its child
-- sessions cannot be linked unambiguously, abort instead of applying it twice.
create or replace function private.assert_no_ambiguous_legacy_adaptations()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    with completed_sources as (
      select
        source.id as source_session_id,
        source.user_id,
        source.study_plan_id,
        private.canonical_topic_codes(source.topic_codes) as canonical_topics
      from public.sessions as source
      where source.status = 'completed'
        and source.completed_at is not null
        and source.score_percent is not null
        and source.action_taken = case
          when source.score_percent >= 70 then 'advance'
          when source.score_percent >= 50 then 'reinforce'
          else 'restructure'
        end
        and cardinality(private.canonical_topic_codes(source.topic_codes)) > 0
    ), chains as (
      select distinct
        source.user_id,
        source.study_plan_id,
        source.canonical_topics
      from completed_sources as source
    ), chain_progress as (
      select
        chain.user_id,
        chain.study_plan_id,
        chain.canonical_topics,
        case
          when count(progress.topic_code) = 0 then 0
          when count(distinct progress.topic_code) = cardinality(chain.canonical_topics)
            and min(progress.attempts) = max(progress.attempts)
            then min(progress.attempts)
          else -1
        end::integer as progress_attempts
      from chains as chain
      left join public.topic_progress as progress
        on progress.user_id = chain.user_id
       and progress.study_plan_id = chain.study_plan_id
       and progress.topic_code = any(chain.canonical_topics)
      group by chain.user_id, chain.study_plan_id, chain.canonical_topics
    ), chain_state as (
      select
        source.user_id,
        source.study_plan_id,
        source.canonical_topics,
        progress.progress_attempts,
        count(adaptation.source_session_id)::integer as marker_count
      from completed_sources as source
      join chain_progress as progress
        on progress.user_id = source.user_id
       and progress.study_plan_id = source.study_plan_id
       and progress.canonical_topics = source.canonical_topics
      left join private.session_adaptations as adaptation
        on adaptation.source_session_id = source.source_session_id
       and adaptation.user_id = source.user_id
      group by
        source.user_id,
        source.study_plan_id,
        source.canonical_topics,
        progress.progress_attempts
    )
    select 1
    from chain_state as chain
    where chain.progress_attempts <> chain.marker_count
  ) then
    raise exception 'LEGACY_ADAPTATION_EVIDENCE_AMBIGUOUS'
      using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.assert_no_ambiguous_legacy_adaptations()
  from public, anon, authenticated, service_role;

select private.assert_no_ambiguous_legacy_adaptations();

-- A database lease prevents parallel Route Handler requests from invoking the
-- LLM more than once before the durable quiz/adaptation RPC can serialize.
create table if not exists private.quiz_ai_operations (
  user_id uuid not null,
  session_id uuid not null,
  operation text not null,
  request_fingerprint text not null,
  state text not null default 'in_progress',
  claim_token uuid not null default gen_random_uuid(),
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, session_id, operation),
  constraint quiz_ai_operations_session_user_fk
    foreign key (session_id, user_id)
    references public.sessions (id, user_id)
    on delete cascade,
  constraint quiz_ai_operations_operation_chk
    check (operation in ('generate', 'evaluate')),
  constraint quiz_ai_operations_fingerprint_chk
    check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  constraint quiz_ai_operations_state_chk
    check (state in ('in_progress', 'completed'))
);

grant select, insert, update, delete on private.quiz_ai_operations
  to service_role;

create or replace function public.claim_quiz_ai_operation(
  p_user_id uuid,
  p_session_id uuid,
  p_operation text,
  p_request_fingerprint text,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim private.quiz_ai_operations%rowtype;
  v_now timestamptz := clock_timestamp();
  v_token uuid := gen_random_uuid();
begin
  if p_user_id is null
    or p_session_id is null
    or p_operation is null
    or p_operation not in ('generate', 'evaluate')
    or p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_lease_seconds is null
    or p_lease_seconds not between 30 and 600
  then
    raise exception 'QUIZ_AI_CLAIM_INVALID' using errcode = '22023';
  end if;

  insert into private.quiz_ai_operations (
    user_id,
    session_id,
    operation,
    request_fingerprint,
    state,
    claim_token,
    lease_expires_at,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_session_id,
    p_operation,
    p_request_fingerprint,
    'in_progress',
    v_token,
    v_now + make_interval(secs => p_lease_seconds),
    v_now,
    v_now
  )
  on conflict (user_id, session_id, operation) do nothing
  returning * into v_claim;

  if found then
    return jsonb_build_object('outcome', 'acquired', 'claim_token', v_token);
  end if;

  select operation_claim.*
  into v_claim
  from private.quiz_ai_operations as operation_claim
  where operation_claim.user_id = p_user_id
    and operation_claim.session_id = p_session_id
    and operation_claim.operation = p_operation
  for update;

  if not found then
    raise exception 'QUIZ_AI_CLAIM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_claim.state = 'completed' then
    return jsonb_build_object(
      'outcome', case
        when v_claim.request_fingerprint = p_request_fingerprint
          then 'completed'
        else 'conflict'
      end,
      'claim_token', null
    );
  end if;

  if v_claim.lease_expires_at <= v_now then
    update private.quiz_ai_operations as operation_claim
    set
      request_fingerprint = p_request_fingerprint,
      claim_token = v_token,
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      updated_at = v_now
    where operation_claim.user_id = p_user_id
      and operation_claim.session_id = p_session_id
      and operation_claim.operation = p_operation;

    return jsonb_build_object('outcome', 'acquired', 'claim_token', v_token);
  end if;

  if v_claim.request_fingerprint <> p_request_fingerprint then
    return jsonb_build_object('outcome', 'conflict', 'claim_token', null);
  end if;

  return jsonb_build_object('outcome', 'in_progress', 'claim_token', null);
end;
$$;

create or replace function public.release_quiz_ai_operation(
  p_user_id uuid,
  p_session_id uuid,
  p_operation text,
  p_request_fingerprint text,
  p_claim_token uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with released as (
    delete from private.quiz_ai_operations as operation_claim
    where operation_claim.user_id = p_user_id
      and operation_claim.session_id = p_session_id
      and operation_claim.operation = p_operation
      and operation_claim.request_fingerprint = p_request_fingerprint
      and operation_claim.claim_token = p_claim_token
      and operation_claim.state = 'in_progress'
    returning 1
  )
  select exists(select 1 from released);
$$;

revoke all on function public.claim_quiz_ai_operation(
  uuid, uuid, text, text, integer
) from public, anon, authenticated;
revoke all on function public.release_quiz_ai_operation(
  uuid, uuid, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.claim_quiz_ai_operation(
  uuid, uuid, text, text, integer
) to service_role;
grant execute on function public.release_quiz_ai_operation(
  uuid, uuid, text, text, uuid
) to service_role;

create or replace function public.apply_session_adaptation_v2(
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
  v_max_attempt integer;
  v_topic_codes text[];
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

  v_topic_codes := private.canonical_topic_codes(v_session.topic_codes);

  if cardinality(v_topic_codes) = 0 then
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

  if exists (
    select 1
    from unnest(v_topic_codes) as topic(topic_code)
    where not exists (
      select 1
      from public.documents as document
      where document.id = v_plan.document_id
        and document.user_id = p_user_id
        and jsonb_typeof(document.topics_json) = 'object'
        and document.topics_json ? topic.topic_code
    )
  ) then
    raise exception 'ADAPT_TOPICS_INVALID' using errcode = '22023';
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
  from unnest(v_topic_codes) as topic(topic_code)
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

  select coalesce(max(s.attempt_number), 0)
  into v_max_attempt
  from public.sessions as s
  where s.study_plan_id = v_plan.id
    and s.user_id = p_user_id
    and private.canonical_topic_codes(s.topic_codes)
      = v_topic_codes;

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
        v_topic_codes,
        'reinforcement',
        v_max_day + ordinal,
        case when v_expected_action = 'reinforce' then 15 else 30 end,
        v_next_method,
        v_max_attempt + ordinal,
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

create or replace function public.finalize_quiz_and_adapt(
  p_user_id uuid,
  p_session_id uuid,
  p_attempt_id uuid,
  p_answers jsonb,
  p_qualitative jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session_status text;
  v_finalization jsonb;
  v_adaptation jsonb;
begin
  select s.status
  into v_session_status
  from public.sessions as s
  where s.id = p_session_id
    and s.user_id = p_user_id;

  if not found then
    raise exception 'QUIZ_ATTEMPT_NOT_FOUND' using errcode = '22023';
  end if;

  if v_session_status not in ('active', 'completed') then
    raise exception 'QUIZ_SESSION_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  v_finalization := public.finalize_quiz_attempt(
    p_user_id,
    p_session_id,
    p_attempt_id,
    p_answers,
    p_qualitative
  );
  v_adaptation := public.apply_session_adaptation_v2(
    p_user_id,
    p_session_id
  );

  return v_finalization || jsonb_build_object('adaptation', v_adaptation);
end;
$$;

create or replace function private.lock_quiz_ai_operation(
  p_user_id uuid,
  p_session_id uuid,
  p_operation text,
  p_request_fingerprint text,
  p_claim_token uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform 1
  from private.quiz_ai_operations as operation_claim
  where operation_claim.user_id = p_user_id
    and operation_claim.session_id = p_session_id
    and operation_claim.operation = p_operation
    and operation_claim.request_fingerprint = p_request_fingerprint
    and operation_claim.claim_token = p_claim_token
    and operation_claim.state = 'in_progress'
    and operation_claim.lease_expires_at > clock_timestamp()
  for update;

  if not found then
    raise exception 'QUIZ_AI_CLAIM_NOT_OWNED' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function private.lock_quiz_ai_operation(
  uuid, uuid, text, text, uuid
) from public, anon, authenticated;
grant execute on function private.lock_quiz_ai_operation(
  uuid, uuid, text, text, uuid
) to service_role;

create or replace function public.store_quiz_attempt_claimed(
  p_user_id uuid,
  p_session_id uuid,
  p_questions jsonb,
  p_model_provider text,
  p_model_name text,
  p_generated_at timestamptz,
  p_request_fingerprint text,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.lock_quiz_ai_operation(
    p_user_id,
    p_session_id,
    'generate',
    p_request_fingerprint,
    p_claim_token
  );

  v_result := public.store_quiz_attempt(
    p_user_id,
    p_session_id,
    p_questions,
    p_model_provider,
    p_model_name,
    p_generated_at
  );

  update private.quiz_ai_operations as operation_claim
  set
    state = 'completed',
    lease_expires_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where operation_claim.user_id = p_user_id
    and operation_claim.session_id = p_session_id
    and operation_claim.operation = 'generate'
    and operation_claim.request_fingerprint = p_request_fingerprint
    and operation_claim.claim_token = p_claim_token
    and operation_claim.state = 'in_progress';

  if not found then
    raise exception 'QUIZ_AI_CLAIM_NOT_OWNED' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

create or replace function public.finalize_quiz_and_adapt_claimed(
  p_user_id uuid,
  p_session_id uuid,
  p_attempt_id uuid,
  p_answers jsonb,
  p_qualitative jsonb,
  p_request_fingerprint text,
  p_claim_token uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.lock_quiz_ai_operation(
    p_user_id,
    p_session_id,
    'evaluate',
    p_request_fingerprint,
    p_claim_token
  );

  v_result := public.finalize_quiz_and_adapt(
    p_user_id,
    p_session_id,
    p_attempt_id,
    p_answers,
    p_qualitative
  );

  update private.quiz_ai_operations as operation_claim
  set
    state = 'completed',
    lease_expires_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where operation_claim.user_id = p_user_id
    and operation_claim.session_id = p_session_id
    and operation_claim.operation = 'evaluate'
    and operation_claim.request_fingerprint = p_request_fingerprint
    and operation_claim.claim_token = p_claim_token
    and operation_claim.state = 'in_progress';

  if not found then
    raise exception 'QUIZ_AI_CLAIM_NOT_OWNED' using errcode = 'P0001';
  end if;

  return v_result;
end;
$$;

-- Preserve the deployed v1 signature during rollout while routing every old
-- caller through the same serialized implementation.
create or replace function public.apply_session_adaptation(
  p_user_id uuid,
  p_session_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.apply_session_adaptation_v2(p_user_id, p_session_id);
$$;

revoke all on function public.apply_session_adaptation(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.apply_session_adaptation_v2(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_quiz_and_adapt(
  uuid, uuid, uuid, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.store_quiz_attempt_claimed(
  uuid, uuid, jsonb, text, text, timestamptz, text, uuid
) from public, anon, authenticated;
revoke all on function public.finalize_quiz_and_adapt_claimed(
  uuid, uuid, uuid, jsonb, jsonb, text, uuid
) from public, anon, authenticated;

grant execute on function public.apply_session_adaptation_v2(uuid, uuid)
  to service_role;
grant execute on function public.apply_session_adaptation(uuid, uuid)
  to service_role;
grant execute on function public.finalize_quiz_and_adapt(
  uuid, uuid, uuid, jsonb, jsonb
) to service_role;
grant execute on function public.store_quiz_attempt_claimed(
  uuid, uuid, jsonb, text, text, timestamptz, text, uuid
) to service_role;
grant execute on function public.finalize_quiz_and_adapt_claimed(
  uuid, uuid, uuid, jsonb, jsonb, text, uuid
) to service_role;

comment on index public.sessions_plan_topics_attempt_unique is
  'A canonical topic chain cannot contain duplicate attempt numbers.';
comment on function public.apply_session_adaptation_v2(uuid, uuid) is
  'Exactly-once adaptation with plan-serialized, collision-free attempt numbering.';
comment on function public.apply_session_adaptation(uuid, uuid) is
  'Deprecated rollout bridge. Remove service_role EXECUTE after all callers use apply_session_adaptation_v2.';
comment on function public.finalize_quiz_and_adapt(uuid, uuid, uuid, jsonb, jsonb) is
  'Finalizes grading and applies adaptation in the same PostgREST transaction.';
comment on function public.store_quiz_attempt_claimed(
  uuid, uuid, jsonb, text, text, timestamptz, text, uuid
) is 'Persists a generated quiz only for the current, unexpired fenced AI lease.';
comment on function public.finalize_quiz_and_adapt_claimed(
  uuid, uuid, uuid, jsonb, jsonb, text, uuid
) is 'Finalizes grading and adaptation only for the current, unexpired fenced AI lease.';

reset lock_timeout;
reset statement_timeout;

commit;
