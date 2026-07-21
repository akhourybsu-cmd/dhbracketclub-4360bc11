-- ═══════════════════════════════════════════════════════════════════
-- READSHIFT — activation
--
-- The feature was registered DORMANT (is_active = false) by
-- 20260721000000_readshift-social-game.sql so it would not surface in the
-- Asset Library while the UI, edge function, and scheduler were still being
-- built. Every surface is now wired (create → lobby → shift → read →
-- reveal → results, commissioner controls, profile stats, Compete banner,
-- onboarding), so flip it live.
--
-- Idempotent: safe to re-run. Only touches the is_active flag for the
-- 'readshift' asset; all other asset metadata is owned by the base migration.
-- ═══════════════════════════════════════════════════════════════════

update public.platform_assets
set is_active = true
where slug = 'readshift';
