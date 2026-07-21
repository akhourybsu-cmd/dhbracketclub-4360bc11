-- ═══════════════════════════════════════════════════════════════════
-- DH Club — READSHIFT (asynchronous social identity game)
--
--  1. Register the platform asset so it appears in the Asset Library / Games.
--  2. readshift_prompts: moderatable prompt library (+ seed the initial packs).
--  3. readshift_games: per-club game root (host = created_by), phase engine state.
--  4. readshift_participants: membership (soft-inactive, never hard-deleted).
--  5. readshift_rounds: one row per round (phase + deadlines + prompt).
--  6. readshift_signal_assignments: PRIVATE TELL/BLUR/FRAME + frame target.
--  7. readshift_answers: PRIVATE per-author answers (own-row RLS only).
--  8. readshift_guesses: PRIVATE per-reader ballot rows (own-row RLS only).
--  9. readshift_round_results: IMMUTABLE per-round scoring detail (reveal source).
-- 10. readshift_round_awards: deterministic fun awards.
-- 11. readshift_stats: per-(club,user) cumulative statistics.
-- 12. readshift_comments: post-reveal comments (per-feature pattern).
-- 13. Extend generic public.reactions CHECK with the 6 READSHIFT reactions.
-- 14. notification_preferences.readshift toggle.
-- 15. readshift_read_cards() SECURITY DEFINER RPC — the ONLY way to read
--     other players' (anonymous) answers, and only during read/reveal.
--
-- PRIVACY MODEL (defense in depth, server-authoritative):
--   • Signals, frame targets, answers and guesses are OWN-ROW RLS only —
--     no client SELECT ever returns another player's private row.
--   • The Read phase exposes other answers ONLY as anonymous {id, body}
--     via readshift_read_cards() (no author column leaves the DB).
--   • The Reveal phase's attribution/guess distribution/points come solely
--     from readshift_round_results, which the scoring edge function writes
--     immutably once the round is finalized. Raw private tables never leak.
--   • Scoring/advancement are performed by the edge function (service role);
--     clients cannot INSERT results or mutate phase illegally.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Asset registration ────────────────────────────────────────
-- Registered DORMANT (is_active = false) so it does not surface in the Asset
-- Library until the UI-wiring phase flips it on. This keeps the live app free
-- of a half-built, installable-but-inert asset while the tables land.
insert into public.platform_assets
  (name, slug, category, short_description, full_description, icon_name, placement_area, requires_configuration, is_premium, sort_order, is_active)
values
  ('READSHIFT', 'readshift', 'games',
   'Answer prompts while secretly steering how the group reads you. Async social deduction.',
   'READSHIFT is an asynchronous social identity game. Each round you privately get a Signal — TELL (be recognizably you), BLUR (blend in), or FRAME (sound like someone else) — then everyone anonymously guesses who wrote what. Play on your own schedule; a round advances through locked Shift, Read, and Reveal phases so nobody sees information early. 4–12 players, 3–7 rounds.',
   'VenetianMask', 'games', false, false, 55, false)
on conflict (slug) do update set
  name                   = excluded.name,
  short_description      = excluded.short_description,
  full_description       = excluded.full_description,
  icon_name              = excluded.icon_name,
  category               = excluded.category,
  placement_area         = excluded.placement_area,
  requires_configuration = excluded.requires_configuration,
  sort_order             = excluded.sort_order;
  -- NOTE: is_active intentionally NOT set here; the UI-wiring migration activates it.

-- ── 14. Notification preference toggle ───────────────────────────
alter table public.notification_preferences
  add column if not exists readshift boolean not null default true;

-- ── 13. Extend the generic reactions CHECK with READSHIFT reactions ──
-- Additive superset — existing rows stay valid.
alter table public.reactions drop constraint if exists reactions_reaction_type_check;
alter table public.reactions add constraint reactions_reaction_type_check
  check (reaction_type in (
    'fraud','elite','horrible_take','robbery','respect','cooked',
    'knew_it','you_got_me','absolutely_not','too_accurate','identity_theft','explain_yourself'
  ));

