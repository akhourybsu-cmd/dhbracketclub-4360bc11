# Plan: Sequential "Season N" labeling with optional subtitle

## Goal
Stop tying Draft Arena seasons to calendar quarters. Every season becomes **"Season {N}"** (auto-incremented per club, starting at 1) with an optional **subtitle** the user can set. Lists are ordered by season number, newest first.

## Decisions confirmed
- Numbering scope: **per club**
- Sort order: **newest first** (Season 5 → 4 → 3 …)
- Existing custom-named seasons: **leave as-is** (only new seasons follow the new format; backfill assigns numbers but does not rewrite names)

## Database migration

Add two columns to `public.draft_seasons`:
- `season_number int` — sequential per `club_id`
- `subtitle text` — nullable, user-provided tagline

Steps:
1. `ALTER TABLE public.draft_seasons ADD COLUMN season_number int, ADD COLUMN subtitle text`
2. Backfill `season_number` per club using `row_number() OVER (PARTITION BY club_id ORDER BY starts_at ASC, created_at ASC)`
3. Add `UNIQUE (club_id, season_number)` constraint
4. Drop the existing `UNIQUE (year, season_label)` constraint (year/season_label columns remain for legacy data but are no longer required for new rows)
5. Keep `year` / `season_label` nullable so future inserts can omit them

## Code changes

**`src/hooks/useDraftSeasons.ts`**
- Extend `DraftSeason` type with `season_number: number | null` and `subtitle: string | null`
- Add helper `formatSeasonTitle(s)` → returns `"Season {n}"` when `season_number` is set, else falls back to `s.name`
- Update `createSeason` params: drop required `year`/`seasonLabel`; accept `subtitle`; compute `season_number` = `max(season_number where club_id=…) + 1`
- Update all season-list queries to `.order('season_number', { ascending: false, nullsFirst: false })` with `starts_at desc` as tiebreaker for legacy rows

**`src/components/draft/StartNextSeasonSheet.tsx`**
- Remove the `LABEL_CYCLE` / year-slot scanning logic
- Compute next season number from existing seasons
- Replace the "Name" input with:
  - A read-only display of **"Season {N}"** (the auto-assigned title)
  - An optional **Subtitle** text input (placeholder e.g. "Rookie Year")
- Pass `subtitle` (no year/label) into `createSeason`

**`src/components/drafts/DraftArenaHUD.tsx`**
- Chip becomes `S{season_number}` instead of `season_label` / year fallback

**Display surfaces — use `formatSeasonTitle` + show subtitle as secondary line**
- `src/pages/SeasonsArchivePage.tsx` (card title + subtitle under it)
- `src/pages/SeasonArchiveDetailPage.tsx` (page header)
- `src/pages/DraftsListPage.tsx` (season banner, commissioner panels, archive prompts — multiple spots)
- `src/components/draft/stats/DraftStatsHub.tsx` (season chips + selector dropdown)

**Ordering**
- `useAllSeasons`, `useDraftSeasons` queries: order by `season_number desc`
- Stats hub season selector list: sort by `season_number desc`

## Out of scope
- Pick'em / NFL seasons (`nfl_seasons` table) — unrelated to Draft Arena seasons
- Renaming any historical season records (preserved as-is per decision)
- Any AI/judging logic

## Acceptance
- New seasons created via "Start Next Season" sheet are titled exactly "Season {N}" with an optional subtitle line, no year/quarter prompts.
- HUD chip shows `S{N}`.
- Archive, Drafts list banner, Stats hub, and Detail header all show "Season {N}" (subtitle below when present) and are ordered Season N → 1.
- Legacy seasons with custom names render their existing names but are slotted into the correct numeric position.
- No existing draft results, league standings, or RLS behavior changes.
