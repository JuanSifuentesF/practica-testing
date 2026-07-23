begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(1);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-0000000003a1',
  'authenticated',
  'authenticated',
  'adaptation-upgrade@example.invalid',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Adaptation Upgrade"}',
  now(),
  now(),
  '', '', '', ''
);

insert into public.documents (
  id, user_id, file_name, file_url, topics_json
) values (
  '00000000-0000-4000-8000-0000000003a2',
  '00000000-0000-4000-8000-0000000003a1',
  'upgrade.pdf',
  'upgrade/upgrade.pdf',
  '{"FL-1.1.1":{},"FL-2.1.1":{},"FL-GAP":{},"FL-ADV":{},"FL-9.9.9":{}}'
);

insert into public.study_plans (
  id, user_id, document_id, start_date, estimated_end_date, plan_json
) values (
  '00000000-0000-4000-8000-0000000003a3',
  '00000000-0000-4000-8000-0000000003a1',
  '00000000-0000-4000-8000-0000000003a2',
  '2026-06-29',
  '2026-07-09',
  '{}'
);

drop index public.sessions_plan_topics_attempt_unique;

insert into public.sessions (
  id, study_plan_id, user_id, topic_codes, session_type, day_number,
  completed_at, duration_minutes, score_percent, attempt_number,
  method_used, action_taken, status, created_at
) values
  (
    '00000000-0000-4000-8000-000000000301',
    '00000000-0000-4000-8000-0000000003a3',
    '00000000-0000-4000-8000-0000000003a1',
    array['FL-1.1.1', 'FL-2.1.1'],
    'night', 1, '2026-06-30T13:53:01Z', 90, 40, 1,
    'theory', 'restructure', 'completed', '2026-06-29T01:00:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000000302',
    '00000000-0000-4000-8000-0000000003a3',
    '00000000-0000-4000-8000-0000000003a1',
    array['FL-1.1.1', 'FL-2.1.1'],
    'reinforcement', 8, '2026-06-30T14:39:28Z', 30, 40, 1,
    'examples', 'restructure', 'completed', '2026-06-30T13:53:02Z'
  ),
  (
    '00000000-0000-4000-8000-000000000303',
    '00000000-0000-4000-8000-0000000003a3',
    '00000000-0000-4000-8000-0000000003a1',
    array['FL-1.1.1', 'FL-2.1.1'],
    'reinforcement', 9, '2026-06-30T14:44:15Z', 30, 50, 1,
    'examples', 'reinforce', 'completed', '2026-06-30T13:53:02.2Z'
  ),
  (
    '00000000-0000-4000-8000-000000000304',
    '00000000-0000-4000-8000-0000000003a3',
    '00000000-0000-4000-8000-0000000003a1',
    array['FL-1.1.1', 'FL-2.1.1'],
    'reinforcement', 10, null, 30, null, 1,
    'analogies', null, 'active', '2026-06-30T14:39:28.2Z'
  ),
  (
    '00000000-0000-4000-8000-000000000305',
    '00000000-0000-4000-8000-0000000003a3',
    '00000000-0000-4000-8000-0000000003a1',
    array['FL-1.1.1', 'FL-2.1.1'],
    'reinforcement', 11, null, 30, null, 2,
    'analogies', null, 'pending', '2026-06-30T14:39:28.4Z'
  ),
  (
    '00000000-0000-4000-8000-000000000306',
    '00000000-0000-4000-8000-0000000003a3',
    '00000000-0000-4000-8000-0000000003a1',
    array['FL-1.1.1', 'FL-2.1.1'],
    'reinforcement', 12, null, 15, null, 3,
    'examples', null, 'pending', '2026-06-30T14:44:14.5Z'
  );

insert into public.topic_progress (
  user_id, study_plan_id, topic_code, attempts, best_score, last_score,
  status, updated_at
) values
  (
    '00000000-0000-4000-8000-0000000003a1',
    '00000000-0000-4000-8000-0000000003a3',
    'FL-1.1.1', 3, 50, 50, 'in_progress', '2026-06-30T14:44:16Z'
  ),
  (
    '00000000-0000-4000-8000-0000000003a1',
    '00000000-0000-4000-8000-0000000003a3',
    'FL-2.1.1', 3, 50, 50, 'in_progress', '2026-06-30T14:44:16Z'
  );

