-- Quiz authority boundary: answer keys live outside the Data API and only
-- server-side RPCs can create, read, or finalize an attempt.

set lock_timeout = '5s';
set statement_timeout = '2min';

create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

alter default privileges for role postgres in schema private
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private
  revoke all on sequences from public, anon, authenticated;

-- New public objects must opt in to Data API access explicitly.
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;

-- Defaults in the original schema allowed NULL legacy values even though the
-- application requires these fields for deterministic evaluation/adaptation.
update public.sessions
set
  method_used = coalesce(method_used, 'theory'),
  attempt_number = case
    when attempt_number is null or attempt_number < 1 then 1
    else attempt_number
  end,
  status = coalesce(status, 'pending')
where method_used is null
   or attempt_number is null
   or attempt_number < 1
   or status is null;

alter table public.sessions
  alter column method_used set not null,
  alter column attempt_number set not null,
  alter column status set not null,
  add constraint sessions_attempt_number_chk check (attempt_number >= 1);

create table private.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  user_id uuid not null,
  status text not null default 'open',
  model_provider text not null,
  model_name text not null,
  generated_at timestamptz not null default now(),
  canonical_submission jsonb,
  response_json jsonb,
  completed_at timestamptz,

  constraint quiz_attempts_session_unique unique (session_id),
  constraint quiz_attempts_identity_unique unique (id, session_id, user_id),
  constraint quiz_attempts_session_user_fk
    foreign key (session_id, user_id)
    references public.sessions (id, user_id)
    on delete cascade,
  constraint quiz_attempts_status_chk
    check (status in ('open', 'completed')),
  constraint quiz_attempts_model_provider_chk
    check (char_length(btrim(model_provider)) between 1 and 100),
  constraint quiz_attempts_model_name_chk
    check (char_length(btrim(model_name)) between 1 and 200),
  constraint quiz_attempts_state_chk check (
    (
      status = 'open'
      and canonical_submission is null
      and response_json is null
      and completed_at is null
    )
    or
    (
      status = 'completed'
      and canonical_submission is not null
      and response_json is not null
      and completed_at is not null
    )
  )
);

create table private.quiz_attempt_questions (
  quiz_attempt_id uuid not null
    references private.quiz_attempts (id) on delete cascade,
  question_id integer not null,
  question_text text not null,
  options_json jsonb not null,
  correct_answer text not null,
  explanation text not null,
  topic_code text not null,
  topic_name text not null,
  level_k text not null,

  primary key (quiz_attempt_id, question_id),
  constraint quiz_attempt_questions_id_chk check (question_id >= 0),
  constraint quiz_attempt_questions_text_chk
    check (char_length(btrim(question_text)) >= 10),
  constraint quiz_attempt_questions_options_chk check (
    jsonb_typeof(options_json) = 'object'
    and options_json ?& array['a', 'b', 'c', 'd']
    and (options_json - 'a' - 'b' - 'c' - 'd') = '{}'::jsonb
    and jsonb_typeof(options_json -> 'a') = 'string'
    and jsonb_typeof(options_json -> 'b') = 'string'
    and jsonb_typeof(options_json -> 'c') = 'string'
    and jsonb_typeof(options_json -> 'd') = 'string'
    and char_length(btrim(options_json ->> 'a')) >= 3
    and char_length(btrim(options_json ->> 'b')) >= 3
    and char_length(btrim(options_json ->> 'c')) >= 3
    and char_length(btrim(options_json ->> 'd')) >= 3
  ),
  constraint quiz_attempt_questions_correct_chk
    check (correct_answer in ('a', 'b', 'c', 'd')),
  constraint quiz_attempt_questions_explanation_chk
    check (char_length(btrim(explanation)) >= 20),
  constraint quiz_attempt_questions_topic_code_chk
    check (char_length(btrim(topic_code)) between 1 and 100),
  constraint quiz_attempt_questions_topic_name_chk
    check (char_length(btrim(topic_name)) between 1 and 500),
  constraint quiz_attempt_questions_level_k_chk
    check (level_k in ('K1', 'K2', 'K3'))
);

grant select, insert, update on private.quiz_attempts to service_role;
grant select, insert on private.quiz_attempt_questions to service_role;

alter table public.answers
  add column quiz_attempt_id uuid,
  add column question_id integer;

