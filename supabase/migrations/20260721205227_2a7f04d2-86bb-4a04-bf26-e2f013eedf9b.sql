CREATE OR REPLACE FUNCTION public.readshift_read_progress(_round_id uuid)
RETURNS TABLE(submitted integer, total integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare _game_id uuid; _phase text;
begin
  select r.game_id into _game_id from public.readshift_rounds r where r.id = _round_id;
  if _game_id is null then return; end if;
  if not exists (
    select 1 from public.readshift_participants p
    where p.game_id = _game_id and p.user_id = auth.uid() and p.active
  ) then
    return;
  end if;
  select g.phase into _phase from public.readshift_games g where g.id = _game_id;
  if _phase not in ('read', 'reveal') then
    return query select 0::int, (select count(*)::int from public.readshift_participants p where p.game_id = _game_id and p.active);
    return;
  end if;
  return query
    select
      (select count(distinct gs.reader_user_id)::int
         from public.readshift_guesses gs
        where gs.round_id = _round_id
          and gs.guessed_user_id is not null),
      (select count(*)::int
         from public.readshift_participants p
        where p.game_id = _game_id and p.active);
end;
$function$;

GRANT EXECUTE ON FUNCTION public.readshift_read_progress(uuid) TO authenticated;