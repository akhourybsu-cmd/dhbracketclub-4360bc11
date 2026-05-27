
-- Season intro content (per-season editable welcome screen)
CREATE TABLE public.draft_season_intros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL UNIQUE REFERENCES public.draft_seasons(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  season_subtitle text,
  season_theme text,
  commissioner_message text,
  hero_summary text,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  season_format jsonb NOT NULL DEFAULT '[]'::jsonb,
  scoring_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_judging_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  dispute_notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  important_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  call_to_action_label text NOT NULL DEFAULT 'Enter Draft Arena',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_season_intros TO authenticated;
GRANT ALL ON public.draft_season_intros TO service_role;

ALTER TABLE public.draft_season_intros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can read season intros"
  ON public.draft_season_intros FOR SELECT TO authenticated
  USING (club_id = public.current_user_club_id() OR public.is_platform_owner(auth.uid()));

CREATE POLICY "Commissioner or admin can insert season intros"
  ON public.draft_season_intros FOR INSERT TO authenticated
  WITH CHECK (
    public.is_app_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.draft_seasons s
      WHERE s.id = season_id
        AND (s.commissioner_user_id = auth.uid() OR public.is_club_admin(auth.uid(), s.club_id))
    )
  );

CREATE POLICY "Commissioner or admin can update season intros"
  ON public.draft_season_intros FOR UPDATE TO authenticated
  USING (
    public.is_app_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.draft_seasons s
      WHERE s.id = season_id
        AND (s.commissioner_user_id = auth.uid() OR public.is_club_admin(auth.uid(), s.club_id))
    )
  );

CREATE POLICY "Commissioner or admin can delete season intros"
  ON public.draft_season_intros FOR DELETE TO authenticated
  USING (
    public.is_app_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.draft_seasons s
      WHERE s.id = season_id
        AND (s.commissioner_user_id = auth.uid() OR public.is_club_admin(auth.uid(), s.club_id))
    )
  );

CREATE TRIGGER trg_draft_season_intros_updated_at
  BEFORE UPDATE ON public.draft_season_intros
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Per-user acknowledgements
CREATE TABLE public.draft_season_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES public.draft_seasons(id) ON DELETE CASCADE,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, club_id, season_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.draft_season_acknowledgements TO authenticated;
GRANT ALL ON public.draft_season_acknowledgements TO service_role;

ALTER TABLE public.draft_season_acknowledgements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own acks"
  ON public.draft_season_acknowledgements FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own acks"
  ON public.draft_season_acknowledgements FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own acks"
  ON public.draft_season_acknowledgements FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own acks"
  ON public.draft_season_acknowledgements FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_draft_season_acks_user ON public.draft_season_acknowledgements(user_id, season_id);
