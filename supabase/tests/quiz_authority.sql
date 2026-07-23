begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(1);

do $$
declare
  table_name text;
  privilege_name text;
begin
  if not exists (
    select 1
    from pg_catalog.pg_namespace
    where nspname = 'private'
  ) then
    raise exception 'MISSING_PRIVATE_SCHEMA';
  end if;

  if has_schema_privilege('anon', 'private', 'USAGE')
    or has_schema_privilege('authenticated', 'private', 'USAGE')
  then
    raise exception 'PRIVATE_SCHEMA_EXPOSED';
  end if;

  foreach table_name in array array[
    'documents',
    'study_plans',
    'sessions',
    'answers',
    'topic_progress'
  ] loop
    foreach privilege_name in array array[
      'INSERT',
      'UPDATE',
      'DELETE',
      'TRUNCATE',
      'REFERENCES',
      'TRIGGER',
      'MAINTAIN'
    ] loop
      if has_table_privilege(
        'authenticated',
        'public.' || table_name,
        privilege_name
      ) then
        raise exception 'AUTHENTICATED_ACADEMIC_PRIVILEGE_GRANTED: %.%',
          table_name,
          privilege_name;
      end if;
    end loop;
  end loop;

  if has_function_privilege(
    'authenticated',
    'public.get_quiz_attempt_public(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.store_quiz_attempt(uuid,uuid,jsonb,text,text,timestamptz)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.get_quiz_attempt_private(uuid,uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.finalize_quiz_attempt(uuid,uuid,uuid,jsonb,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.finalize_quiz_and_adapt(uuid,uuid,uuid,jsonb,jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.claim_quiz_ai_operation(uuid,uuid,text,text,integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.store_quiz_attempt_claimed(uuid,uuid,jsonb,text,text,timestamptz,text,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.finalize_quiz_and_adapt_claimed(uuid,uuid,uuid,jsonb,jsonb,text,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.release_quiz_ai_operation(uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'AUTHENTICATED_QUIZ_RPC_EXECUTE_GRANTED';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.finalize_quiz_and_adapt_claimed(uuid,uuid,uuid,jsonb,jsonb,text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'SERVICE_ROLE_QUIZ_RPC_EXECUTE_MISSING';
  end if;
end;
$$;

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
  '00000000-0000-4000-8000-0000000001a1',
  'authenticated',
  'authenticated',
  'quiz-authority@example.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Quiz Authority"}',
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
  '00000000-0000-4000-8000-0000000001a2',
  '00000000-0000-4000-8000-0000000001a1',
  'quiz.pdf',
  'quiz-authority/quiz.pdf',
  '{"FL-1.1.1":{},"FL-2.1.1":{}}'
);

insert into public.study_plans (
  id, user_id, document_id, start_date, estimated_end_date, plan_json
) values (
  '00000000-0000-4000-8000-0000000001a3',
  '00000000-0000-4000-8000-0000000001a1',
  '00000000-0000-4000-8000-0000000001a2',
  current_date,
  current_date + 7,
  '{}'
);

insert into public.sessions (
  id,
  study_plan_id,
  user_id,
  topic_codes,
  session_type,
  day_number,
  method_used,
  attempt_number,
  status
) values (
  '00000000-0000-4000-8000-0000000001a4',
  '00000000-0000-4000-8000-0000000001a3',
  '00000000-0000-4000-8000-0000000001a1',
  array['FL-1.1.1', 'FL-2.1.1'],
  'morning',
  1,
  'theory',
  1,
  'active'
);

set local role service_role;

do $$
declare
  v_questions jsonb;
  v_answers jsonb;
  v_answers_reversed jsonb;
  v_changed_answers jsonb;
  v_public jsonb;
  v_cached jsonb;
  v_private jsonb;
  v_finalized jsonb;
  v_duplicate jsonb;
  v_claim jsonb;
  v_claim_retry jsonb;
  v_claim_token uuid;
  v_claim_retry_token uuid;
  v_attempt_id uuid;
  v_stale_write_rejected boolean := false;
  v_replay_rejected boolean := false;
  v_private_field_rejected boolean := false;
  v_invalid_pattern_rejected boolean := false;
