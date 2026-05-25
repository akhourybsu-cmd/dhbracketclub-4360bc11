## Goal

Add a fourth tab — **Stats** — to the slider at the top of the Drafts app (next to Drafts / Season / Commissioner). It will aggregate every available statistic across all drafts (current and historical) into a fun, scannable, mobile-native page. No backend schema changes — everything is computed client-side from existing tables that already store full history.

## Data inventory (what we can mine)

| Source | Fields used |
|---|---|
| `drafts` | topic, status, num_rounds, created_at, created_by |
| `draft_participants` | user_id, pick_order per draft |
| `draft_picks` | user_id, round, pick_number, pick_text, picked_at |
| `draft_results` | rank, total_score, points_awarded, pick_ratings[{pick_id, score, explanation}], summary |
| `draft_season_standings` | season_points, drafts_played, wins, podiums, avg_finish, avg_score, best/worst_score, consistency, rank, playoff_seed |
| `draft_seasons` | name, status, champion_user_id, runner_up_user_id, third_place_user_id, regular_season_champion_user_id |
| `draft_playoff_matches` | round, winner_user_id (for series clinches → championships) |
| `draft_season_entries` | which drafts belong to which season |

This covers every numeric and qualitative stat the app currently tracks. All old drafts are already in these tables — no backfill needed.

## Tab UX

```
[ Drafts ] [ Season ] [ Stats ] [ Commissioner? ]
```

`Stats` is visible to all users. Inside it: a horizontal scope chip selector (All-Time · Current Season · Last Season · By Season ▾) and a fixed "You vs Club" toggle. Everything below re-aggregates from one in-memory dataset, so toggles are instant.

## Stats page modules (top → bottom)

1. **Headline Hero Card** — "Your Draft Identity"
   - Title (auto-generated nickname from style: e.g. *Closer*, *Steady Hand*, *Slow Burner*, *Sniper*, *Champion*) derived from rank distribution + consistency + speed.
   - Big metrics: Lifetime Points · Drafts Played · Win Rate %.
   - Animated counters (reuse `useCountUp`).

2. **Trophy Case** — championship/podium chips
   - Championships (best-of series clinches) · Regular-season titles · Finals appearances · 3rd-place medals · Total podiums · MVP picks owned · Longest hot streak.
   - Gold/silver/bronze styling, tappable to scroll to detail rows below.

3. **Career Pulse** — sparkline of average score per draft over time + best-finish trend. Renders as inline SVG (no chart lib needed).

4. **Pick Quality Breakdown** (from `pick_ratings`)
   - Score distribution histogram (0–10 buckets).
   - Average pick score, highest single pick (with text + draft topic), lowest single pick.
   - First-round avg vs last-round avg ("Early vs Late" comparison) → reveals if you peak early or steal late.
   - "Steal rate" — % of picks in second half of draft scoring ≥7.5.
   - "Bust rate" — % of picks scoring ≤4.

5. **Timing & Tempo** (from `picked_at`)
   - Avg time per pick · Fastest pick ever · Slowest pick ever · Total time on the clock lifetime.
   - "Decisive" or "Deliberator" label based on percentile.

6. **Head-to-Head Leaderboards** — club-wide ranked lists, with your row highlighted:
   - Most Wins · Most Podiums · Most Drafts · Highest Avg Score · Most Consistent (lowest σ) · Most MVP Picks · Highest Single Score · Longest Hot Streak · Fastest Average · Most Championships.

7. **Season-by-Season Table** — collapsible. Per season: your rank, points, wins, podiums, avg finish, made playoffs Y/N, finals appearance, championship.

8. **Topic Tendencies**
   - Top 5 most common categories drafted · your best category by avg score · worst category.
   - Drafts created by you vs joined.

