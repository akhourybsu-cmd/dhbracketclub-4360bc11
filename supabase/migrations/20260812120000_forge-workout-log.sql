-- ═══════════════════════════════════════════════════════════════════
-- FORGE — freeform workout log
--
-- A second, always-on way to log fitness alongside the Monday gauntlet.
-- A "session" is a container a member fills in pieces (each entry saves as
-- it's added); on finish it earns a point total that stokes the club flame
-- and lifetime XP — but NOT the weekly featured-exercise leaderboard.
--
-- Tables:
--   1. workout_log_sessions — one freeform session (in_progress | completed).
--   2. workout_log_entries  — the movements logged inside a session. Each is
--                             ONE library/custom exercise recorded in the
--                             shape its log_kind implies (sets, reps, seconds,
--                             distance). `points` is the FUEL that entry earns
--                             (cached at save — honor-system, same trust model
--                             as any manual raw log; raw values stored too).
--
-- Reuses public.set_updated_at(). RLS: club members read that club's
-- sessions/entries (so the flame total + a shared activity feed can sum
-- across the roster); members write only their own; admins may moderate.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Sessions ────────────────────────────────────────────────────
create table if not exists public.workout_log_sessions (
  id                  uuid        primary key default gen_random_uuid(),
  club_id             uuid        not null references public.clubs(id) on delete cascade,
  user_id             uuid        not null references auth.users(id) on delete cascade,
  title               text,
  status              text        not null default 'in_progress',
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  activity_local_date date        not null,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_workout_log_sessions_club        on public.workout_log_sessions(club_id);
create index if not exists idx_workout_log_sessions_club_status on public.workout_log_sessions(club_id, status);
create index if not exists idx_workout_log_sessions_user        on public.workout_log_sessions(user_id, status);
-- Fast lookup of a member's in-progress session (there should be ~one).
create index if not exists idx_workout_log_sessions_user_open   on public.workout_log_sessions(user_id) where status = 'in_progress';

-- ─── 2. Entries ─────────────────────────────────────────────────────
create table if not exists public.workout_log_entries (
  id             uuid        primary key default gen_random_uuid(),
  session_id     uuid        not null references public.workout_log_sessions(id) on delete cascade,
  club_id        uuid        not null references public.clubs(id) on delete cascade,
  user_id        uuid        not null references auth.users(id) on delete cascade,
  catalog_id     text,                                   -- library slug, or null for a custom movement
  exercise_name  text        not null,
  category       text,
  log_kind       text        not null,                  -- weight_reps | reps | duration | distance | cardio | completion
  sets           jsonb       not null default '[]'::jsonb,
  reps           integer,
  seconds        integer,
  distance_mi    numeric,
  unit           text,
  points         integer     not null default 0,
  sort_order     integer     not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists idx_workout_log_entries_session on public.workout_log_entries(session_id);
create index if not exists idx_workout_log_entries_club     on public.workout_log_entries(club_id);
create index if not exists idx_workout_log_entries_user     on public.workout_log_entries(user_id);

-- ─── updated_at trigger (sessions) ──────────────────────────────────
drop trigger if exists trg_workout_log_sessions_updated on public.workout_log_sessions;
create trigger trg_workout_log_sessions_updated
  before update on public.workout_log_sessions
  for each row execute function public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────
alter table public.workout_log_sessions enable row level security;
alter table public.workout_log_entries  enable row level security;

-- Sessions ---------------------------------------------------------------
drop policy if exists "Members read log sessions"   on public.workout_log_sessions;
drop policy if exists "Users write own log sessions" on public.workout_log_sessions;
drop policy if exists "Admins moderate log sessions" on public.workout_log_sessions;

create policy "Members read log sessions"
  on public.workout_log_sessions for select
  using (exists (select 1 from public.club_members
    where club_id = workout_log_sessions.club_id and user_id = auth.uid()));

create policy "Users write own log sessions"
  on public.workout_log_sessions for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.club_members
      where club_id = workout_log_sessions.club_id and user_id = auth.uid()));

create policy "Admins moderate log sessions"
  on public.workout_log_sessions for delete
  using (exists (select 1 from public.club_members
    where club_id = workout_log_sessions.club_id and user_id = auth.uid() and role = 'admin'));

-- Entries ----------------------------------------------------------------
drop policy if exists "Members read log entries"   on public.workout_log_entries;
drop policy if exists "Users write own log entries" on public.workout_log_entries;
drop policy if exists "Admins moderate log entries" on public.workout_log_entries;

create policy "Members read log entries"
  on public.workout_log_entries for select
  using (exists (select 1 from public.club_members
    where club_id = workout_log_entries.club_id and user_id = auth.uid()));

create policy "Users write own log entries"
  on public.workout_log_entries for all
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.club_members
      where club_id = workout_log_entries.club_id and user_id = auth.uid()));

create policy "Admins moderate log entries"
  on public.workout_log_entries for delete
  using (exists (select 1 from public.club_members
    where club_id = workout_log_entries.club_id and user_id = auth.uid() and role = 'admin'));

-- ─── Realtime ───────────────────────────────────────────────────────
-- Guarded so re-running can't error with 42710 (already in publication).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workout_log_sessions'
  ) then
    alter publication supabase_realtime add table public.workout_log_sessions;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'workout_log_entries'
  ) then
    alter publication supabase_realtime add table public.workout_log_entries;
  end if;
exception when others then null;
end $$;