begin
  v_claim := public.claim_quiz_ai_operation(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4',
    'generate',
    repeat('a', 64),
    180
  );
  v_claim_token := (v_claim ->> 'claim_token')::uuid;

  if v_claim ->> 'outcome' <> 'acquired'
    or v_claim_token is null
    or public.claim_quiz_ai_operation(
      '00000000-0000-4000-8000-0000000001a1',
      '00000000-0000-4000-8000-0000000001a4',
      'generate',
      repeat('a', 64),
      180
    ) ->> 'outcome' <> 'in_progress'
    or public.claim_quiz_ai_operation(
      '00000000-0000-4000-8000-0000000001a1',
      '00000000-0000-4000-8000-0000000001a4',
      'generate',
      repeat('b', 64),
      180
    ) ->> 'outcome' <> 'conflict'
  then
    raise exception 'QUIZ_AI_CLAIM_NOT_SERIALIZED';
  end if;

  update private.quiz_ai_operations
  set lease_expires_at = clock_timestamp() - interval '1 second'
  where user_id = '00000000-0000-4000-8000-0000000001a1'
    and session_id = '00000000-0000-4000-8000-0000000001a4'
    and operation = 'generate';

  v_claim_retry := public.claim_quiz_ai_operation(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4',
    'generate',
    repeat('b', 64),
    180
  );
  v_claim_retry_token := (v_claim_retry ->> 'claim_token')::uuid;

  if v_claim_retry ->> 'outcome' <> 'acquired'
    or v_claim_retry_token = v_claim_token
    or public.release_quiz_ai_operation(
      '00000000-0000-4000-8000-0000000001a1',
      '00000000-0000-4000-8000-0000000001a4',
      'generate',
      repeat('a', 64),
      v_claim_token
    )
  then
    raise exception 'QUIZ_AI_EXPIRED_CLAIM_NOT_REPLACED';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'question_id', i,
      'question', 'Pregunta autoritativa número ' || i || ' sobre testing',
      'options', jsonb_build_object(
        'a', 'Opción A ' || i,
        'b', 'Opción B ' || i,
        'c', 'Opción C ' || i,
        'd', 'Opción D ' || i
      ),
      'correct', case i % 4
        when 0 then 'a'
        when 1 then 'b'
        when 2 then 'c'
        else 'd'
      end,
      'explanation',
        'Explicación privada suficientemente extensa para la pregunta ' || i,
      'topic_code', case when i < 5 then 'FL-1.1.1' else 'FL-2.1.1' end,
      'topic_name', case when i < 5 then 'Fundamentos' else 'Ciclo de vida' end,
      'level_k', case when i < 5 then 'K1' else 'K2' end
    )
    order by i
  )
  into v_questions
  from generate_series(0, 9) as generated(i);

  begin
    perform public.store_quiz_attempt_claimed(
      '00000000-0000-4000-8000-0000000001a1',
      '00000000-0000-4000-8000-0000000001a4',
      v_questions,
      'demo',
      'stale-worker',
      '2026-07-19T20:50:29Z',
      repeat('a', 64),
      v_claim_token
    );
  exception
    when sqlstate 'P0001' then
      if sqlerrm = 'QUIZ_AI_CLAIM_NOT_OWNED' then
        v_stale_write_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_stale_write_rejected then
    raise exception 'QUIZ_AI_STALE_WRITE_ACCEPTED';
  end if;

  v_public := public.store_quiz_attempt_claimed(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4',
    v_questions,
    'demo',
    'fixture-quiz-authority',
    '2026-07-19T20:50:30Z',
    repeat('b', 64),
    v_claim_retry_token
  );

  if public.claim_quiz_ai_operation(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4',
    'generate',
    repeat('b', 64),
    180
  ) ->> 'outcome' <> 'completed' then
    raise exception 'QUIZ_AI_CLAIM_NOT_COMPLETED_WITH_DURABLE_WRITE';
  end if;

  if v_public ->> 'created' <> 'true'
    or jsonb_array_length(v_public -> 'questions') <> 10
  then
    raise exception 'QUIZ_SNAPSHOT_NOT_CREATED';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_public -> 'questions') as item(value)
    where item.value ?| array['correct', 'correct_answer', 'explanation']
  ) then
    raise exception 'PUBLIC_QUIZ_LEAKS_ANSWER_KEY';
  end if;

  v_attempt_id := (v_public ->> 'attempt_id')::uuid;
  v_cached := public.get_quiz_attempt_public(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4'
  );

  if v_cached is distinct from (v_public - 'created') then
    raise exception 'QUIZ_PUBLIC_RELOAD_CHANGED_SNAPSHOT';
  end if;

  v_cached := public.store_quiz_attempt(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4',
    v_questions,
    'demo',
    'ignored-on-retry',
    clock_timestamp()
  );

  if v_cached ->> 'created' <> 'false'
    or (v_cached ->> 'attempt_id')::uuid <> v_attempt_id
  then
    raise exception 'QUIZ_SNAPSHOT_RETRY_NOT_IDEMPOTENT';
  end if;

  v_private := public.get_quiz_attempt_private(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4',
    v_attempt_id
  );

  if v_private ->> 'state' <> 'open'
    or not ((v_private #> '{questions,0}') ? 'correct')
    or not ((v_private #> '{questions,0}') ? 'explanation')
  then
    raise exception 'PRIVATE_QUIZ_SNAPSHOT_INCOMPLETE';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'question_id', i,
      'user_answer', case
        when i < 7 then case i % 4
          when 0 then 'a'
          when 1 then 'b'
          when 2 then 'c'
          else 'd'
        end
        when i % 4 = 0 then 'b'
        else 'a'
      end
    )
    order by i
  )
  into v_answers
  from generate_series(0, 9) as generated(i);

  v_claim := public.claim_quiz_ai_operation(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4',
    'evaluate',
    repeat('c', 64),
    180
  );
  v_claim_token := (v_claim ->> 'claim_token')::uuid;

  if v_claim ->> 'outcome' <> 'acquired' or v_claim_token is null then
    raise exception 'QUIZ_EVALUATION_CLAIM_NOT_ACQUIRED';
  end if;

  v_finalized := public.finalize_quiz_and_adapt_claimed(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4',
    v_attempt_id,
    v_answers,
    jsonb_build_object(
      'error_patterns', '[]'::jsonb
    ),
    repeat('c', 64),
    v_claim_token
  );

  if public.claim_quiz_ai_operation(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4',
    'evaluate',
    repeat('c', 64),
    180
  ) ->> 'outcome' <> 'completed' then
    raise exception 'QUIZ_EVALUATION_CLAIM_NOT_COMPLETED';
  end if;

  if v_finalized ->> 'outcome' <> 'finalized'
    or v_finalized #>> '{evaluation,score}' <> '70'
    or v_finalized #>> '{evaluation,correct_count}' <> '7'
    or v_finalized #>> '{evaluation,action}' <> 'advance'
    or v_finalized #>> '{evaluation,next_method}' <> 'theory'
    or v_finalized #>> '{evaluation,reinforcement_minutes}' <> '0'
    or jsonb_array_length(v_finalized #> '{evaluation,question_results}') <> 10
    or v_finalized #>> '{adaptation,action}' <> 'advance'
  then
    raise exception 'QUIZ_FINAL_RESULT_INVALID: %', v_finalized;
  end if;

  if (
    select count(*)
    from public.answers as a
    where a.quiz_attempt_id = v_attempt_id
  ) <> 10 then
    raise exception 'QUIZ_ANSWERS_NOT_INSERTED_EXACTLY_ONCE';
  end if;

  if exists (
    select 1
    from public.answers as a
    where a.quiz_attempt_id = v_attempt_id
      and a.is_correct is distinct from (a.user_answer = a.correct_answer)
  ) then
    raise exception 'QUIZ_ANSWER_CORRECTNESS_INCONSISTENT';
  end if;

  if not exists (
    select 1
    from public.sessions as s
    where s.id = '00000000-0000-4000-8000-0000000001a4'
      and s.status = 'completed'
      and s.score_percent = 70
      and s.action_taken = 'advance'
      and s.completed_at is not null
  ) then
    raise exception 'QUIZ_SESSION_NOT_COMPLETED_ATOMICALLY';
  end if;

  v_cached := public.get_quiz_attempt_public(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4'
  );
  if v_cached ->> 'state' <> 'completed'
    or v_cached -> 'evaluation' is distinct from v_finalized -> 'evaluation'
  then
    raise exception 'QUIZ_COMPLETED_RESULT_NOT_REHYDRATABLE';
  end if;

  select jsonb_agg(item.value order by item.ordinality desc)
  into v_answers_reversed
  from jsonb_array_elements(v_answers) with ordinality as item(value, ordinality);

  v_duplicate := public.finalize_quiz_and_adapt(
    '00000000-0000-4000-8000-0000000001a1',
    '00000000-0000-4000-8000-0000000001a4',
    v_attempt_id,
    v_answers_reversed,
    jsonb_build_object(
      'error_patterns', '[]'::jsonb
    )
  );

  if v_duplicate ->> 'outcome' <> 'duplicate'
    or v_duplicate -> 'evaluation' is distinct from v_finalized -> 'evaluation'
  then
    raise exception 'QUIZ_IDENTICAL_REPLAY_CHANGED_RESULT';
  end if;

  select jsonb_agg(
    case
      when item.value ->> 'question_id' = '0'
        then jsonb_set(item.value, '{user_answer}', '"d"'::jsonb)
      else item.value
    end
    order by item.ordinality
  )
  into v_changed_answers
  from jsonb_array_elements(v_answers) with ordinality as item(value, ordinality);

  begin
    perform public.finalize_quiz_and_adapt(
      '00000000-0000-4000-8000-0000000001a1',
      '00000000-0000-4000-8000-0000000001a4',
      v_attempt_id,
      v_changed_answers,
      jsonb_build_object(
        'error_patterns', '[]'::jsonb
      )
    );
  exception
    when sqlstate 'P0001' then
      if sqlerrm = 'QUIZ_REPLAY_CONFLICT' then
        v_replay_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_replay_rejected then
    raise exception 'QUIZ_CHANGED_REPLAY_ACCEPTED';
  end if;

  select jsonb_agg(
    case
      when item.value ->> 'question_id' = '0'
        then item.value || jsonb_build_object('correct', 'a')
      else item.value
    end
    order by item.ordinality
  )
  into v_changed_answers
  from jsonb_array_elements(v_answers) with ordinality as item(value, ordinality);

  begin
    perform public.finalize_quiz_and_adapt(
      '00000000-0000-4000-8000-0000000001a1',
      '00000000-0000-4000-8000-0000000001a4',
      v_attempt_id,
      v_changed_answers,
      jsonb_build_object(
        'error_patterns', '[]'::jsonb
      )
    );
  exception
    when sqlstate '22023' then
      if sqlerrm = 'QUIZ_SUBMISSION_INVALID' then
        v_private_field_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_private_field_rejected then
    raise exception 'QUIZ_PRIVATE_REQUEST_FIELD_ACCEPTED';
  end if;

  -- A second open session proves missing nested qualitative fields cannot be
  -- persisted through SQL NULL semantics.
  update public.sessions
  set status = 'active'
  where id = '00000000-0000-4000-8000-0000000001a4';

  update private.quiz_attempts
  set
    status = 'open',
    canonical_submission = null,
    response_json = null,
    completed_at = null
  where id = v_attempt_id;

  delete from public.answers where quiz_attempt_id = v_attempt_id;

  begin
    perform public.finalize_quiz_and_adapt(
      '00000000-0000-4000-8000-0000000001a1',
      '00000000-0000-4000-8000-0000000001a4',
      v_attempt_id,
      v_answers,
      jsonb_build_object(
        'error_patterns', jsonb_build_array('{}'::jsonb)
      )
    );
  exception
    when sqlstate '22023' then
      if sqlerrm = 'QUIZ_QUALITATIVE_INVALID' then
        v_invalid_pattern_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_invalid_pattern_rejected then
    raise exception 'QUIZ_INVALID_NESTED_PATTERN_ACCEPTED';
  end if;
end;
$$;

reset role;

set local request.jwt.claims =
  '{"sub":"00000000-0000-4000-8000-0000000001a1","role":"authenticated"}';
set local role authenticated;

do $$
declare
  v_dml_rejected boolean := false;
  v_rpc_rejected boolean := false;
  v_private_rejected boolean := false;
begin
  begin
    update public.sessions
    set score_percent = 100, status = 'completed', action_taken = 'advance'
    where id = '00000000-0000-4000-8000-0000000001a4';
  exception
    when insufficient_privilege then
      v_dml_rejected := true;
  end;

  begin
    perform public.get_quiz_attempt_public(
      '00000000-0000-4000-8000-0000000001a1',
      '00000000-0000-4000-8000-0000000001a4'
    );
  exception
    when insufficient_privilege then
      v_rpc_rejected := true;
  end;

  begin
    perform 1 from private.quiz_attempts;
  exception
    when insufficient_privilege then
      v_private_rejected := true;
  end;

  if not v_dml_rejected or not v_rpc_rejected or not v_private_rejected then
    raise exception 'AUTHENTICATED_AUTHORITY_BOUNDARY_FAILED';
  end if;
end;
$$;

reset role;

select extensions.pass(
  'quiz authority: private snapshot, atomic grading, idempotent replay, and server-only privileges'
);
select * from extensions.finish();

rollback;
