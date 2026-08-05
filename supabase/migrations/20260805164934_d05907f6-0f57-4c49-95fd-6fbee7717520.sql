CREATE OR REPLACE FUNCTION public.enforce_draft_season_roster_on_join()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_id uuid;
  v_is_playoff boolean;
  v_season_started boolean;
  v_is_season_player boolean;
BEGIN
  SELECT dse.season_id, dse.is_playoff
    INTO v_season_id, v_is_playoff
  FROM public.draft_season_entries dse
  WHERE dse.draft_id = NEW.draft_id;

  -- Standalone drafts keep their existing join behavior.
  IF v_season_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- A season is underway once any regular-season draft has left setup.
  SELECT EXISTS (
    SELECT 1
    FROM public.draft_season_entries prior_entry
    JOIN public.drafts prior_draft ON prior_draft.id = prior_entry.draft_id
    WHERE prior_entry.season_id = v_season_id
      AND prior_entry.is_playoff = false
      AND prior_draft.status <> 'setup'
  ) INTO v_season_started;

  -- A player belongs to the season roster after participating in any
  -- regular-season draft assigned to that season.
  SELECT EXISTS (
    SELECT 1
    FROM public.draft_season_entries roster_entry
    JOIN public.draft_participants roster_participant
      ON roster_participant.draft_id = roster_entry.draft_id
    WHERE roster_entry.season_id = v_season_id
      AND roster_entry.is_playoff = false
      AND roster_participant.user_id = NEW.user_id
  ) INTO v_is_season_player;

  IF (v_season_started OR v_is_playoff) AND NOT v_is_season_player THEN
    RAISE EXCEPTION 'Season roster is locked. Only existing season players can join this draft.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_draft_season_roster_on_join ON public.draft_participants;
CREATE TRIGGER enforce_draft_season_roster_on_join
BEFORE INSERT ON public.draft_participants
FOR EACH ROW
EXECUTE FUNCTION public.enforce_draft_season_roster_on_join();