REVOKE EXECUTE ON FUNCTION public.shares_club_with(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.shares_club_with(uuid, uuid) TO authenticated, service_role;