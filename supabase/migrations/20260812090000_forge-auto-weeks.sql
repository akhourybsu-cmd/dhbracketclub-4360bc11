-- ═══════════════════════════════════════════════════════════════════
-- FORGE — self-running weekly gauntlets (auto week creation)
--
-- FORGE has no commissioner: the first member to open it on/after Monday
-- creates that week. Members can't write workout_weeks/workout_exercises
-- under RLS (admin-only), so this SECURITY DEFINER RPC does it safely —
-- membership-gated, idempotent, and race-safe via an advisory lock.
--
-- The exercise library (names, configs, tutorials) lives in the client
-- (src/lib/workout/library.ts); the caller passes the chosen week's
-- exercises as JSONB. The RPC upserts them by (club_id, name), creates the
-- week, and links them with per-week goals.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.ensure_forge_week(
  p_club_id   uuid,
  p_starts_at timestamptz,
  p_ends_at   timestamptz,
  p_title     text,
  p_theme     text,
  p_exercises jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_week_id uuid;
  v_ex      jsonb;
  v_ex_id   uuid;
  v_idx     int := 0;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.club_members where club_id = p_club_id and user_id = v_uid) then
    raise exception 'not a club member';
  end if;

  -- Serialize concurrent first-opens for the same club+week.
  perform pg_advisory_xact_lock(hashtext(p_club_id::text || ':' || p_starts_at::text));

  -- Idempotent: reuse an existing week starting at the same instant.
  select id into v_week_id from public.workout_weeks
    where club_id = p_club_id and starts_at = p_starts_at
    order by created_at limit 1;
  if v_week_id is not null then
    return v_week_id;
  end if;

  insert into public.workout_weeks (club_id, title, theme, starts_at, ends_at, status, created_by)
    values (p_club_id, p_title, p_theme, p_starts_at, p_ends_at, 'active', v_uid)
    returning id into v_week_id;

  for v_ex in select * from jsonb_array_elements(p_exercises)
  loop
    -- Upsert the exercise definition by (club_id, name).
    select id into v_ex_id from public.workout_exercises
      where club_id = p_club_id and name = (v_ex->>'name') limit 1;

    if v_ex_id is null then
      insert into public.workout_exercises
        (club_id, name, category, measurement_type, unit, logging_config, scoring_config, default_weekly_goal, milestone_config, icon_name, active, created_by)
      values (
        p_club_id,
        v_ex->>'name',
        coalesce(v_ex->>'category', 'other'),
        v_ex->>'measurement_type',
        coalesce(v_ex->>'unit', 'reps'),
        coalesce(v_ex->'logging_config', '{}'::jsonb),
        coalesce(v_ex->'scoring_config', '{}'::jsonb),
        nullif(v_ex->>'default_weekly_goal', '')::numeric,
        coalesce(v_ex->'milestone_config', '{}'::jsonb),
        v_ex->>'icon_name',
        true,
        v_uid
      )
      returning id into v_ex_id;
    else
      -- Keep the definition fresh with the latest library config.
      update public.workout_exercises set
        category = coalesce(v_ex->>'category', category),
        measurement_type = coalesce(v_ex->>'measurement_type', measurement_type),
        unit = coalesce(v_ex->>'unit', unit),
        logging_config = coalesce(v_ex->'logging_config', logging_config),
        scoring_config = coalesce(v_ex->'scoring_config', scoring_config),
        default_weekly_goal = coalesce(nullif(v_ex->>'default_weekly_goal','')::numeric, default_weekly_goal),
        milestone_config = coalesce(v_ex->'milestone_config', milestone_config),
        icon_name = coalesce(v_ex->>'icon_name', icon_name),
        active = true
      where id = v_ex_id;
    end if;

    insert into public.workout_week_exercises (week_id, exercise_id, goal, scoring_config, sort_order)
      values (v_week_id, v_ex_id, nullif(v_ex->>'goal', '')::numeric, '{}'::jsonb, v_idx)
      on conflict (week_id, exercise_id) do nothing;

    v_idx := v_idx + 1;
  end loop;

  return v_week_id;
end;
$$;

grant execute on function public.ensure_forge_week(uuid, timestamptz, timestamptz, text, text, jsonb) to authenticated;