-- ── 2. Prompt library ────────────────────────────────────────────
create table if not exists public.readshift_prompts (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  body        text not null,
  mode        text not null default 'family' check (mode in ('family','adult')),
  is_group    boolean not null default false,   -- "Group Energy" style prompts
  is_active   boolean not null default true,
  -- club_id null = global library prompt; non-null = a club's custom prompt.
  club_id     uuid references public.clubs(id) on delete cascade,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_readshift_prompts_active on public.readshift_prompts(is_active, mode);
create index if not exists idx_readshift_prompts_club on public.readshift_prompts(club_id);

drop trigger if exists trg_readshift_prompts_updated_at on public.readshift_prompts;
create trigger trg_readshift_prompts_updated_at before update on public.readshift_prompts
  for each row execute procedure public.set_updated_at();

-- Seed the global family-friendly library (idempotent by body+category).
insert into public.readshift_prompts (category, body, mode, is_group)
select v.category, v.body, 'family', v.is_group
from (values
  ('Everyday You','What food could you happily eat three days in a row?', false),
  ('Everyday You','What unnecessary purchase would you never regret?', false),
  ('Everyday You','What small inconvenience bothers you far more than it should?', false),
  ('Everyday You','What is your ideal lazy Sunday activity?', false),
  ('Unhinged Hypotheticals','What animal would make the worst roommate?', false),
  ('Unhinged Hypotheticals','What useless superpower would you still want?', false),
  ('Unhinged Hypotheticals','What ordinary object would become terrifying if it were ten times larger?', false),
  ('Unhinged Hypotheticals','What job would you be hilariously unqualified to perform?', false),
  ('Hot Takes','What popular food is aggressively overrated?', false),
  ('Hot Takes','What commonly loved activity do you not understand?', false),
  ('Hot Takes','What minor social rule should disappear?', false),
  ('Hot Takes','What entertainment franchise receives too much attention?', false),
  ('Throwbacks','What childhood purchase made you feel rich?', false),
  ('Throwbacks','What discontinued product should return?', false),
  ('Throwbacks','What school-day experience do you strangely miss?', false),
  ('Throwbacks','What childhood television show deserves another chance?', false),
  ('Group Energy','What would get someone in this group removed from a fancy event?', true),
  ('Group Energy','Who in this group would handle a surprise road trip best?', true),
  ('Group Energy','What activity would create the most chaos for this group?', true),
  ('Group Energy','What business could this group absolutely not run together?', true)
) as v(category, body, is_group)
where not exists (
  select 1 from public.readshift_prompts p
  where p.club_id is null and p.body = v.body and p.category = v.category
);

-- ── 3. Games ─────────────────────────────────────────────────────
create table if not exists public.readshift_games (
  id                        uuid primary key default gen_random_uuid(),
  club_id                   uuid not null references public.clubs(id) on delete cascade,
  created_by                uuid not null references auth.users(id),
  name                      text not null,
  -- Authoritative phase (doubles as status); mirrors src/lib/readshift Phase.
  phase                     text not null default 'lobby'
                              check (phase in ('lobby','shift','read','reveal','completed','paused','cancelled')),
  current_round             integer not null default 0,
  total_rounds              integer not null default 5 check (total_rounds between 3 and 7),
  shift_hours               integer not null default 24,
  read_hours                integer not null default 24,
  reveal_hours              integer not null default 12,
  early_advance             boolean not null default true,
  prompt_mode               text not null default 'family' check (prompt_mode in ('family','adult')),
  prompt_categories         text[] not null default '{}',
  allow_custom_prompts      boolean not null default false,
  allow_reveal_explanations boolean not null default true,
  strong_read_explanations  boolean not null default true,
  reminders_enabled         boolean not null default true,
  phase_deadline            timestamptz,
  -- Deterministic seed for signal assignment; set once, immutable.
  seed                      bigint not null default (floor(random() * 2147483647))::bigint,
  paused_from_phase         text,
  -- Optimistic-concurrency guard for phase transitions (compare-and-swap).
  version                   integer not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  completed_at              timestamptz
);
create index if not exists idx_readshift_games_club on public.readshift_games(club_id);
create index if not exists idx_readshift_games_phase on public.readshift_games(phase);
create index if not exists idx_readshift_games_deadline on public.readshift_games(phase_deadline)
  where phase in ('shift','read','reveal');

drop trigger if exists trg_readshift_games_updated_at on public.readshift_games;
create trigger trg_readshift_games_updated_at before update on public.readshift_games
  for each row execute procedure public.set_updated_at();

-- ── 4. Participants ──────────────────────────────────────────────
create table if not exists public.readshift_participants (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  game_id     uuid not null references public.readshift_games(id) on delete cascade,
  user_id     uuid not null references auth.users(id),
  active      boolean not null default true,   -- soft-remove; history preserved
  joined_at   timestamptz not null default now(),
  unique (game_id, user_id)
);
create index if not exists idx_readshift_participants_club on public.readshift_participants(club_id);
create index if not exists idx_readshift_participants_game on public.readshift_participants(game_id);
create index if not exists idx_readshift_participants_user on public.readshift_participants(user_id);

-- ── 5. Rounds ────────────────────────────────────────────────────
create table if not exists public.readshift_rounds (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  game_id        uuid not null references public.readshift_games(id) on delete cascade,
  round_number   integer not null,
  prompt_id      uuid references public.readshift_prompts(id),
  prompt_snapshot text,   -- denormalized prompt text (prompt may be edited/removed later)
  phase          text not null default 'shift'
                   check (phase in ('shift','read','reveal','completed','cancelled')),
  shift_deadline  timestamptz,
  read_deadline   timestamptz,
  reveal_deadline timestamptz,
  voided         boolean not null default false,  -- < MIN_VALID_ANSWERS → round voided
  scored_at      timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (game_id, round_number)
);
create index if not exists idx_readshift_rounds_club on public.readshift_rounds(club_id);
create index if not exists idx_readshift_rounds_game on public.readshift_rounds(game_id);

drop trigger if exists trg_readshift_rounds_updated_at on public.readshift_rounds;
create trigger trg_readshift_rounds_updated_at before update on public.readshift_rounds
  for each row execute procedure public.set_updated_at();

-- ── 6. Signal assignments (PRIVATE) ──────────────────────────────
create table if not exists public.readshift_signal_assignments (
  id                    uuid primary key default gen_random_uuid(),
  club_id               uuid not null references public.clubs(id) on delete cascade,
  round_id              uuid not null references public.readshift_rounds(id) on delete cascade,
  user_id               uuid not null references auth.users(id),
  signal                text not null check (signal in ('TELL','BLUR','FRAME')),
  frame_target_user_id  uuid references auth.users(id),
  created_at            timestamptz not null default now(),
  unique (round_id, user_id)
);
create index if not exists idx_readshift_signals_round on public.readshift_signal_assignments(round_id);

-- ── 7. Answers (PRIVATE own-row) ─────────────────────────────────
create table if not exists public.readshift_answers (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  round_id    uuid not null references public.readshift_rounds(id) on delete cascade,
  user_id     uuid not null references auth.users(id),
  body        text not null,
  locked      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (round_id, user_id)
);
create index if not exists idx_readshift_answers_round on public.readshift_answers(round_id);

drop trigger if exists trg_readshift_answers_updated_at on public.readshift_answers;
create trigger trg_readshift_answers_updated_at before update on public.readshift_answers
  for each row execute procedure public.set_updated_at();

-- ── 8. Guesses / ballot rows (PRIVATE own-row) ───────────────────
create table if not exists public.readshift_guesses (
  id                uuid primary key default gen_random_uuid(),
  club_id           uuid not null references public.clubs(id) on delete cascade,
  round_id          uuid not null references public.readshift_rounds(id) on delete cascade,
  reader_user_id    uuid not null references auth.users(id),
  answer_id         uuid not null references public.readshift_answers(id) on delete cascade,
  guessed_user_id   uuid references auth.users(id),
  is_strong_read    boolean not null default false,
  explanation       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (round_id, reader_user_id, answer_id)
);
create index if not exists idx_readshift_guesses_round_reader on public.readshift_guesses(round_id, reader_user_id);

drop trigger if exists trg_readshift_guesses_updated_at on public.readshift_guesses;
create trigger trg_readshift_guesses_updated_at before update on public.readshift_guesses
  for each row execute procedure public.set_updated_at();

-- ── 9. Round results (IMMUTABLE reveal source) ───────────────────
create table if not exists public.readshift_round_results (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid not null references public.clubs(id) on delete cascade,
  game_id       uuid not null references public.readshift_games(id) on delete cascade,
  round_id      uuid not null references public.readshift_rounds(id) on delete cascade,
  -- Full per-answer reveal detail (author, signal, frame target, guess
  -- distribution, strong reads, points) — shaped like src/lib/readshift RoundScore.
  detail        jsonb not null default '{}'::jsonb,
  reading_points jsonb not null default '{}'::jsonb,
  signal_points  jsonb not null default '{}'::jsonb,
  total_points   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (round_id)
);
create index if not exists idx_readshift_results_game on public.readshift_round_results(game_id);

-- ── 10. Round awards ─────────────────────────────────────────────
create table if not exists public.readshift_round_awards (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  game_id     uuid not null references public.readshift_games(id) on delete cascade,
  round_id    uuid not null references public.readshift_rounds(id) on delete cascade,
  award_key   text not null,
  label       text not null,
  user_id     uuid not null references auth.users(id),
  value       numeric not null default 0,
  created_at  timestamptz not null default now(),
  unique (round_id, award_key)
);
create index if not exists idx_readshift_awards_game on public.readshift_round_awards(game_id);

-- ── 11. Per-user cumulative stats ────────────────────────────────
create table if not exists public.readshift_stats (
  id                    uuid primary key default gen_random_uuid(),
  club_id               uuid not null references public.clubs(id) on delete cascade,
  user_id               uuid not null references auth.users(id),
  games_played          integer not null default 0,
  games_won             integer not null default 0,
  total_score           numeric not null default 0,
  rounds_played         integer not null default 0,
  correct_reads         integer not null default 0,
  eligible_reads        integer not null default 0,
  correct_strong_reads  integer not null default 0,
  strong_reads          integer not null default 0,
  tell_success          integer not null default 0,
  tell_rounds           integer not null default 0,
  blur_success          integer not null default 0,
  blur_rounds           integer not null default 0,
  frame_success         integer not null default 0,
  frame_rounds          integer not null default 0,
  -- Relationship tallies (only surfaced past a sample-size threshold in the UI).
  pairings              jsonb not null default '{}'::jsonb,
  updated_at            timestamptz not null default now(),
  unique (club_id, user_id)
);
create index if not exists idx_readshift_stats_club on public.readshift_stats(club_id);

drop trigger if exists trg_readshift_stats_updated_at on public.readshift_stats;
create trigger trg_readshift_stats_updated_at before update on public.readshift_stats
  for each row execute procedure public.set_updated_at();

-- ── 12. Post-reveal comments ─────────────────────────────────────
create table if not exists public.readshift_comments (
  id          uuid primary key default gen_random_uuid(),
  club_id     uuid not null references public.clubs(id) on delete cascade,
  round_id    uuid not null references public.readshift_rounds(id) on delete cascade,
  answer_id   uuid references public.readshift_answers(id) on delete cascade,
  user_id     uuid not null references auth.users(id),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_readshift_comments_round on public.readshift_comments(round_id);

-- ═══════════════════════════════════════════════════════════════════
-- Row-level security
-- Helper predicate (inlined): caller is an ACTIVE participant of a game.
-- ═══════════════════════════════════════════════════════════════════
alter table public.readshift_prompts             enable row level security;
alter table public.readshift_games               enable row level security;
alter table public.readshift_participants         enable row level security;
alter table public.readshift_rounds              enable row level security;
alter table public.readshift_signal_assignments  enable row level security;
alter table public.readshift_answers             enable row level security;
alter table public.readshift_guesses             enable row level security;
alter table public.readshift_round_results       enable row level security;
alter table public.readshift_round_awards        enable row level security;
alter table public.readshift_stats               enable row level security;
alter table public.readshift_comments            enable row level security;

-- Prompts: club members read global + their club's prompts; club admins manage custom prompts.
drop policy if exists "rs prompts: read" on public.readshift_prompts;
create policy "rs prompts: read" on public.readshift_prompts for select to authenticated
  using (
    is_active and (
      club_id is null
      or exists (select 1 from public.club_members cm where cm.club_id = readshift_prompts.club_id and cm.user_id = auth.uid())
    )
  );
drop policy if exists "rs prompts: admin manage" on public.readshift_prompts;
create policy "rs prompts: admin manage" on public.readshift_prompts for all to authenticated
  using (club_id is not null and public.is_club_admin(auth.uid(), club_id))
  with check (club_id is not null and public.is_club_admin(auth.uid(), club_id) and created_by = auth.uid());

-- Games: any club member can read games in their club; members create; host/admin update.
drop policy if exists "rs games: read" on public.readshift_games;
create policy "rs games: read" on public.readshift_games for select to authenticated
  using (exists (select 1 from public.club_members cm where cm.club_id = readshift_games.club_id and cm.user_id = auth.uid()));
drop policy if exists "rs games: create" on public.readshift_games;
create policy "rs games: create" on public.readshift_games for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.club_members cm where cm.club_id = readshift_games.club_id and cm.user_id = auth.uid())
  );