-- The first source did not adapt; the later child-backed source did. The
-- aggregate progress count must not be assigned by completion ordinal.
insert into public.sessions (
  id, study_plan_id, user_id, topic_codes, session_type, day_number,
  completed_at, duration_minutes, score_percent, attempt_number,
  method_used, action_taken, status, created_at
) values
  (
    '00000000-0000-4000-8000-000000000308',
    '00000000-0000-4000-8000-0000000003a3',
    '00000000-0000-4000-8000-0000000003a1',
    array['FL-GAP'],
    'morning', 13, '2026-07-01T08:00:00Z', 45, 80, 1,
    'theory', 'advance', 'completed', '2026-07-01T07:00:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000000309',
    '00000000-0000-4000-8000-0000000003a3',
    '00000000-0000-4000-8000-0000000003a1',
    array['FL-GAP'],
    'night', 14, '2026-07-01T09:00:00Z', 45, 60, 2,
    'theory', 'reinforce', 'completed', '2026-07-01T08:30:00Z'
  ),
  (
    '00000000-0000-4000-8000-000000000310',
    '00000000-0000-4000-8000-0000000003a3',
    '00000000-0000-4000-8000-0000000003a1',
    array['FL-GAP'],
    'reinforcement', 15, null, 15, null, 3,
    'examples', null, 'pending', '2026-07-01T09:00:00.2Z'
  );

insert into public.topic_progress (
  user_id, study_plan_id, topic_code, attempts, best_score, last_score,
  status, updated_at
) values (
  '00000000-0000-4000-8000-0000000003a1',
  '00000000-0000-4000-8000-0000000003a3',
  'FL-GAP', 1, 60, 60, 'in_progress', '2026-07-01T09:00:01Z'
);

insert into public.sessions (
  id, study_plan_id, user_id, topic_codes, session_type, day_number,
  completed_at, duration_minutes, score_percent, attempt_number,
  method_used, action_taken, status, created_at
) values (
  '00000000-0000-4000-8000-000000000313',
  '00000000-0000-4000-8000-0000000003a3',
  '00000000-0000-4000-8000-0000000003a1',
  array['FL-ADV'],
  'morning', 19, '2026-07-01T11:00:00Z', 45, 80, 1,
  'theory', 'advance', 'completed', '2026-07-01T10:00:00Z'
);

insert into public.topic_progress (
  user_id, study_plan_id, topic_code, attempts, best_score, last_score,
  status, updated_at
) values (
  '00000000-0000-4000-8000-0000000003a1',
  '00000000-0000-4000-8000-0000000003a3',
  'FL-ADV', 1, 80, 80, 'mastered', '2026-07-01T11:00:01Z'
);

do $$
declare
  v_normalized integer;
  v_inserted integer;
  v_before_count integer;
  v_after_count integer;
  v_response jsonb;
  v_duplicate_rejected boolean := false;
  v_ambiguity_rejected boolean := false;
