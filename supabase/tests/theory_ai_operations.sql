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
  'theory-claim@example.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Theory Claim"}',
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
  'theory.pdf',
  'theory-claim/theory.pdf',
  '{"FL-1.1.1":{}}'
);

insert into public.study_plans (
  id, user_id, document_id, start_date, estimated_end_date, plan_json
) values (
  '00000000-0000-4000-8000-0000000002a3',
  '00000000-0000-4000-8000-0000000002a1',
  '00000000-0000-4000-8000-0000000002a2',
  current_date,
  current_date + 1,
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
  '00000000-0000-4000-8000-0000000002a4',
  '00000000-0000-4000-8000-0000000002a3',
  '00000000-0000-4000-8000-0000000002a1',
  array['FL-1.1.1'],
  'morning',
  1,
  'theory',
  1,
  'active'
);

set local role service_role;

do $$
declare
  v_claim jsonb;
  v_token uuid;
  v_settings public.user_ai_settings%rowtype;
begin
  v_claim := public.claim_theory_ai_operation(
    '00000000-0000-4000-8000-0000000002a1',
    '00000000-0000-4000-8000-0000000002a4',
    repeat('a', 64),
    600
  );
  v_token := (v_claim ->> 'claim_token')::uuid;

  if v_claim ->> 'outcome' <> 'acquired'
    or v_token is null
    or public.claim_theory_ai_operation(
      '00000000-0000-4000-8000-0000000002a1',
      '00000000-0000-4000-8000-0000000002a4',
      repeat('a', 64),
      600
    ) ->> 'outcome' <> 'in_progress'
    or public.claim_theory_ai_operation(
      '00000000-0000-4000-8000-0000000002a1',
      '00000000-0000-4000-8000-0000000002a4',
      repeat('b', 64),
      600
    ) ->> 'outcome' <> 'conflict'
  then
    raise exception 'THEORY_AI_CLAIM_NOT_SERIALIZED';
  end if;

  if not public.release_theory_ai_operation(
    '00000000-0000-4000-8000-0000000002a1',
    '00000000-0000-4000-8000-0000000002a4',
    repeat('a', 64),
    v_token
  ) then
    raise exception 'THEORY_AI_CLAIM_NOT_RELEASED';
  end if;

  select settings.*
  into v_settings
  from public.user_ai_settings as settings
  where settings.user_id = '00000000-0000-4000-8000-0000000002a1';

  if v_settings.daily_request_limit <> 60
    or v_settings.monthly_request_limit <> 900
    or v_settings.daily_token_limit <> 150000
    or v_settings.monthly_token_limit <> 1500000
  then
    raise exception 'MANAGED_QUOTA_DEFAULTS_NOT_TRIPLED';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.claim_theory_ai_operation(uuid,uuid,text,integer)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.release_theory_ai_operation(uuid,uuid,text,uuid)',
    'EXECUTE'
  ) then
    raise exception 'AUTHENTICATED_THEORY_CLAIM_EXECUTE_GRANTED';
  end if;
end;
$$;

reset role;

select extensions.pass(
  'theory generation uses a private single-flight lease and 3x Managed defaults'
);
select * from extensions.finish();

rollback;