drop policy if exists "rs games: host or admin update" on public.readshift_games;
create policy "rs games: host or admin update" on public.readshift_games for update to authenticated
  using (created_by = auth.uid() or public.is_club_admin(auth.uid(), club_id) or public.is_app_admin(auth.uid()))
  with check (created_by = auth.uid() or public.is_club_admin(auth.uid(), club_id) or public.is_app_admin(auth.uid()));

-- Participants: club members read; a user may add/update/remove THEIR OWN row
-- (join / leave); host & admins manage any participant of their games.
drop policy if exists "rs participants: read" on public.readshift_participants;
create policy "rs participants: read" on public.readshift_participants for select to authenticated
  using (exists (select 1 from public.club_members cm where cm.club_id = readshift_participants.club_id and cm.user_id = auth.uid()));
drop policy if exists "rs participants: self join" on public.readshift_participants;
create policy "rs participants: self join" on public.readshift_participants for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.club_members cm where cm.club_id = readshift_participants.club_id and cm.user_id = auth.uid())
  );
drop policy if exists "rs participants: self update" on public.readshift_participants;
create policy "rs participants: self update" on public.readshift_participants for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists "rs participants: host manage" on public.readshift_participants;
create policy "rs participants: host manage" on public.readshift_participants for all to authenticated
  using (exists (
    select 1 from public.readshift_games g
    where g.id = readshift_participants.game_id
      and (g.created_by = auth.uid() or public.is_club_admin(auth.uid(), g.club_id) or public.is_app_admin(auth.uid()))
  ))
  with check (exists (
    select 1 from public.readshift_games g
    where g.id = readshift_participants.game_id
      and (g.created_by = auth.uid() or public.is_club_admin(auth.uid(), g.club_id) or public.is_app_admin(auth.uid()))
  ));