begin
  v_normalized := private.normalize_session_attempt_numbers();
  if v_normalized <> 5 then
    raise exception 'LEGACY_ATTEMPT_NORMALIZATION_COUNT_INVALID: %', v_normalized;
  end if;

  execute $index$
    create unique index sessions_plan_topics_attempt_unique
      on public.sessions (
        user_id,
        study_plan_id,
        (private.canonical_topic_codes(topic_codes)),
        attempt_number
      )
  $index$;

  v_inserted := private.backfill_session_adaptations();
  if v_inserted <> 5 then
    raise exception 'LEGACY_ADAPTATION_BACKFILL_COUNT_INVALID: %', v_inserted;
  end if;

  if (
    select count(*)
    from private.session_adaptations as a
    where a.user_id = '00000000-0000-4000-8000-0000000003a1'
  ) <> 5 then
    raise exception 'LEGACY_ADAPTATION_MARKERS_MISSING';
  end if;

  if not exists (
    select 1
    from private.session_adaptations as a
    where a.source_session_id = '00000000-0000-4000-8000-000000000301'
      and a.response_json -> 'reinforcement_session_ids' = jsonb_build_array(
        '00000000-0000-4000-8000-000000000302'::uuid,
        '00000000-0000-4000-8000-000000000303'::uuid
      )
  ) or not exists (
    select 1
    from private.session_adaptations as a
    where a.source_session_id = '00000000-0000-4000-8000-000000000302'
      and a.response_json -> 'reinforcement_session_ids' = jsonb_build_array(
        '00000000-0000-4000-8000-000000000304'::uuid,
        '00000000-0000-4000-8000-000000000305'::uuid
      )
  ) or not exists (
    select 1
    from private.session_adaptations as a
    where a.source_session_id = '00000000-0000-4000-8000-000000000303'
      and a.response_json -> 'reinforcement_session_ids' = jsonb_build_array(
        '00000000-0000-4000-8000-000000000306'::uuid
      )
  ) then
    raise exception 'LEGACY_ADAPTATION_CAUSAL_LINK_INVALID';
  end if;

  if exists (
    select 1
    from private.session_adaptations as a
    where a.source_session_id = '00000000-0000-4000-8000-000000000308'
  ) or not exists (
    select 1
    from private.session_adaptations as a
    where a.source_session_id = '00000000-0000-4000-8000-000000000309'
      and a.response_json -> 'reinforcement_session_ids' = jsonb_build_array(
        '00000000-0000-4000-8000-000000000310'::uuid
      )
  ) then
    raise exception 'LEGACY_ADAPTATION_GAP_ATTRIBUTED_TO_WRONG_SOURCE';
  end if;

  if not exists (
    select 1
    from private.session_adaptations as a
    where a.source_session_id = '00000000-0000-4000-8000-000000000313'
      and a.response_json ->> 'action' = 'advance'
      and a.response_json -> 'reinforcement_session_ids' = '[]'::jsonb
  ) then
    raise exception 'LEGACY_ADVANCE_ADAPTATION_NOT_BACKFILLED';
  end if;

  select count(*) into v_before_count
  from public.sessions
  where study_plan_id = '00000000-0000-4000-8000-0000000003a3';

  v_response := public.apply_session_adaptation_v2(
    '00000000-0000-4000-8000-0000000003a1',
    '00000000-0000-4000-8000-000000000302'
  );

  select count(*) into v_after_count
  from public.sessions
  where study_plan_id = '00000000-0000-4000-8000-0000000003a3';

  if v_response ->> 'already_processed' <> 'true'
    or v_before_count <> v_after_count
  then
    raise exception 'LEGACY_ADAPTATION_REAPPLIED';
  end if;

  begin
    insert into public.sessions (
      study_plan_id, user_id, topic_codes, session_type, day_number,
      attempt_number, method_used, status
    ) values (
      '00000000-0000-4000-8000-0000000003a3',
      '00000000-0000-4000-8000-0000000003a1',
      array['FL-2.1.1', 'FL-1.1.1'],
      'reinforcement', 13, 6, 'examples', 'pending'
    );
  exception
    when unique_violation then
      v_duplicate_rejected := true;
  end;

  if not v_duplicate_rejected then
    raise exception 'CANONICAL_ATTEMPT_DUPLICATE_ACCEPTED';
  end if;

  insert into public.sessions (
    id, study_plan_id, user_id, topic_codes, session_type, day_number,
    completed_at, duration_minutes, score_percent, attempt_number,
    method_used, action_taken, status, created_at
  ) values
    (
      '00000000-0000-4000-8000-000000000307',
      '00000000-0000-4000-8000-0000000003a3',
      '00000000-0000-4000-8000-0000000003a1',
      array['FL-9.9.9'],
      'morning', 16, '2026-07-01T10:00:00Z', 45, 60, 1,
      'theory', 'reinforce', 'completed', '2026-07-01T09:00:00Z'
    ),
    (
      '00000000-0000-4000-8000-000000000311',
      '00000000-0000-4000-8000-0000000003a3',
      '00000000-0000-4000-8000-0000000003a1',
      array['FL-9.9.9'],
      'night', 17, '2026-07-01T10:00:01Z', 45, 60, 2,
      'theory', 'reinforce', 'completed', '2026-07-01T09:30:00Z'
    ),
    (
      '00000000-0000-4000-8000-000000000312',
      '00000000-0000-4000-8000-0000000003a3',
      '00000000-0000-4000-8000-0000000003a1',
      array['FL-9.9.9'],
      'reinforcement', 18, null, 15, null, 3,
      'examples', null, 'pending', '2026-07-01T10:00:01.5Z'
    );

  insert into public.topic_progress (
    user_id, study_plan_id, topic_code, attempts, best_score, last_score,
    status, updated_at
  ) values (
    '00000000-0000-4000-8000-0000000003a1',
    '00000000-0000-4000-8000-0000000003a3',
    'FL-9.9.9', 1, 60, 60, 'in_progress', '2026-07-01T10:00:01Z'
  );

  if private.backfill_session_adaptations() <> 0 then
    raise exception 'AMBIGUOUS_CHILD_ASSIGNED_TO_NEAREST_SOURCE';
  end if;

  begin
    perform private.assert_no_ambiguous_legacy_adaptations();
  exception
    when sqlstate 'P0001' then
      if sqlerrm = 'LEGACY_ADAPTATION_EVIDENCE_AMBIGUOUS' then
        v_ambiguity_rejected := true;
      else
        raise;
      end if;
  end;

  if not v_ambiguity_rejected then
    raise exception 'AMBIGUOUS_LEGACY_ADAPTATION_ACCEPTED';
  end if;
end;
$$;

select extensions.pass(
  'legacy adaptations are linked without replay and canonical duplicate attempts are rejected'
);
select * from extensions.finish();

rollback;
