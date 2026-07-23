begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(1);

do $$
declare
  expected record;
  actual record;
  child_columns text[];
  parent_columns text[];
  old_constraint text;
begin
  for expected in
    select *
    from (values
      ('documents_id_user_unique', 'documents', 'u', array['id', 'user_id'], null::text, null::text[], null::text),
      ('study_plans_id_user_unique', 'study_plans', 'u', array['id', 'user_id'], null::text, null::text[], null::text),
      ('sessions_id_user_unique', 'sessions', 'u', array['id', 'user_id'], null::text, null::text[], null::text),
      ('study_plans_document_user_fk', 'study_plans', 'f', array['document_id', 'user_id'], 'documents', array['id', 'user_id'], 'a'),
      ('sessions_study_plan_user_fk', 'sessions', 'f', array['study_plan_id', 'user_id'], 'study_plans', array['id', 'user_id'], 'c'),
      ('answers_session_user_fk', 'answers', 'f', array['session_id', 'user_id'], 'sessions', array['id', 'user_id'], 'c'),
      ('topic_progress_study_plan_user_fk', 'topic_progress', 'f', array['study_plan_id', 'user_id'], 'study_plans', array['id', 'user_id'], 'a')
    ) as definitions(
      constraint_name,
      child_table,
      constraint_type,
      expected_child_columns,
      parent_table,
      expected_parent_columns,
      delete_action
    )
  loop
    select c.*
    into actual
    from pg_catalog.pg_constraint as c
    where c.conname = expected.constraint_name
      and c.conrelid = to_regclass('public.' || expected.child_table);

    if not found or not actual.convalidated or actual.contype::text <> expected.constraint_type then
      raise exception 'INVALID_CONSTRAINT: %', expected.constraint_name;
    end if;

    select array_agg(a.attname::text order by keys.ordinality)
    into child_columns
    from unnest(actual.conkey) with ordinality as keys(attnum, ordinality)
    join pg_catalog.pg_attribute as a
      on a.attrelid = actual.conrelid and a.attnum = keys.attnum;

    if child_columns is distinct from expected.expected_child_columns then
      raise exception 'INVALID_CHILD_COLUMNS: %', expected.constraint_name;
    end if;

    if expected.constraint_type = 'f' then
      select array_agg(a.attname::text order by keys.ordinality)
      into parent_columns
      from unnest(actual.confkey) with ordinality as keys(attnum, ordinality)
      join pg_catalog.pg_attribute as a
        on a.attrelid = actual.confrelid and a.attnum = keys.attnum;

      if actual.confrelid <> to_regclass('public.' || expected.parent_table)
        or parent_columns is distinct from expected.expected_parent_columns
        or actual.confdeltype::text <> expected.delete_action
        or actual.confupdtype::text <> 'a'
        or actual.condeferrable
      then
        raise exception 'INVALID_FOREIGN_KEY_SHAPE: %', expected.constraint_name;
      end if;
    end if;
  end loop;

  foreach old_constraint in array array[
    'study_plans_document_id_fkey',
    'sessions_study_plan_id_fkey',
    'answers_session_id_fkey',
    'topic_progress_study_plan_id_fkey'
  ] loop
    if exists (
      select 1 from pg_catalog.pg_constraint where conname = old_constraint
    ) then
      raise exception 'LEGACY_FOREIGN_KEY_STILL_PRESENT: %', old_constraint;
    end if;
  end loop;

  if to_regclass('public.idx_study_plans_document_user') is null then
    raise exception 'MISSING_INDEX: idx_study_plans_document_user';
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
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-0000000000a1',
    'authenticated',
    'authenticated',
    'ownership-a@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ownership A"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-0000000000b1',
    'authenticated',
    'authenticated',
    'ownership-b@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Ownership B"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

insert into public.documents (id, user_id, file_name, file_url) values
  (
    '00000000-0000-4000-8000-0000000000a2',
    '00000000-0000-4000-8000-0000000000a1',
    'a.pdf',
    'a/a.pdf'
  ),
  (
    '00000000-0000-4000-8000-0000000000b2',
    '00000000-0000-4000-8000-0000000000b1',
    'b.pdf',
    'b/b.pdf'
  );

insert into public.study_plans (
  id, user_id, document_id, start_date, estimated_end_date, plan_json
) values
  (
    '00000000-0000-4000-8000-0000000000a3',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-0000000000a2',
    current_date,
    current_date + 7,
    '{}'
  ),
  (
    '00000000-0000-4000-8000-0000000000b3',
    '00000000-0000-4000-8000-0000000000b1',
    '00000000-0000-4000-8000-0000000000b2',
    current_date,
    current_date + 7,
    '{}'
  );

insert into public.sessions (
  id, study_plan_id, user_id, topic_codes, session_type, day_number
) values
  (
    '00000000-0000-4000-8000-0000000000a4',
    '00000000-0000-4000-8000-0000000000a3',
    '00000000-0000-4000-8000-0000000000a1',
    array['FL-1.1.1'],
    'morning',
    1
  ),
  (
    '00000000-0000-4000-8000-0000000000b4',
    '00000000-0000-4000-8000-0000000000b3',
    '00000000-0000-4000-8000-0000000000b1',
    array['FL-1.1.1'],
    'morning',
    1
  );

