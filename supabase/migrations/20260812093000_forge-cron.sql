-- ═══════════════════════════════════════════════════════════════════
-- FORGE — automatic weekly reset (server-side, every Monday)
--
-- A pg_cron job rolls every eligible club's gauntlet at Monday 00:00 UTC,
-- so the week resets whether or not anyone opens the app. The on-open RPC
-- (ensure_forge_week) remains a fallback / cold-start seeder.
--
-- Both paths key the week on the SAME UTC-Monday `starts_at` and share an
-- advisory lock (by club + ISO week number, tz-independent), so they can
-- never create duplicate weeks for the same Monday.
--
-- Requires the pg_cron extension. On Supabase, enable it once under
-- Database → Extensions (or the CREATE EXTENSION below if your role allows).
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pg_cron;

-- UTC Monday 00:00 → next UTC Monday 00:00.
create or replace function public.forge_monday_bounds(out starts_at timestamptz, out ends_at timestamptz)
language sql stable as $$
  select
    (date_trunc('week', (now() at time zone 'utc'))) at time zone 'utc',
    ((date_trunc('week', (now() at time zone 'utc'))) at time zone 'utc') + interval '7 days';
$$;

-- Shared advisory-lock key helper: serializes on-open + cron for a club+week.
create or replace function public.forge_week_lock(p_club_id uuid, p_starts_at timestamptz)
returns void language sql as $$
  select pg_advisory_xact_lock(
    hashtext(p_club_id::text),
    (floor(extract(epoch from p_starts_at) / 604800))::int
  );
$$;

-- ─── On-open RPC (re-declared to use the shared lock) ───────────────
create or replace function public.ensure_forge_week(
  p_club_id   uuid,
  p_starts_at timestamptz,
  p_ends_at   timestamptz,
  p_title     text,
  p_theme     text,
  p_exercises jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_week_id uuid;
  v_ex jsonb;
  v_ex_id uuid;
  v_idx int := 0;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.club_members where club_id = p_club_id and user_id = v_uid) then
    raise exception 'not a club member';
  end if;

  perform public.forge_week_lock(p_club_id, p_starts_at);

  select id into v_week_id from public.workout_weeks
    where club_id = p_club_id and starts_at = p_starts_at order by created_at limit 1;
  if v_week_id is not null then return v_week_id; end if;

  insert into public.workout_weeks (club_id, title, theme, starts_at, ends_at, status, created_by)
    values (p_club_id, p_title, p_theme, p_starts_at, p_ends_at, 'active', v_uid)
    returning id into v_week_id;

  for v_ex in select * from jsonb_array_elements(p_exercises)
  loop
    select id into v_ex_id from public.workout_exercises
      where club_id = p_club_id and name = (v_ex->>'name') limit 1;
    if v_ex_id is null then
      insert into public.workout_exercises
        (club_id, name, category, measurement_type, unit, logging_config, scoring_config, default_weekly_goal, milestone_config, icon_name, active, created_by)
      values (
        p_club_id, v_ex->>'name', coalesce(v_ex->>'category','other'), v_ex->>'measurement_type',
        coalesce(v_ex->>'unit','reps'), coalesce(v_ex->'logging_config','{}'::jsonb),
        coalesce(v_ex->'scoring_config','{}'::jsonb), nullif(v_ex->>'default_weekly_goal','')::numeric,
        coalesce(v_ex->'milestone_config','{}'::jsonb), v_ex->>'icon_name', true, v_uid
      ) returning id into v_ex_id;
    else
      update public.workout_exercises set
        logging_config = coalesce(v_ex->'logging_config', logging_config),
        scoring_config = coalesce(v_ex->'scoring_config', scoring_config),
        default_weekly_goal = coalesce(nullif(v_ex->>'default_weekly_goal','')::numeric, default_weekly_goal),
        milestone_config = coalesce(v_ex->'milestone_config', milestone_config),
        icon_name = coalesce(v_ex->>'icon_name', icon_name), active = true
      where id = v_ex_id;
    end if;
    insert into public.workout_week_exercises (week_id, exercise_id, goal, scoring_config, sort_order)
      values (v_week_id, v_ex_id, nullif(v_ex->>'goal','')::numeric, '{}'::jsonb, v_idx)
      on conflict (week_id, exercise_id) do nothing;
    v_idx := v_idx + 1;
  end loop;
  return v_week_id;
