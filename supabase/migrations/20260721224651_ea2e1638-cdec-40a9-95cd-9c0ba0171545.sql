DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE 'readshift_%'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.readshift_read_cards(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.readshift_round_authors(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.readshift_shift_progress(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.readshift_read_progress(uuid) TO authenticated, service_role;