-- ═══════════════════════════════════════════════════════════════════
-- FORGE — automated weekly notification cycle
--
-- Three scheduled nudges, all written as durable in-app notification rows
-- (the same inbox the app's bell + realtime already render). Pure SQL via
-- pg_cron — no edge-function/push infra required. Each insert is deduped so
-- re-runs / multiple fires in a week can't spam a member.
--
--   • Monday   — "new gauntlet dropped" (fires after the weekly roll)
--   • Thursday — mid-week nudge to members who haven't logged yet
--   • Sunday   — "final hours" before the week resets
--
-- Device push (closed app) can be layered on later by calling the existing
-- send-push-notification edge function; this cycle covers the in-app inbox.
-- ═══════════════════════════════════════════════════════════════════

-- ── Monday: a fresh gauntlet is live ────────────────────────────────
create or replace function public.forge_notify_new_weeks()
returns void language plpgsql security definer set search_path = public as $$
declare v_start timestamptz;
begin
  select starts_at into v_start from public.forge_monday_bounds();
  insert into public.notifications (user_id, club_id, type, title, body, url)
  select m.user_id, w.club_id, 'forge',
         '🔥 New gauntlet: ' || w.title,
         'This week''s FORGE is live — go stoke the club flame.',
         '/workouts'
  from public.workout_weeks w
  join public.club_members m on m.club_id = w.club_id
  where w.status = 'active' and w.starts_at = v_start
    and not exists (
      select 1 from public.notifications n
      where n.user_id = m.user_id and n.type = 'forge'
        and n.title like '🔥 New gauntlet%' and n.created_at >= w.starts_at
    );
end $$;

-- ── Thursday: members who haven't logged yet this week ──────────────
create or replace function public.forge_notify_midweek()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, club_id, type, title, body, url)
  select m.user_id, w.club_id, 'forge',
         'Don''t let the flame die 🔥',
         'You haven''t logged a workout this week — jump in and stoke the club flame.',
         '/workouts'
  from public.workout_weeks w
  join public.club_members m on m.club_id = w.club_id
  where w.status = 'active' and now() < w.ends_at
    and not exists (
      select 1 from public.workout_activities a
      where a.week_id = w.id and a.user_id = m.user_id and a.status = 'active'
    )
    and not exists (
      select 1 from public.notifications n
      where n.user_id = m.user_id and n.type = 'forge'
        and n.title like 'Don''t let the flame%' and n.created_at >= w.starts_at
    );
end $$;

-- ── Sunday: final hours before the reset ────────────────────────────
create or replace function public.forge_notify_final_hours()
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, club_id, type, title, body, url)
  select m.user_id, w.club_id, 'forge',
         '⏳ Final hours',
         'The gauntlet resets soon — last chance to stoke the flame and climb the roster.',
         '/workouts'
  from public.workout_weeks w
  join public.club_members m on m.club_id = w.club_id
  where w.status = 'active' and w.ends_at between now() and now() + interval '36 hours'
    and not exists (
      select 1 from public.notifications n
      where n.user_id = m.user_id and n.type = 'forge'
        and n.title like '⏳ Final hours%' and n.created_at >= w.starts_at
    );
end $$;

-- ── Schedules (UTC) ─────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'forge-notify-new')   then perform cron.unschedule('forge-notify-new');   end if;
  if exists (select 1 from cron.job where jobname = 'forge-notify-mid')   then perform cron.unschedule('forge-notify-mid');   end if;
  if exists (select 1 from cron.job where jobname = 'forge-notify-final') then perform cron.unschedule('forge-notify-final'); end if;
exception when others then null;
end $$;

select cron.schedule('forge-notify-new',   '5 0 * * 1',  $$ select public.forge_notify_new_weeks();   $$); -- Mon 00:05 UTC (just after the roll)
select cron.schedule('forge-notify-mid',   '0 17 * * 4', $$ select public.forge_notify_midweek();     $$); -- Thu 17:00 UTC
select cron.schedule('forge-notify-final', '0 12 * * 0', $$ select public.forge_notify_final_hours(); $$); -- Sun 12:00 UTC