insert into public.answers (
  id,
  session_id,
  user_id,
  question_text,
  options_json,
  correct_answer,
  user_answer,
  is_correct,
  topic_code,
  level_k
) values
  (
    '00000000-0000-4000-8000-0000000000a5',
    '00000000-0000-4000-8000-0000000000a4',
    '00000000-0000-4000-8000-0000000000a1',
    'Question A',
    '{"a":"A","b":"B","c":"C","d":"D"}',
    'a',
    'a',
    true,
    'FL-1.1.1',
    'K1'
  ),
  (
    '00000000-0000-4000-8000-0000000000b5',
    '00000000-0000-4000-8000-0000000000b4',
    '00000000-0000-4000-8000-0000000000b1',
    'Question B',
    '{"a":"A","b":"B","c":"C","d":"D"}',
    'a',
    'b',
    false,
    'FL-1.1.1',
    'K1'
  );

insert into public.topic_progress (
  id, user_id, study_plan_id, topic_code, status
) values
  (
    '00000000-0000-4000-8000-0000000000a6',
    '00000000-0000-4000-8000-0000000000a1',
    '00000000-0000-4000-8000-0000000000a3',
    'FL-1.1.1',
    'pending'
  ),
  (
    '00000000-0000-4000-8000-0000000000b6',
    '00000000-0000-4000-8000-0000000000b1',
    '00000000-0000-4000-8000-0000000000b3',
    'FL-1.1.1',
    'pending'
  );

create function pg_temp.expect_fk_violation(
  statement text,
  label text,
  expected_constraint text
)
returns void
language plpgsql
as $$
declare
  actual_constraint text;
begin
  execute statement;
  raise exception 'CROSS_TENANT_WRITE_ACCEPTED: %', label;
exception
  when foreign_key_violation then
    get stacked diagnostics actual_constraint = constraint_name;
    if actual_constraint is distinct from expected_constraint then
      raise exception 'WRONG_CONSTRAINT: % expected %, got %',
        label,
        expected_constraint,
        actual_constraint;
    end if;
end;
$$;

select pg_temp.expect_fk_violation(
  $sql$
    insert into public.study_plans (
      id, user_id, document_id, start_date, estimated_end_date, plan_json
    ) values (
      '00000000-0000-4000-8000-0000000000c1',
      '00000000-0000-4000-8000-0000000000a1',
      '00000000-0000-4000-8000-0000000000b2',
      current_date,
      current_date + 7,
      '{}'
    )
  $sql$,
  'study_plans -> documents',
  'study_plans_document_user_fk'
);

select pg_temp.expect_fk_violation(
  $sql$
    insert into public.sessions (
      id, study_plan_id, user_id, topic_codes, session_type, day_number
    ) values (
      '00000000-0000-4000-8000-0000000000c2',
      '00000000-0000-4000-8000-0000000000b3',
      '00000000-0000-4000-8000-0000000000a1',
      array['FL-1.1.1'],
      'morning',
      1
    )
  $sql$,
  'sessions -> study_plans',
  'sessions_study_plan_user_fk'
);

select pg_temp.expect_fk_violation(
  $sql$
    insert into public.answers (
      id, session_id, user_id, question_text, options_json,
      correct_answer, user_answer, is_correct, topic_code, level_k
    ) values (
      '00000000-0000-4000-8000-0000000000c3',
      '00000000-0000-4000-8000-0000000000b4',
      '00000000-0000-4000-8000-0000000000a1',
      'Cross-tenant question',
      '{"a":"A","b":"B","c":"C","d":"D"}',
      'a',
      'a',
      true,
      'FL-1.1.1',
      'K1'
    )
  $sql$,
  'answers -> sessions',
  'answers_session_user_fk'
);

select pg_temp.expect_fk_violation(
  $sql$
    insert into public.topic_progress (
      id, user_id, study_plan_id, topic_code, status
    ) values (
      '00000000-0000-4000-8000-0000000000c4',
      '00000000-0000-4000-8000-0000000000a1',
      '00000000-0000-4000-8000-0000000000b3',
      'FL-2.1.1',
      'pending'
    )
  $sql$,
  'topic_progress -> study_plans',
  'topic_progress_study_plan_user_fk'
);

select pg_temp.expect_fk_violation(
  $sql$
    update public.study_plans
    set document_id = '00000000-0000-4000-8000-0000000000b2'
    where id = '00000000-0000-4000-8000-0000000000a3'
  $sql$,
  'update study_plans -> documents',
  'study_plans_document_user_fk'
);

select pg_temp.expect_fk_violation(
  $sql$
    update public.sessions
    set study_plan_id = '00000000-0000-4000-8000-0000000000b3'
    where id = '00000000-0000-4000-8000-0000000000a4'
  $sql$,
  'update sessions -> study_plans',
  'sessions_study_plan_user_fk'
);

select pg_temp.expect_fk_violation(
  $sql$
    update public.answers
    set session_id = '00000000-0000-4000-8000-0000000000b4'
    where id = '00000000-0000-4000-8000-0000000000a5'
  $sql$,
  'update answers -> sessions',
  'answers_session_user_fk'
);

select pg_temp.expect_fk_violation(
  $sql$
    update public.topic_progress
    set study_plan_id = '00000000-0000-4000-8000-0000000000b3'
    where id = '00000000-0000-4000-8000-0000000000a6'
  $sql$,
  'update topic_progress -> study_plans',
  'topic_progress_study_plan_user_fk'
);

select extensions.pass(
  'core ownership: exact catalog plus 8 cross-tenant FK rejections'
);
select * from extensions.finish();

rollback;
