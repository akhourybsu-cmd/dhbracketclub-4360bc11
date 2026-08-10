CREATE OR REPLACE FUNCTION public.shares_club_with(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _a = _b OR EXISTS (
    SELECT 1
    FROM public.club_members m1
    JOIN public.club_members m2 ON m1.club_id = m2.club_id
    WHERE m1.user_id = _a AND m2.user_id = _b
  );
$$;

DROP POLICY IF EXISTS "chat-attachments-private owner read" ON storage.objects;
DROP POLICY IF EXISTS "chat-attachments-private club read" ON storage.objects;
CREATE POLICY "chat-attachments-private club read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments-private'
    AND public.shares_club_with(auth.uid(), NULLIF((storage.foldername(name))[1], '')::uuid)
  );