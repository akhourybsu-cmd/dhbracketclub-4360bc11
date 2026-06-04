-- 1) Channels: add missing columns used by settings dialog
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS channel_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS post_permission text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.channels
    ADD CONSTRAINT channels_channel_type_check
    CHECK (channel_type IN ('general','announcements','admin_only','event'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.channels
    ADD CONSTRAINT channels_post_permission_check
    CHECK (post_permission IN ('all','admins'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP TRIGGER IF EXISTS trg_channels_updated_at ON public.channels;
CREATE TRIGGER trg_channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Per-user, per-channel notification preferences
CREATE TABLE IF NOT EXISTS public.channel_notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'all' CHECK (mode IN ('all','mentions','muted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.channel_notification_prefs TO authenticated;
GRANT ALL ON public.channel_notification_prefs TO service_role;

ALTER TABLE public.channel_notification_prefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own notif prefs: select" ON public.channel_notification_prefs;
CREATE POLICY "Own notif prefs: select"
  ON public.channel_notification_prefs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Own notif prefs: insert" ON public.channel_notification_prefs;
CREATE POLICY "Own notif prefs: insert"
  ON public.channel_notification_prefs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Own notif prefs: update" ON public.channel_notification_prefs;
CREATE POLICY "Own notif prefs: update"
  ON public.channel_notification_prefs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Own notif prefs: delete" ON public.channel_notification_prefs;
CREATE POLICY "Own notif prefs: delete"
  ON public.channel_notification_prefs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS trg_channel_notif_prefs_updated_at ON public.channel_notification_prefs;
CREATE TRIGGER trg_channel_notif_prefs_updated_at
  BEFORE UPDATE ON public.channel_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_channel_notif_prefs_user ON public.channel_notification_prefs(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_notif_prefs_channel ON public.channel_notification_prefs(channel_id);