-- Rounds: readable by participants of the game (no private data in this table).
drop policy if exists "rs rounds: read" on public.readshift_rounds;
create policy "rs rounds: read" on public.readshift_rounds for select to authenticated
  using (exists (
    select 1 from public.readshift_participants p
    where p.game_id = readshift_rounds.game_id and p.user_id = auth.uid()
  ));

-- Signal assignments: OWN ROW ONLY. Never exposed to anyone else, ever.
drop policy if exists "rs signals: own read" on public.readshift_signal_assignments;
create policy "rs signals: own read" on public.readshift_signal_assignments for select to authenticated
  using (user_id = auth.uid());

-- Answers: OWN ROW ONLY (read/insert/update). Others' bodies come only from
-- readshift_read_cards() during read/reveal; attribution only from results.
drop policy if exists "rs answers: own read" on public.readshift_answers;
create policy "rs answers: own read" on public.readshift_answers for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "rs answers: own write" on public.readshift_answers;
create policy "rs answers: own write" on public.readshift_answers for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.readshift_rounds r
      join public.readshift_participants p on p.game_id = r.game_id
      where r.id = readshift_answers.round_id and p.user_id = auth.uid() and p.active
    )
  );
drop policy if exists "rs answers: own update" on public.readshift_answers;
create policy "rs answers: own update" on public.readshift_answers for update to authenticated
  using (user_id = auth.uid() and locked = false)
  with check (user_id = auth.uid());

