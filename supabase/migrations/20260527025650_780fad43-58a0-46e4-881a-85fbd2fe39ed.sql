
ALTER TABLE public.draft_pick_disputes
  ADD COLUMN IF NOT EXISTS commissioner_rationale text,
  ADD COLUMN IF NOT EXISTS resolved_by uuid;

DROP POLICY IF EXISTS "Admin can update disputes" ON public.draft_pick_disputes;
CREATE POLICY "Admin or draft creator can update disputes"
  ON public.draft_pick_disputes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_app_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.drafts d
      WHERE d.id = draft_pick_disputes.draft_id
        AND d.created_by = auth.uid()
    )
  );
