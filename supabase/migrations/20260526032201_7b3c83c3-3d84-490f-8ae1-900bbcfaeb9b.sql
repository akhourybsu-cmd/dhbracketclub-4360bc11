
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS portfolio_wars boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pickem boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rankings boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS posts boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS lore boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS celebrations boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS narrative boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS brackets boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nexus boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS runedelve boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS system boolean NOT NULL DEFAULT true;