-- Guesses: OWN ROW ONLY until reveal; the reveal aggregates live in results.
drop policy if exists "rs guesses: own read" on public.readshift_guesses;
create policy "rs guesses: own read" on public.readshift_guesses for select to authenticated
  using (reader_user_id = auth.uid());
drop policy if exists "rs guesses: own write" on public.readshift_guesses;
create policy "rs guesses: own write" on public.readshift_guesses for insert to authenticated
  with check (reader_user_id = auth.uid());
drop policy if exists "rs guesses: own update" on public.readshift_guesses;
create policy "rs guesses: own update" on public.readshift_guesses for update to authenticated
  using (reader_user_id = auth.uid())
  with check (reader_user_id = auth.uid());

-- Round results / awards: readable by participants once written (reveal source).
-- No client INSERT/UPDATE policy → only the service-role edge function writes them.
drop policy if exists "rs results: read" on public.readshift_round_results;
create policy "rs results: read" on public.readshift_round_results for select to authenticated
  using (exists (select 1 from public.readshift_participants p where p.game_id = readshift_round_results.game_id and p.user_id = auth.uid()));
drop policy if exists "rs awards: read" on public.readshift_round_awards;
create policy "rs awards: read" on public.readshift_round_awards for select to authenticated
  using (exists (select 1 from public.readshift_participants p where p.game_id = readshift_round_awards.game_id and p.user_id = auth.uid()));

