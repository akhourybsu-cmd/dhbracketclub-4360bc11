-- ═══════════════════════════════════════════════════════════════════
-- READSHIFT — progress & author-pool RPCs
--
-- The Shift/Read UIs need two facts that own-row RLS deliberately hides:
--   • how MANY players have responded (never WHO) — for a progress count.
--   • the set of author user_ids for the round (the guess pool), exposed
--     only during read/reveal — so a reader can attribute answers WITHOUT
--     the answer→author mapping ever leaking (that's the whole game).
-- Both are SECURITY DEFINER + participant-gated + phase-gated.
-- ═══════════════════════════════════════════════════════════════════

-- Count of submitted answers vs active players (identities never returned).
create or replace function public.readshift_shift_progress(_round_id uuid)
returns table (submitted integer, total integer)
language plpgsql stable security definer set search_path = public
as $$
declare _game_id uuid;
begin
  select r.game_id into _game_id from public.readshift_rounds r where r.id = _round_id;
  if _game_id is null then return; end if;
  if not exists (select 1 from public.readshift_participants p where p.game_id = _game_id and p.user_id = auth.uid() and p.active) then
    return;
  end if;
  return query
    select
      (select count(*)::int from public.readshift_answers a where a.round_id = _round_id),
      (select count(*)::int from public.readshift_participants p where p.game_id = _game_id and p.active);
end;
$$;
grant execute on function public.readshift_shift_progress(uuid) to authenticated;

-- The guess pool: user_ids who authored an answer this round. Only during
-- read/reveal. Returns WHO is in the pool, never which answer is whose.
create or replace function public.readshift_round_authors(_round_id uuid)
returns table (user_id uuid)
language plpgsql stable security definer set search_path = public
as $$
declare _game_id uuid; _phase text;
begin
  select r.game_id into _game_id from public.readshift_rounds r where r.id = _round_id;
  if _game_id is null then return; end if;
  if not exists (select 1 from public.readshift_participants p where p.game_id = _game_id and p.user_id = auth.uid() and p.active) then
    return;
  end if;
  select g.phase into _phase from public.readshift_games g where g.id = _game_id;
  if _phase not in ('read', 'reveal') then return; end if;
  return query
    select a.user_id from public.readshift_answers a where a.round_id = _round_id and a.locked = true;
end;
$$;
grant execute on function public.readshift_round_authors(uuid) to authenticated;

-- Count of readers who have submitted a COMPLETE ballot (for read progress).
create or replace function public.readshift_read_progress(_round_id uuid)
returns table (submitted integer, total integer)
language plpgsql stable security definer set search_path = public
as $$
declare _game_id uuid; _answers integer;
begin
  select r.game_id into _game_id from public.readshift_rounds r where r.id = _round_id;
  if _game_id is null then return; end if;
  if not exists (select 1 from public.readshift_participants p where p.game_id = _game_id and p.user_id = auth.uid() and p.active) then
    return;
  end if;
  select count(*)::int into _answers from public.readshift_answers a where a.round_id = _round_id and a.locked = true;
  return query
    with reader_counts as (
      select g.reader_user_id, count(*) filter (where g.guessed_user_id is not null) as guessed
      from public.readshift_guesses g where g.round_id = _round_id group by g.reader_user_id
    )
    select
      (select count(*)::int from reader_counts rc
         join public.readshift_participants p on p.user_id = rc.reader_user_id and p.game_id = _game_id and p.active
         -- a reader's ballot is "complete" when they've guessed every eligible (non-own) answer
         where rc.guessed >= greatest(_answers - (case when exists (
             select 1 from public.readshift_answers a2 where a2.round_id = _round_id and a2.user_id = rc.reader_user_id
           ) then 1 else 0 end), 0)
      ),
      (select count(*)::int from public.readshift_participants p where p.game_id = _game_id and p.active);
end;
$$;
grant execute on function public.readshift_read_progress(uuid) to authenticated;
