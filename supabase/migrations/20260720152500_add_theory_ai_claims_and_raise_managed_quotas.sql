-- Prevent concurrent theory requests from invoking the provider more than once.
create table if not exists private.theory_ai_operations (
  user_id uuid not null,
  session_id uuid not null,
  request_fingerprint text not null,
  claim_token uuid not null default gen_random_uuid(),
  lease_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, session_id),
  constraint theory_ai_operations_session_user_fk
    foreign key (session_id, user_id)
    references public.sessions (id, user_id)
    on delete cascade,
  constraint theory_ai_operations_fingerprint_chk
    check (request_fingerprint ~ '^[0-9a-f]{64}$')
);

grant select, insert, update, delete on private.theory_ai_operations
  to service_role;

create or replace function public.claim_theory_ai_operation(
  p_user_id uuid,
  p_session_id uuid,
  p_request_fingerprint text,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim private.theory_ai_operations%rowtype;
  v_now timestamptz := clock_timestamp();
  v_token uuid := gen_random_uuid();
begin
  if p_user_id is null
    or p_session_id is null
    or p_request_fingerprint is null
    or p_request_fingerprint !~ '^[0-9a-f]{64}$'
    or p_lease_seconds is null
    or p_lease_seconds not between 30 and 600
  then
    raise exception 'THEORY_AI_CLAIM_INVALID' using errcode = '22023';
  end if;

  insert into private.theory_ai_operations (
    user_id,
    session_id,
    request_fingerprint,
    claim_token,
    lease_expires_at,
    created_at,
    updated_at
  ) values (
    p_user_id,
    p_session_id,
    p_request_fingerprint,
    v_token,
    v_now + make_interval(secs => p_lease_seconds),
    v_now,
    v_now
  )
  on conflict (user_id, session_id) do nothing
  returning * into v_claim;

  if found then
    return jsonb_build_object('outcome', 'acquired', 'claim_token', v_token);
  end if;

  select operation_claim.*
  into v_claim
  from private.theory_ai_operations as operation_claim
  where operation_claim.user_id = p_user_id
    and operation_claim.session_id = p_session_id
  for update;

  if not found then
    raise exception 'THEORY_AI_CLAIM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_claim.lease_expires_at <= v_now then
    update private.theory_ai_operations as operation_claim
    set
      request_fingerprint = p_request_fingerprint,
      claim_token = v_token,
      lease_expires_at = v_now + make_interval(secs => p_lease_seconds),
      updated_at = v_now
    where operation_claim.user_id = p_user_id
      and operation_claim.session_id = p_session_id;

    return jsonb_build_object('outcome', 'acquired', 'claim_token', v_token);
  end if;

  if v_claim.request_fingerprint <> p_request_fingerprint then
    return jsonb_build_object('outcome', 'conflict', 'claim_token', null);
  end if;

  return jsonb_build_object('outcome', 'in_progress', 'claim_token', null);
end;
$$;

create or replace function public.release_theory_ai_operation(
  p_user_id uuid,
  p_session_id uuid,
  p_request_fingerprint text,
  p_claim_token uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with released as (
    delete from private.theory_ai_operations as operation_claim
    where operation_claim.user_id = p_user_id
      and operation_claim.session_id = p_session_id
      and operation_claim.request_fingerprint = p_request_fingerprint
      and operation_claim.claim_token = p_claim_token
    returning 1
  )
  select exists(select 1 from released);
$$;

revoke all on function public.claim_theory_ai_operation(
  uuid, uuid, text, integer
) from public, anon, authenticated;
revoke all on function public.release_theory_ai_operation(
  uuid, uuid, text, uuid
) from public, anon, authenticated;

grant execute on function public.claim_theory_ai_operation(
  uuid, uuid, text, integer
) to service_role;
grant execute on function public.release_theory_ai_operation(
  uuid, uuid, text, uuid
) to service_role;

comment on table private.theory_ai_operations is
  'Leases privados que evitan generaciones de teoría concurrentes por sesión.';

-- Triple the standard Managed allowance while preserving custom limits.
alter table public.user_ai_settings
  alter column daily_request_limit set default 60,
  alter column monthly_request_limit set default 900,
  alter column daily_token_limit set default 150000,
  alter column monthly_token_limit set default 1500000;

update public.user_ai_settings
set
  daily_request_limit = case
    when daily_request_limit = 20 then 60
    else daily_request_limit
  end,
  monthly_request_limit = case
    when monthly_request_limit = 300 then 900
    else monthly_request_limit
  end,
  daily_token_limit = case
    when daily_token_limit = 50000 then 150000
    else daily_token_limit
  end,
  monthly_token_limit = case
    when monthly_token_limit = 500000 then 1500000
    else monthly_token_limit
  end,
  updated_at = clock_timestamp()
where daily_request_limit = 20
   or monthly_request_limit = 300
   or daily_token_limit = 50000
   or monthly_token_limit = 500000;
