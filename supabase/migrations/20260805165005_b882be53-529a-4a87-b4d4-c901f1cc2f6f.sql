REVOKE ALL ON FUNCTION public.enforce_draft_season_roster_on_join() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_draft_season_roster_on_join() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_draft_season_roster_on_join() FROM authenticated;

CREATE OR REPLACE FUNCTION public.enforce_season_roster_on_draft_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_season_started boolean;
  v_ineligible_count integer;
BEGIN
  -- Playoff assignments and assignments made after regular-season play begins
  -- may only contain players already established by another regular-season draft.
  SELECT EXISTS (
    SELECT 1
    FROM public.draft_season_entries prior_entry
    JOIN public.drafts prior_draft ON prior_draft.id = prior_entry.draft_id
    WHERE prior_entry.season_id = NEW.season_id
      AND prior_entry.draft_id <> NEW.draft_id
      AND prior_entry.is_playoff = false
      AND prior_draft.status <> 'setup'
  ) INTO v_season_started;

  IF v_season_started OR NEW.is_playoff THEN
    SELECT count(*)
      INTO v_ineligible_count
    FROM public.draft_participants candidate
    WHERE candidate.draft_id = NEW.draft_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.draft_season_entries roster_entry
        JOIN public.draft_participants roster_participant
          ON roster_participant.draft_id = roster_entry.draft_id
        WHERE roster_entry.season_id = NEW.season_id
          AND roster_entry.draft_id <> NEW.draft_id
          AND roster_entry.is_playoff = false
          AND roster_participant.user_id = candidate.user_id
      );

    IF v_ineligible_count > 0 THEN
      RAISE EXCEPTION 'This draft includes players who are not on the locked season roster.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_season_roster_on_draft_assignment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_season_roster_on_draft_assignment() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_season_roster_on_draft_assignment() FROM authenticated;

DROP TRIGGER IF EXISTS enforce_season_roster_on_draft_assignment ON public.draft_season_entries;
CREATE TRIGGER enforce_season_roster_on_draft_assignment
BEFORE INSERT OR UPDATE OF season_id, draft_id, is_playoff
ON public.draft_season_entries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_season_roster_on_draft_assignment();