alter table public.answers
  add constraint answers_quiz_identity_pair_chk check (
    (quiz_attempt_id is null and question_id is null)
    or (quiz_attempt_id is not null and question_id is not null)
  ),
  add constraint answers_quiz_question_fk
    foreign key (quiz_attempt_id, question_id)
    references private.quiz_attempt_questions (quiz_attempt_id, question_id),
  add constraint answers_quiz_attempt_identity_fk
    foreign key (quiz_attempt_id, session_id, user_id)
    references private.quiz_attempts (id, session_id, user_id),
  add constraint answers_is_correct_consistent_chk
    check (is_correct = (user_answer = correct_answer)) not valid;

-- is_correct is derived, so historical inconsistencies can be repaired without
-- changing either the submitted answer or the stored answer key.
update public.answers
set is_correct = (user_answer = correct_answer)
where is_correct is distinct from (user_answer = correct_answer);

alter table public.answers
  validate constraint answers_is_correct_consistent_chk;

create unique index answers_quiz_question_unique
  on public.answers (quiz_attempt_id, question_id)
  where quiz_attempt_id is not null;

create or replace function public.get_quiz_attempt_public(
  p_user_id uuid,
  p_session_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempt private.quiz_attempts%rowtype;
begin
  select qa.*
  into v_attempt
  from private.quiz_attempts as qa
  where qa.session_id = p_session_id
    and qa.user_id = p_user_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'state', v_attempt.status,
    'evaluation', v_attempt.response_json,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'question_id', q.question_id,
          'question', q.question_text,
          'options', q.options_json,
          'topic_code', q.topic_code,
          'level_k', q.level_k
        )
        order by q.question_id
      )
      from private.quiz_attempt_questions as q
      where q.quiz_attempt_id = v_attempt.id
    ), '[]'::jsonb),
    'total_questions', (
      select count(*)
      from private.quiz_attempt_questions as q
      where q.quiz_attempt_id = v_attempt.id
    ),
    'generated_at', v_attempt.generated_at,
    'model_provider', v_attempt.model_provider,
    'model_name', v_attempt.model_name
  );
end;
$$;

create or replace function public.store_quiz_attempt(
  p_user_id uuid,
  p_session_id uuid,
  p_questions jsonb,
  p_model_provider text,
  p_model_name text,
  p_generated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.sessions%rowtype;
  v_attempt private.quiz_attempts%rowtype;
  v_question_count integer;
  v_public jsonb;
begin
  if p_user_id is null or p_session_id is null then
    raise exception 'QUIZ_IDENTITY_REQUIRED' using errcode = '22023';
  end if;

  select s.*
  into v_session
  from public.sessions as s
  where s.id = p_session_id
    and s.user_id = p_user_id
  for update;

  if not found then
    raise exception 'QUIZ_SESSION_NOT_FOUND' using errcode = '22023';
  end if;

  if v_session.status = 'completed' then
    raise exception 'QUIZ_SESSION_COMPLETED' using errcode = 'P0001';
  end if;

  select qa.*
  into v_attempt
  from private.quiz_attempts as qa
  where qa.session_id = p_session_id
    and qa.user_id = p_user_id;

  if found then
    v_public := public.get_quiz_attempt_public(p_user_id, p_session_id);
    return v_public || jsonb_build_object('created', false);
  end if;

  if jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'QUIZ_QUESTIONS_INVALID' using errcode = '22023';
  end if;

  if jsonb_array_length(p_questions) not between 10 and 12 then
    raise exception 'QUIZ_QUESTIONS_INVALID' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_questions) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or jsonb_typeof(item.value -> 'question_id') <> 'number'
      or (item.value ->> 'question_id') !~ '^[0-9]+$'
  ) then
    raise exception 'QUIZ_QUESTIONS_INVALID' using errcode = '22023';
  end if;

  insert into private.quiz_attempts (
    session_id,
    user_id,
    model_provider,
    model_name,
    generated_at
  ) values (
    p_session_id,
    p_user_id,
    p_model_provider,
    p_model_name,
    coalesce(p_generated_at, clock_timestamp())
  )
  returning * into v_attempt;

  insert into private.quiz_attempt_questions (
    quiz_attempt_id,
    question_id,
    question_text,
    options_json,
    correct_answer,
    explanation,
    topic_code,
    topic_name,
    level_k
  )
  select
    v_attempt.id,
    (item.value ->> 'question_id')::integer,
    item.value ->> 'question',
    item.value -> 'options',
    item.value ->> 'correct',
    item.value ->> 'explanation',
    item.value ->> 'topic_code',
    item.value ->> 'topic_name',
    item.value ->> 'level_k'
  from jsonb_array_elements(p_questions) as item(value);

  select count(*)
  into v_question_count
  from private.quiz_attempt_questions as q
  where q.quiz_attempt_id = v_attempt.id;

  if v_question_count <> jsonb_array_length(p_questions)
    or exists (
      select 1
      from generate_series(0, v_question_count - 1) as expected(question_id)
      left join private.quiz_attempt_questions as q
        on q.quiz_attempt_id = v_attempt.id
       and q.question_id = expected.question_id
      where q.question_id is null
    )
  then
    raise exception 'QUIZ_QUESTION_IDS_INVALID' using errcode = '22023';
  end if;

  v_public := public.get_quiz_attempt_public(p_user_id, p_session_id);
  return v_public || jsonb_build_object('created', true);
