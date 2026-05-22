# DH Club — Premium Home & Shell Redesign

A focused, mobile-first pass to make the app feel less box-like and more like a living club hub. Scope is intentionally bounded to the **global shell + home experience + shared primitives** — individual plugin pages stay as-is unless touched by the new primitives.

---

## Audit findings (current state)

**Home (`src/pages/DashboardPage.tsx` + `src/components/home/`)**
- 8+ stacked modules (`HomeHero`, `QuickBar`, `RightNowCard`, `AssetLauncher`, `LeagueSnapshot`, `EventsStrip`, `ClubPulse`, `Highlights`, `MembersOnline`, `DiscoverStrip`) — each is its own bordered `rounded-2xl bg-card border` container. Visually identical chrome → "stack of widgets" feeling.
- Multiple modules carry their own accent glow → glow loses meaning.
- `HomeHero` is a tight identity strip, not a hero; no cinematic primary action.
- `AssetLauncher` shows tiny truncated labels in a horizontal rail.
- `RightNowCard` already has next-action logic (`src/lib/home/nextAction.ts`) but is rendered as just another card.
- No clear primary → secondary → ambient hierarchy.

**Shared chrome**
- `Card`, plugin cards (`NarrativeHomeWidget`, etc.), and home modules all converge on the same `rounded-2xl border bg-card` recipe.
- Status pills (`CampaignStatusPill`, etc.) compete with titles for visual weight.
- Small uppercase 10–11px labels are repeated everywhere.

**Plugin contribution model**
- Each plugin currently exports its own home widget directly (e.g. `NarrativeHomeWidget`) and is hand-wired in `DashboardPage`. No registry → adding plugins requires editing the dashboard. Worth a light registry, not a rewrite.

---

## Design direction

Replace the "stack of bordered cards" with a **three-tier surface system** used across the app:

1. **Hero surface** — cinematic, gradient-washed, one per screen max. Houses the single most important next action.
2. **Pulse surface** — flowing list/feed rows with subtle dividers (not borders). Houses "what's happening today."
3. **Ambient surface** — borderless, low-contrast groupings with section headers. Houses launchers, secondary content, discovery.

Borders are reserved for interactive tiles (app dock, quick actions). Glow is reserved for the hero and live/urgent statuses only.

---

## New home structure

```text
┌─────────────────────────────────────────┐
│  Ambient Club Header                    │  ← refined HomeHero (no border, larger breathing room)
│  Logo · Club name · greeting · avatar   │
├─────────────────────────────────────────┤
│                                         │
│      HERO — Next Action                 │  ← cinematic gradient surface, 1 CTA
│      "Your draft pick is up"            │     keyed to club accent + action type
│      [ Make pick → ]                    │
│                                         │
├─────────────────────────────────────────┤
│  Today in {Club}                        │  ← Pulse: flowing rows, dividers not borders
│  • Draft turn · Movies of 2026          │     Mixes RightNow secondary items +
│  • 3 picks left · NFL Week 12           │     EventsStrip + ClubPulse + Celebrations
│  • Sarah's birthday tomorrow            │     + Narrative campaign updates
│  • Poll closes in 4h                    │
├─────────────────────────────────────────┤
│  Your Apps              [ Library → ]   │  ← AppDock: refined launcher, full labels,
│  [Drafts][Nexus][Chat][Lore][More]      │     active/live dot per tile, snap rail
├─────────────────────────────────────────┤
│  Featured                               │  ← FeaturedModule: rotates among
│  ┌─────────────────────────────────┐    │     league standings / active campaign /
│  │ Season 4 · Standings            │    │     leaderboard / event spotlight
│  └─────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  Members Online · Discover              │  ← ambient strips, smaller, no border
└─────────────────────────────────────────┘
```

`QuickBar` (pinned apps) gets folded into AppDock — one launcher concept, not two.

---

## Files to add

| File | Role |
|---|---|
| `src/components/home/primitives/Surface.tsx` | `<Surface variant="hero"\|"pulse"\|"ambient"\|"tile">` — central recipe so every home block uses the same vocabulary |
| `src/components/home/HeroAction.tsx` | Cinematic primary-action card. Consumes top result from `rankNextActions`. Gradient keyed to club accent + action accent. |
| `src/components/home/TodayFeed.tsx` + `TodayFeedItem.tsx` | Replaces `RightNowCard` secondaries + `ClubPulse` + parts of `EventsStrip`. Flowing rows with subtle leading icon, no per-row border. |
| `src/components/home/AppDock.tsx` + `AppTile.tsx` | Replaces `AssetLauncher` + `QuickBar`. Snap rail, real labels, live/pending dot, "All apps" tail tile. |
| `src/components/home/FeaturedModule.tsx` | Rotating spotlight (LeagueSnapshot / active campaign / leaderboard) — one richer block instead of three competing ones. |
| `src/components/home/SectionLabel.tsx` | Calmer replacement for `SectionHeader` — sentence-case, no uppercase tracking spam. |
| `src/lib/home/pluginHomeRegistry.ts` | Light registry: `{ slug, getPulseItems(ctx), getFeaturedCandidate(ctx) }`. Lets each plugin contribute Today/Featured content without editing `DashboardPage`. Migrate Narrative + Celebrations + Drafts as the first three. |

