-- Add sequential numbering + subtitle to draft_seasons
ALTER TABLE public.draft_seasons
  ADD COLUMN IF NOT EXISTS season_number int,
  ADD COLUMN IF NOT EXISTS subtitle text;

-- Backfill season_number per club, ordered by starts_at then created_at
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY club_id
           ORDER BY starts_at ASC NULLS LAST, created_at ASC
         ) AS rn
  FROM public.draft_seasons
)
UPDATE public.draft_seasons s
   SET season_number = r.rn
  FROM ranked r
 WHERE s.id = r.id AND s.season_number IS NULL;

-- Drop old unique (year, season_label) constraint if present
DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c
    FROM pg_constraint
   WHERE conrelid = 'public.draft_seasons'::regclass
     AND contype = 'u'
     AND pg_get_constraintdef(oid) ILIKE '%(year, season_label)%';
  IF c IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.draft_seasons DROP CONSTRAINT ' || quote_ident(c);
  END IF;
END $$;

-- Make legacy columns nullable so future inserts can omit them
ALTER TABLE public.draft_seasons
  ALTER COLUMN year DROP NOT NULL,
  ALTER COLUMN season_label DROP NOT NULL;

-- Enforce per-club uniqueness for season_number
CREATE UNIQUE INDEX IF NOT EXISTS draft_seasons_club_season_number_key
  ON public.draft_seasons (club_id, season_number)
  WHERE season_number IS NOT NULL;