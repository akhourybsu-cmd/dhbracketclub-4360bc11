DROP POLICY IF EXISTS "rs games: creator delete in lobby" ON public.readshift_games;
CREATE POLICY "rs games: creator delete in lobby"
ON public.readshift_games
FOR DELETE
TO authenticated
USING (
  phase = 'lobby'
  AND (
    created_by = auth.uid()
    OR public.is_club_admin(auth.uid(), club_id)
    OR public.is_app_admin(auth.uid())
  )
);