end;
$$;

create or replace function public.get_quiz_attempt_private(
  p_user_id uuid,
  p_session_id uuid,
  p_attempt_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_attempt private.quiz_attempts%rowtype;
begin
  select qa.*
  into v_attempt
  from private.quiz_attempts as qa
  where qa.id = p_attempt_id
    and qa.session_id = p_session_id
    and qa.user_id = p_user_id;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'state', v_attempt.status,
    'method_used', (
      select s.method_used
      from public.sessions as s
      where s.id = v_attempt.session_id
        and s.user_id = v_attempt.user_id
    ),
    'attempt_number', (
      select s.attempt_number
      from public.sessions as s
      where s.id = v_attempt.session_id
        and s.user_id = v_attempt.user_id
    ),
    'canonical_submission', v_attempt.canonical_submission,
    'response', v_attempt.response_json,
    'questions', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'question_id', q.question_id,
          'question', q.question_text,
          'options', q.options_json,
          'correct', q.correct_answer,
          'explanation', q.explanation,
          'topic_code', q.topic_code,
          'topic_name', q.topic_name,
          'level_k', q.level_k
        )
        order by q.question_id
      )
      from private.quiz_attempt_questions as q
      where q.quiz_attempt_id = v_attempt.id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.finalize_quiz_attempt(
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
  v_session public.sessions%rowtype;
  v_attempt private.quiz_attempts%rowtype;
  v_total integer;
  v_answer_count integer;
  v_distinct_count integer;
  v_correct integer;
  v_score integer;
  v_action text;
  v_next_method text;
  v_reinforcement_minutes integer;
  v_evaluated_at timestamptz;
  v_canonical jsonb;
  v_error_patterns jsonb;
  v_feedback_message text;
  v_failed_topics jsonb;
  v_question_results jsonb;
  v_response jsonb;
begin
  if p_user_id is null or p_session_id is null or p_attempt_id is null then
    raise exception 'QUIZ_IDENTITY_REQUIRED' using errcode = '22023';
  end if;

  select s.*
  into v_session
  from public.sessions as s
  where s.id = p_session_id
    and s.user_id = p_user_id
  for update;

  if not found then
    raise exception 'QUIZ_ATTEMPT_NOT_FOUND' using errcode = '22023';
  end if;

  select qa.*
  into v_attempt
  from private.quiz_attempts as qa
  where qa.id = p_attempt_id
    and qa.session_id = p_session_id
    and qa.user_id = p_user_id
  for update;

  if not found then
    raise exception 'QUIZ_ATTEMPT_NOT_FOUND' using errcode = '22023';
  end if;

  select count(*)
  into v_total
  from private.quiz_attempt_questions as q
  where q.quiz_attempt_id = p_attempt_id;

  if jsonb_typeof(p_answers) is distinct from 'array' then
    raise exception 'QUIZ_SUBMISSION_INVALID' using errcode = '22023';
  end if;

  if jsonb_array_length(p_answers) <> v_total then
    raise exception 'QUIZ_SUBMISSION_INVALID' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_answers) as item(value)
    where jsonb_typeof(item.value) <> 'object'
      or not (item.value ? 'question_id')
      or not (item.value ? 'user_answer')
      or (
        select count(*)
        from jsonb_object_keys(item.value)
      ) <> 2
      or jsonb_typeof(item.value -> 'question_id') <> 'number'
      or (item.value ->> 'question_id') !~ '^[0-9]+$'
      or jsonb_typeof(item.value -> 'user_answer') <> 'string'
      or (item.value ->> 'user_answer') not in ('a', 'b', 'c', 'd')
  ) then
    raise exception 'QUIZ_SUBMISSION_INVALID' using errcode = '22023';
  end if;

  select
    count(*),
    count(distinct (item.value ->> 'question_id')::integer)
  into v_answer_count, v_distinct_count
  from jsonb_array_elements(p_answers) as item(value);

  if v_answer_count <> v_total
    or v_distinct_count <> v_total
    or exists (
      select 1
      from jsonb_array_elements(p_answers) as item(value)
      left join private.quiz_attempt_questions as q
        on q.quiz_attempt_id = p_attempt_id
       and q.question_id = (item.value ->> 'question_id')::integer
      where q.question_id is null
    )
  then
    raise exception 'QUIZ_SUBMISSION_INVALID' using errcode = '22023';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'question_id', (item.value ->> 'question_id')::integer,
      'user_answer', item.value ->> 'user_answer'
    )
    order by (item.value ->> 'question_id')::integer
  )
  into v_canonical
  from jsonb_array_elements(p_answers) as item(value);

  if v_attempt.status = 'completed' then
    if v_attempt.canonical_submission = v_canonical then
      return jsonb_build_object(
        'outcome', 'duplicate',
        'evaluation', v_attempt.response_json
      );
    end if;

    raise exception 'QUIZ_REPLAY_CONFLICT' using errcode = 'P0001';
  end if;

  if v_session.status = 'completed' then
    raise exception 'QUIZ_SESSION_COMPLETED_WITHOUT_ATTEMPT'
      using errcode = 'P0001';
  end if;

  if jsonb_typeof(p_qualitative) is distinct from 'object'
    or jsonb_typeof(p_qualitative -> 'error_patterns') is distinct from 'array'
    or (
      select count(*)
      from jsonb_object_keys(p_qualitative)
    ) <> 1
  then
    raise exception 'QUIZ_QUALITATIVE_INVALID' using errcode = '22023';
  end if;

  v_error_patterns := p_qualitative -> 'error_patterns';

  if jsonb_array_length(v_error_patterns) > 5
    or exists (
      select 1
      from jsonb_array_elements(v_error_patterns) as item(value)
      where jsonb_typeof(item.value) <> 'object'
        or not (item.value ? 'pattern')
        or not (item.value ? 'frequency')
        or not (item.value ? 'suggestion')
        or (
          select count(*)
          from jsonb_object_keys(item.value)
        ) <> 3
        or jsonb_typeof(item.value -> 'pattern') is distinct from 'string'
        or char_length(btrim(item.value ->> 'pattern')) not between 1 and 500
        or jsonb_typeof(item.value -> 'frequency') is distinct from 'string'
        or (item.value ->> 'frequency') not in ('alta', 'media', 'baja')
        or jsonb_typeof(item.value -> 'suggestion') is distinct from 'string'
        or char_length(btrim(item.value ->> 'suggestion')) not between 1 and 1000
    )
  then
    raise exception 'QUIZ_QUALITATIVE_INVALID' using errcode = '22023';
  end if;

  select count(*) filter (
    where item.value ->> 'user_answer' = q.correct_answer
  )
  into v_correct
  from jsonb_array_elements(v_canonical) as item(value)
  join private.quiz_attempt_questions as q
    on q.quiz_attempt_id = p_attempt_id
   and q.question_id = (item.value ->> 'question_id')::integer;

  v_score := round(100.0 * v_correct / v_total)::integer;
  v_action := case
    when v_score >= 70 then 'advance'
    when v_score >= 50 then 'reinforce'
    else 'restructure'
  end;
  v_next_method := case
    when v_action = 'advance' then v_session.method_used
    when v_session.method_used = 'theory' then 'examples'
    when v_session.method_used = 'examples' then 'analogies'
    else 'theory'
  end;
  v_reinforcement_minutes := case
    when v_action = 'advance' then 0
    when v_action = 'reinforce' then 15
    else 30
  end;
  if v_score = 100 then
    v_error_patterns := '[]'::jsonb;
  end if;
  v_feedback_message := case
    when v_action = 'advance' then
      format(
        'Obtuviste %s%% (%s de %s correctas). Has demostrado un buen dominio de los conceptos.',
        v_score,
        v_correct,
        v_total
      )
    when v_action = 'reinforce' then
      format(
        'Obtuviste %s%% (%s de %s correctas). Una sesión de refuerzo te ayudará a consolidar los conceptos.',
        v_score,
        v_correct,
        v_total
      )
    else
      format(
        'Obtuviste %s%% (%s de %s correctas). Revisa los tópicos fallidos con un enfoque diferente.',
        v_score,
        v_correct,
        v_total
      )
  end;
  v_evaluated_at := clock_timestamp();

  insert into public.answers (
    session_id,
    user_id,
    question_text,
    options_json,
    correct_answer,
    user_answer,
    is_correct,
    topic_code,
    level_k,
    explanation,
    quiz_attempt_id,
    question_id
  )
  select
    p_session_id,
    p_user_id,
    q.question_text,
    q.options_json,
    q.correct_answer,
    item.value ->> 'user_answer',
    item.value ->> 'user_answer' = q.correct_answer,
    q.topic_code,
    q.level_k,
    q.explanation,
    p_attempt_id,
    q.question_id
  from jsonb_array_elements(v_canonical) as item(value)
  join private.quiz_attempt_questions as q
    on q.quiz_attempt_id = p_attempt_id
   and q.question_id = (item.value ->> 'question_id')::integer;

  with graded as (
    select
      q.topic_code,
      q.topic_name,
      item.value ->> 'user_answer' = q.correct_answer as is_correct
    from jsonb_array_elements(v_canonical) as item(value)
    join private.quiz_attempt_questions as q
      on q.quiz_attempt_id = p_attempt_id
     and q.question_id = (item.value ->> 'question_id')::integer
  ), failed as (
    select
      g.topic_code,
      max(g.topic_name) as topic_name,
      count(*) filter (where not g.is_correct) as questions_failed,
      count(*) as questions_total
    from graded as g
    group by g.topic_code
    having count(*) filter (where not g.is_correct) > 0
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'topic_code', f.topic_code,
      'topic_name', f.topic_name,
      'questions_failed', f.questions_failed,
      'questions_total', f.questions_total
    )
    order by f.topic_code
  ), '[]'::jsonb)
  into v_failed_topics
  from failed as f;

  select jsonb_agg(
    jsonb_build_object(
      'question_id', q.question_id,
      'question', q.question_text,
      'options', q.options_json,
      'user_answer', item.value ->> 'user_answer',
      'correct', q.correct_answer,
      'is_correct', item.value ->> 'user_answer' = q.correct_answer,
      'explanation', q.explanation,
      'topic_code', q.topic_code,
      'level_k', q.level_k
    )
    order by q.question_id
  )
  into v_question_results
  from jsonb_array_elements(v_canonical) as item(value)
  join private.quiz_attempt_questions as q
    on q.quiz_attempt_id = p_attempt_id
   and q.question_id = (item.value ->> 'question_id')::integer;

  v_response := jsonb_build_object(
    'score', v_score,
    'correct_count', v_correct,
    'total_questions', v_total,
    'action', v_action,
    'failed_topics', v_failed_topics,
    'error_patterns', v_error_patterns,
    'feedback_message', v_feedback_message,
    'next_method', v_next_method,
    'reinforcement_minutes', v_reinforcement_minutes,
    'evaluated_at', v_evaluated_at,
    'question_results', v_question_results
  );

  update public.sessions
  set
    score_percent = v_score,
    action_taken = v_action,
    status = 'completed',
    completed_at = v_evaluated_at
  where id = p_session_id
    and user_id = p_user_id;

  update private.quiz_attempts
  set
    status = 'completed',
    canonical_submission = v_canonical,
    response_json = v_response,
    completed_at = v_evaluated_at
  where id = p_attempt_id;

  return jsonb_build_object(
    'outcome', 'finalized',
    'evaluation', v_response
  );
