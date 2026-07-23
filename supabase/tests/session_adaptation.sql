begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(1);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-0000000002a1',
  'authenticated',
  'authenticated',
  'adaptation@example.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Adaptation Fixture"}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

insert into public.documents (
  id, user_id, file_name, file_url, topics_json
) values (
  '00000000-0000-4000-8000-0000000002a2',
  '00000000-0000-4000-8000-0000000002a1',
  'adaptation.pdf',
  'adaptation/adaptation.pdf',
  '{"FL-1.1.1":{},"FL-2.1.1":{}}'
);

insert into public.study_plans (
  id,
  user_id,
  document_id,
  start_date,
  estimated_end_date,
  plan_json
) values (
  '00000000-0000-4000-8000-0000000002a3',
  '00000000-0000-4000-8000-0000000002a1',
  '00000000-0000-4000-8000-0000000002a2',
  '2026-07-19',
  '2026-07-26',
  '{}'
);

insert into public.sessions (
  id,
  study_plan_id,
  user_id,
  topic_codes,
  session_type,
  day_number,
  completed_at,
  score_percent,
  attempt_number,
  method_used,
  action_taken,
  status
) values (
  '00000000-0000-4000-8000-0000000002a4',
  '00000000-0000-4000-8000-0000000002a3',
  '00000000-0000-4000-8000-0000000002a1',
  array['FL-1.1.1', 'FL-2.1.1'],
  'morning',
  1,
  '2026-07-19T22:13:00Z',
  40,
  1,
  'theory',
  'restructure',
  'completed'
);

set local role service_role;

do $$
declare
  v_first jsonb;
  v_replay jsonb;
begin
  v_first := public.apply_session_adaptation_v2(
    '00000000-0000-4000-8000-0000000002a1',
    '00000000-0000-4000-8000-0000000002a4'
  );

  if v_first ->> 'action' <> 'restructure'
    or v_first ->> 'already_processed' <> 'false'
    or v_first ->> 'new_estimated_end_date' <> '2026-07-28'
    or jsonb_array_length(v_first -> 'reinforcement_session_ids') <> 2
  then
    raise exception 'ADAPT_FIRST_RESPONSE_INVALID: %', v_first;
  end if;

  if (
    select count(*)
    from public.sessions as s
    where s.study_plan_id = '00000000-0000-4000-8000-0000000002a3'
      and s.user_id = '00000000-0000-4000-8000-0000000002a1'
      and s.session_type = 'reinforcement'
      and s.method_used = 'examples'
      and s.duration_minutes = 30
  ) <> 2 then
    raise exception 'ADAPT_REINFORCEMENTS_INVALID';
  end if;

  if (
    select count(*)
    from public.topic_progress as tp
    where tp.study_plan_id = '00000000-0000-4000-8000-0000000002a3'
      and tp.user_id = '00000000-0000-4000-8000-0000000002a1'
      and tp.status = 'failed'
      and tp.attempts = 1
      and tp.last_score = 40
  ) <> 2 then
    raise exception 'ADAPT_TOPIC_PROGRESS_INVALID';
  end if;

  if not exists (
    select 1
    from public.study_plans as sp
    where sp.id = '00000000-0000-4000-8000-0000000002a3'
      and sp.estimated_end_date = '2026-07-28'
  ) then
    raise exception 'ADAPT_PLAN_DATE_NOT_UPDATED';
  end if;

  -- The deployed v1 signature remains a compatibility wrapper during rollout.
  v_replay := public.apply_session_adaptation(
    '00000000-0000-4000-8000-0000000002a1',
    '00000000-0000-4000-8000-0000000002a4'
  );

  if v_replay ->> 'already_processed' <> 'true'
    or v_replay -> 'reinforcement_session_ids'
      is distinct from v_first -> 'reinforcement_session_ids'
    or v_replay -> 'new_estimated_end_date'
      is distinct from v_first -> 'new_estimated_end_date'
  then
    raise exception 'ADAPT_REPLAY_CHANGED_RESULT';
  end if;

  if (
    select count(*)
    from public.sessions as s
    where s.study_plan_id = '00000000-0000-4000-8000-0000000002a3'
      and s.session_type = 'reinforcement'
  ) <> 2 or exists (
    select 1
    from public.topic_progress as tp
    where tp.study_plan_id = '00000000-0000-4000-8000-0000000002a3'
      and tp.attempts <> 1
  ) then
    raise exception 'ADAPT_REPLAY_DUPLICATED_WRITES';
  end if;

  -- Complete the first reinforcement and adapt it. Its child must continue
  -- after the current maximum attempt instead of creating another attempt 3.
  update public.sessions
  set
    status = 'completed',
    completed_at = '2026-07-19T23:00:00Z',
    score_percent = 60,
    action_taken = 'reinforce'
  where id = (v_first #>> '{reinforcement_session_ids,0}')::uuid;

  perform public.apply_session_adaptation_v2(
    '00000000-0000-4000-8000-0000000002a1',
    (v_first #>> '{reinforcement_session_ids,0}')::uuid
  );

  if exists (
    select 1
    from public.sessions as s
    where s.study_plan_id = '00000000-0000-4000-8000-0000000002a3'
    group by
      private.canonical_topic_codes(s.topic_codes),
      s.attempt_number
    having count(*) > 1
  ) or not exists (
    select 1
    from public.sessions as s
    where s.study_plan_id = '00000000-0000-4000-8000-0000000002a3'
      and s.session_type = 'reinforcement'
      and s.attempt_number = 4
  ) then
    raise exception 'ADAPT_CHAIN_ATTEMPT_COLLISION';
  end if;
end;
$$;

reset role;

do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.apply_session_adaptation_v2(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.apply_session_adaptation(uuid,uuid)',
    'EXECUTE'
  ) then
    raise exception 'AUTHENTICATED_ADAPT_RPC_EXECUTE_GRANTED';
  end if;
end;
$$;

select extensions.pass(
  'session adaptation is atomic, server-authoritative, and replayable exactly once'
);
select * from extensions.finish();

rollback;