end $$;
grant execute on function public.ensure_forge_week(uuid, timestamptz, timestamptz, text, text, jsonb) to authenticated;

-- ─── Roll one club (server-side; builds from the club's active library) ──
create or replace function public.forge_roll_club(p_club_id uuid, p_starts_at timestamptz, p_ends_at timestamptz)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_week_id uuid;
  v_idx int := floor(extract(epoch from p_starts_at) / 604800)::int;
  v_cat text;
  v_ex_id uuid;
  v_sort int := 0;
  v_title text;
  v_titles text[] := array['Full Body Blitz','Iron Monday','The Grind','Sweat Equity','Forge Ahead','Burn Week','No Days Off','The Anvil','Heat Wave','Molten Monday'];
begin
  perform public.forge_week_lock(p_club_id, p_starts_at);

  select id into v_week_id from public.workout_weeks
    where club_id = p_club_id and starts_at = p_starts_at order by created_at limit 1;
  if v_week_id is not null then return v_week_id; end if;

  v_title := v_titles[(v_idx % array_length(v_titles,1)) + 1];
  insert into public.workout_weeks (club_id, title, theme, starts_at, ends_at, status)
    values (p_club_id, v_title, 'Weekly Gauntlet', p_starts_at, p_ends_at, 'active')
    returning id into v_week_id;

  -- One exercise per core category + a mobility/full-body wildcard, rotating.
  foreach v_cat in array array['upper_body','lower_body','core','cardio','__wild']
  loop
    if v_cat = '__wild' then
      select id into v_ex_id from public.workout_exercises
        where club_id = p_club_id and active and category in ('mobility','full_body')
        order by created_at
        offset (v_idx % greatest(1,(select count(*) from public.workout_exercises where club_id = p_club_id and active and category in ('mobility','full_body'))))
        limit 1;
    else
      select id into v_ex_id from public.workout_exercises
        where club_id = p_club_id and active and category = v_cat
        order by created_at
        offset (v_idx % greatest(1,(select count(*) from public.workout_exercises where club_id = p_club_id and active and category = v_cat)))
        limit 1;
    end if;

    if v_ex_id is not null then
      insert into public.workout_week_exercises (week_id, exercise_id, goal, scoring_config, sort_order)
        select v_week_id, we.id, we.default_weekly_goal, '{}'::jsonb, v_sort
        from public.workout_exercises we where we.id = v_ex_id
        on conflict (week_id, exercise_id) do nothing;
      v_sort := v_sort + 1;
    end if;
  end loop;

  return v_week_id;
end $$;

-- ─── Roll ALL eligible clubs (called by cron) ───────────────────────
create or replace function public.forge_roll_all()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_club uuid;
begin
  select starts_at, ends_at into v_start, v_end from public.forge_monday_bounds();

  -- Close out any week whose window has elapsed.
  update public.workout_weeks set status = 'completed'
    where status = 'active' and ends_at <= now();

  -- Roll every club that has FORGE enabled and at least one active exercise.
  for v_club in
    select distinct cia.club_id
    from public.club_installed_assets cia
    join public.platform_assets pa on pa.id = cia.asset_id
    where pa.slug = 'workout-competition' and cia.enabled
      and exists (select 1 from public.workout_exercises we where we.club_id = cia.club_id and we.active)
  loop
    perform public.forge_roll_club(v_club, v_start, v_end);
  end loop;
end $$;

-- ─── Schedule: every Monday 00:00 UTC ───────────────────────────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'forge-weekly-roll') then
    perform cron.unschedule('forge-weekly-roll');
  end if;
exception when others then null;
end $$;

select cron.schedule('forge-weekly-roll', '0 0 * * 1', $$ select public.forge_roll_all(); $$);