end;
$$;

revoke all on function public.get_quiz_attempt_public(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.store_quiz_attempt(
  uuid, uuid, jsonb, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.get_quiz_attempt_private(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.finalize_quiz_attempt(
  uuid, uuid, uuid, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.get_quiz_attempt_public(uuid, uuid)
  to service_role;
grant execute on function public.store_quiz_attempt(
  uuid, uuid, jsonb, text, text, timestamptz
) to service_role;
grant execute on function public.get_quiz_attempt_private(uuid, uuid, uuid)
  to service_role;
grant execute on function public.finalize_quiz_attempt(
  uuid, uuid, uuid, jsonb, jsonb
) to service_role;

-- Browser sessions keep read access under RLS, but all academic mutations must
-- cross an authenticated Route Handler and use service_role after authorization.
revoke all on table
  public.documents,
  public.study_plans,
  public.sessions,
  public.answers,
  public.topic_progress
from public, anon, authenticated;

grant select on table
  public.documents,
  public.study_plans,
  public.sessions,
  public.answers,
  public.topic_progress
to authenticated;

comment on schema private is
  'Server-only data that must never be exposed through the Supabase Data API.';
comment on table private.quiz_attempts is
  'Durable, immutable quiz attempt authority and replayable evaluation result.';
comment on table private.quiz_attempt_questions is
  'Private answer-key snapshot for a quiz attempt.';
comment on function public.finalize_quiz_attempt(uuid, uuid, uuid, jsonb, jsonb) is
  'Atomically grades an authoritative snapshot, inserts answers, completes the session, and returns an idempotent result.';

reset lock_timeout;
reset statement_timeout;