-- Stats: readable by club members (playful, aggregate). Written by service role only.
drop policy if exists "rs stats: read" on public.readshift_stats;
create policy "rs stats: read" on public.readshift_stats for select to authenticated
  using (exists (select 1 from public.club_members cm where cm.club_id = readshift_stats.club_id and cm.user_id = auth.uid()));

-- Comments: participants read; participants create their own; author or admin deletes.
drop policy if exists "rs comments: read" on public.readshift_comments;
create policy "rs comments: read" on public.readshift_comments for select to authenticated
  using (exists (
    select 1 from public.readshift_rounds r
    join public.readshift_participants p on p.game_id = r.game_id
    where r.id = readshift_comments.round_id and p.user_id = auth.uid()
  ));
drop policy if exists "rs comments: create" on public.readshift_comments;
create policy "rs comments: create" on public.readshift_comments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.readshift_rounds r
      join public.readshift_participants p on p.game_id = r.game_id
      where r.id = readshift_comments.round_id and p.user_id = auth.uid()
    )
  );
drop policy if exists "rs comments: delete own or admin" on public.readshift_comments;
create policy "rs comments: delete own or admin" on public.readshift_comments for delete to authenticated
  using (user_id = auth.uid() or public.is_club_admin(auth.uid(), club_id) or public.is_app_admin(auth.uid()));

-- ═══════════════════════════════════════════════════════════════════
-- 15. readshift_read_cards() — the ONLY server-side read path for other
-- players' answers, returning anonymous {answer_id, body} and only when
-- the round is in read/reveal. Author identity never leaves the DB here.
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.readshift_read_cards(_round_id uuid)
returns table (answer_id uuid, body text)
language plpgsql stable security definer set search_path = public
as $$
declare
  _game_id uuid;
  _phase text;
begin
  select r.game_id into _game_id from public.readshift_rounds r where r.id = _round_id;
  if _game_id is null then return; end if;

  -- Caller must be an active participant of the game.
  if not exists (
    select 1 from public.readshift_participants p
    where p.game_id = _game_id and p.user_id = auth.uid() and p.active
  ) then
    return;
  end if;

  select g.phase into _phase from public.readshift_games g where g.id = _game_id;
  if _phase not in ('read', 'reveal') then
    return;  -- never expose answers during shift/lobby
  end if;

  return query
    select a.id, a.body
    from public.readshift_answers a
    where a.round_id = _round_id and a.locked = true;
end;
$$;
grant execute on function public.readshift_read_cards(uuid) to authenticated;

-- Realtime for the live-updating surfaces (game phase + participant list).
alter publication supabase_realtime add table public.readshift_games;
alter publication supabase_realtime add table public.readshift_participants;
alter publication supabase_realtime add table public.readshift_rounds;
