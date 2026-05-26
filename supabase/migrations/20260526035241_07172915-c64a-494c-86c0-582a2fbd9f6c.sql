
-- 1. Remove broad authenticated SELECT on private chat attachments bucket
DROP POLICY IF EXISTS "Auth users read private chat attachments" ON storage.objects;

-- 2. Fix security definer view
ALTER VIEW public.nfl_team_records SET (security_invoker = true);

-- 3. Remove narrative_ai_suggestions from realtime publication
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='narrative_ai_suggestions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.narrative_ai_suggestions';
  END IF;
END $$;

-- 4. Remove permissive insert policies on rune_delve_dungeons / rune_delve_levels
DROP POLICY IF EXISTS "Authenticated can seed daily dungeon" ON public.rune_delve_dungeons;
DROP POLICY IF EXISTS "Authenticated can seed levels" ON public.rune_delve_levels;