9. **Fun Awards** ("Hall of Fame & Shame")
   - Single, club-wide superlatives auto-computed:
     - 🏆 G.O.A.T. (most championships).
     - 🔥 Streak King (longest 7.5+ hot streak across history).
     - 🎯 Sniper (highest single-pick score ever).
     - 🐢 The Deliberator (slowest avg pick time).
     - ⚡ The Sniper Shooter (fastest avg pick time).
     - 💎 The Closer (highest avg score in final round).
     - 🪨 Rock Steady (lowest career consistency σ with ≥5 drafts).
     - 😅 The Reach (lowest single-pick score, shown with humor & opt-in only).
   - Each award is a card with avatar + the winning value.

10. **Footer** — last-updated timestamp + "Refresh" + link to Seasons Archive.

All sections gracefully hide if no data (new clubs / first draft).

## Technical implementation

**New files**
- `src/hooks/useDraftStatsHub.ts` — one hook that fetches in parallel (all guarded with `withTimeout`):
  - all `draft_results` (with pick_ratings)
  - all `draft_picks` (id, draft_id, user_id, round, pick_number, picked_at, pick_text)
  - all `drafts` (id, topic, category, created_by, created_at, num_rounds)
  - all `draft_season_standings` + `draft_seasons`
  - all `draft_playoff_matches` (for championship counts)
  - all `profiles` (id, display_name, avatar_url)
  - all `draft_season_entries` (for season scoping)
  Returns a normalised `StatsDataset` plus memoised aggregators keyed by `scope: 'all' | seasonId`.

- `src/lib/draft/statsAggregators.ts` — pure functions: `computeUserAggregate`, `computeLeaderboard(metric)`, `computeFunAwards`, `computeCareerPulse`, `computePickQuality`, `computeTimingProfile`, `computeTopicTendencies`, `computeIdentity(nickname logic)`. Heavy reuse of existing helpers in `src/lib/draftStats.ts` (MVP, streaks, consistency, timings) — extend them to take cross-draft arrays instead of per-draft.

- `src/components/draft/stats/` — small focused components:
  - `StatsHero.tsx`
  - `TrophyCase.tsx`
  - `CareerPulseChart.tsx` (inline SVG sparkline)
  - `PickQualityCard.tsx` (histogram + early/late)
  - `TimingCard.tsx`
  - `LeaderboardList.tsx` (reused for all 10 leaderboards via prop)
  - `SeasonByLeague.tsx`
  - `TopicTendenciesCard.tsx`
  - `FunAwardsGrid.tsx`
  - `StatsScopeBar.tsx` (scope + you-vs-club toggle)

**Edits**
- `src/pages/DraftsListPage.tsx`:
  - Add `<TabsTrigger value="stats">Stats</TabsTrigger>` between Season and Commissioner.
  - Add `<TabsContent value="stats">` rendering `<DraftStatsHub />`.
  - Lazy-load the hub via `React.lazy` so the tab doesn't add to first paint.

- `src/lib/draftStats.ts`: extract `findScoringStreaks`, MVP/steal/consistency/timing helpers so they can run over arbitrary picks+results arrays (currently scoped to one draft). Keep existing per-draft callers intact via thin wrappers.

**Conventions followed**
- All Supabase queries wrapped in `withTimeout` (project convention for hangs).
- Tailwind semantic tokens (`hsl(var(--gold))`, `--card`, `--muted`) and existing `da-glass` / `glass-card` patterns — no new design system.
- Mobile-first, dark mode default, animated counters via `useCountUp`, motion via `framer-motion` springSnap (already used elsewhere on the page).
- No drag-and-drop, no new chart library — sparklines are inline SVG.
- All historical drafts are already in the tables, so the page works retroactively from day one and keeps updating as new drafts complete.
- Heavy memoisation with `useMemo` keyed on `(scope, datasetVersion)` so toggling scope is instant.

## Out of scope
- No DB migrations.
- No edge function changes.
- No changes to draft creation, pick flow, or rating engine.
- No public/sharable stat URLs (can be a follow-up).
