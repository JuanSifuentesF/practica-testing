-- Defense in depth for denormalized user_id columns in the core study graph.
-- RLS controls access; these composite foreign keys preserve ownership even
-- for service_role, direct SQL, maintenance jobs, and future policy mistakes.

set local lock_timeout = '5s';
set local statement_timeout = '2min';

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'study_plans_document_id_fkey'
      and conrelid = 'public.study_plans'::regclass
      and contype = 'f'
      and convalidated
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'sessions_study_plan_id_fkey'
      and conrelid = 'public.sessions'::regclass
      and contype = 'f'
      and convalidated
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'answers_session_id_fkey'
      and conrelid = 'public.answers'::regclass
      and contype = 'f'
      and convalidated
  ) or not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'topic_progress_study_plan_id_fkey'
      and conrelid = 'public.topic_progress'::regclass
      and contype = 'f'
      and convalidated
  ) then
    raise exception 'CORE_OWNERSHIP_ORIGINAL_FOREIGN_KEYS_NOT_FOUND'
      using errcode = '42704';
  end if;

  if exists (
    select 1
    from public.study_plans as sp
    left join public.documents as d on d.id = sp.document_id
    where d.id is null or sp.user_id is distinct from d.user_id
  ) then
    raise exception 'CORE_OWNERSHIP_STUDY_PLAN_DOCUMENT_MISMATCH'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.sessions as s
    left join public.study_plans as sp on sp.id = s.study_plan_id
    where sp.id is null or s.user_id is distinct from sp.user_id
  ) then
    raise exception 'CORE_OWNERSHIP_SESSION_PLAN_MISMATCH'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.answers as a
    left join public.sessions as s on s.id = a.session_id
    where s.id is null or a.user_id is distinct from s.user_id
  ) then
    raise exception 'CORE_OWNERSHIP_ANSWER_SESSION_MISMATCH'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.topic_progress as tp
    left join public.study_plans as sp on sp.id = tp.study_plan_id
    where sp.id is null or tp.user_id is distinct from sp.user_id
  ) then
    raise exception 'CORE_OWNERSHIP_TOPIC_PROGRESS_PLAN_MISMATCH'
      using errcode = '23514';
  end if;
end;
$$;

alter table public.documents
  add constraint documents_id_user_unique unique (id, user_id);

alter table public.study_plans
  add constraint study_plans_id_user_unique unique (id, user_id);

alter table public.sessions
  add constraint sessions_id_user_unique unique (id, user_id);

alter table public.study_plans
  add constraint study_plans_document_user_fk
  foreign key (document_id, user_id)
  references public.documents (id, user_id)
  not valid;

alter table public.sessions
  add constraint sessions_study_plan_user_fk
  foreign key (study_plan_id, user_id)
  references public.study_plans (id, user_id)
  on delete cascade
  not valid;

alter table public.answers
  add constraint answers_session_user_fk
  foreign key (session_id, user_id)
  references public.sessions (id, user_id)
  on delete cascade
  not valid;

alter table public.topic_progress
  add constraint topic_progress_study_plan_user_fk
  foreign key (study_plan_id, user_id)
  references public.study_plans (id, user_id)
  not valid;

alter table public.study_plans
  validate constraint study_plans_document_user_fk;
alter table public.sessions
  validate constraint sessions_study_plan_user_fk;
alter table public.answers
  validate constraint answers_session_user_fk;
alter table public.topic_progress
  validate constraint topic_progress_study_plan_user_fk;

alter table public.study_plans
  drop constraint study_plans_document_id_fkey;
alter table public.sessions
  drop constraint sessions_study_plan_id_fkey;
alter table public.answers
  drop constraint answers_session_id_fkey;
alter table public.topic_progress
  drop constraint topic_progress_study_plan_id_fkey;

create index idx_study_plans_document_user
  on public.study_plans (document_id, user_id);

drop policy if exists "study_plans_insert_own" on public.study_plans;
create policy "study_plans_insert_own"
  on public.study_plans
  for insert
  to authenticated
  with check (
    study_plans.user_id = (select auth.uid())
    and exists (
      select 1
      from public.documents as d
      where d.id = study_plans.document_id
        and d.user_id = study_plans.user_id
    )
  );

drop policy if exists "study_plans_update_own" on public.study_plans;
create policy "study_plans_update_own"
  on public.study_plans
  for update
  to authenticated
  using (study_plans.user_id = (select auth.uid()))
  with check (
    study_plans.user_id = (select auth.uid())
    and exists (
      select 1
      from public.documents as d
      where d.id = study_plans.document_id
        and d.user_id = study_plans.user_id
    )
  );

drop policy if exists "sessions_insert_own" on public.sessions;
create policy "sessions_insert_own"
  on public.sessions
  for insert
  to authenticated
  with check (
    sessions.user_id = (select auth.uid())
    and exists (
      select 1
      from public.study_plans as sp
      where sp.id = sessions.study_plan_id
        and sp.user_id = sessions.user_id
    )
  );

drop policy if exists "sessions_update_own" on public.sessions;
create policy "sessions_update_own"
  on public.sessions
  for update
  to authenticated
  using (sessions.user_id = (select auth.uid()))
  with check (
    sessions.user_id = (select auth.uid())
    and exists (
      select 1
      from public.study_plans as sp
      where sp.id = sessions.study_plan_id
        and sp.user_id = sessions.user_id
    )
  );

drop policy if exists "answers_insert_own" on public.answers;
create policy "answers_insert_own"
  on public.answers
  for insert
  to authenticated
  with check (
    answers.user_id = (select auth.uid())
    and exists (
      select 1
      from public.sessions as s
      where s.id = answers.session_id
        and s.user_id = answers.user_id
    )
  );

drop policy if exists "topic_progress_insert_own" on public.topic_progress;
create policy "topic_progress_insert_own"
  on public.topic_progress
  for insert
  to authenticated
  with check (
    topic_progress.user_id = (select auth.uid())
    and exists (
      select 1
      from public.study_plans as sp
      where sp.id = topic_progress.study_plan_id
        and sp.user_id = topic_progress.user_id
    )
  );

drop policy if exists "topic_progress_update_own" on public.topic_progress;
create policy "topic_progress_update_own"
  on public.topic_progress
  for update
  to authenticated
  using (topic_progress.user_id = (select auth.uid()))
  with check (
    topic_progress.user_id = (select auth.uid())
    and exists (
      select 1
      from public.study_plans as sp
      where sp.id = topic_progress.study_plan_id
        and sp.user_id = topic_progress.user_id
    )
  );

comment on constraint study_plans_document_user_fk on public.study_plans is
  'A study plan can reference only a document owned by the same user.';
comment on constraint sessions_study_plan_user_fk on public.sessions is
  'A session can reference only a study plan owned by the same user.';
comment on constraint answers_session_user_fk on public.answers is
  'An answer can reference only a session owned by the same user.';
comment on constraint topic_progress_study_plan_user_fk on public.topic_progress is
  'Topic progress can reference only a study plan owned by the same user.';