## Files to refactor

| File | Change |
|---|---|
| `src/pages/DashboardPage.tsx` | Rewrite composition to: Header → HeroAction → TodayFeed → AppDock → FeaturedModule → ambient strips. Drop direct imports of removed modules. |
| `src/components/home/HomeHero.tsx` | Strip border, increase vertical breathing room, integrate notification dot on avatar, remove inline "pending" chip (moves into HeroAction). |
| `src/components/home/RightNowCard.tsx` | Delete (logic absorbed by `HeroAction` + `TodayFeed`). Keep `rankNextActions` as-is — it's the right primitive. |
| `src/components/home/QuickBar.tsx`, `AssetLauncher.tsx`, `ClubPulse.tsx`, `EventsStrip.tsx`, `LeagueSnapshot.tsx`, `Highlights.tsx` | Delete or convert into pulse/featured contributors via the registry. Preserve underlying hooks (`useClubAssets`, events queries, etc.). |
| `src/components/narrative/NarrativeHomeWidget.tsx` | Register as a pulse contributor; component itself becomes thinner (one row per active campaign + one admin nudge row). |
| `src/components/ui/card.tsx` | Leave shadcn `Card` untouched (used by plugin pages). Home stops using it directly in favor of `Surface`. |
| `src/index.css` | Add 2 tokens: `--surface-hero-gradient`, `--surface-pulse-divider`. No palette change. |

## Design tokens (additive only)

```css
:root {
  --surface-pulse-divider: hsl(var(--border) / 0.35);
  --surface-hero-gradient: radial-gradient(120% 80% at 0% 0%,
    hsl(var(--primary) / 0.18), transparent 60%),
    linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--background)) 100%);
}
```

All other color work goes through existing semantic tokens — no new palette.

## Motion

Reuse existing framer-motion patterns. New rules:
- Hero: one-shot 400ms fade-up on mount + persistent ambient gradient drift (8s, prefers-reduced-motion respected).
- TodayFeed rows: stagger 40ms.
- AppTile: `active:scale-[0.96]` only, no glow on idle.
- No new animation libraries.

## Plugin contribution contract (new)

```ts
// src/lib/home/pluginHomeRegistry.ts
export interface HomePluginContribution {
  slug: string;
  pulse?: (ctx: HomeCtx) => TodayFeedItemData[]; // 0-3 items
  featured?: (ctx: HomeCtx) => FeaturedCandidate | null; // priority-scored
}
```

Plugins not migrated keep working — the registry is opt-in. Migrate `narrative-rpg`, `birthdays-milestones`, `draft-arena`, `nfl-pickem` in this pass; the rest follow later.

## What stays exactly the same

- All routes, auth, RLS, plugin install/enable logic.
- `useClubAssets`, `useNarrativeCampaigns`, `rankNextActions`, all data hooks.
- Bottom nav (`AppLayout`), all standalone game shells (`PwLayout`, `PickemLayout`, `DraftArenaLayout`, `NexusLayout`, `RuneDelve*`).
- Profile, settings, club admin pages.
- All plugin pages (`/narrative`, `/drafts`, `/nexus`, `/pickem`, etc.).
- Light/dark mode behavior — tokens only extend, never replace.

## Risks

- `RightNowCard` deletion: must ensure `rankNextActions` still drives HeroAction so no signals are lost. Mitigation: HeroAction takes top result, TodayFeed takes items 2…N filtered by type.
- Plugin registry adds indirection. Mitigation: keep it tiny (one file, ~60 LOC) and only used by 4 plugins initially.
- Removing per-module borders may make Pulse rows feel flat in light mode. Mitigation: rely on `--surface-pulse-divider` token tuned per theme.

## Out of scope (explicitly)

- Individual plugin page redesigns (Nexus battle, Drafts board, Chat, etc.).
- Bottom nav changes.
- New color palette or font changes.
- Onboarding flow rewrite.
- Backend / schema changes.

## Verification

1. `npx tsc --noEmit` clean.
2. Build passes.
3. Smoke check on `/` mobile viewport: hero renders, today feed shows real items, app dock scrolls, no horizontal overflow, dark+light parity.
4. Visit `/narrative`, `/drafts`, `/celebrations` — confirm no regressions from registry changes.

---

Approve this plan and I'll implement in this order: primitives → HeroAction + TodayFeed → AppDock + FeaturedModule → DashboardPage rewrite → registry migration for the 4 plugins → polish pass.
