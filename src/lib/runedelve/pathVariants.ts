// Rune Delve — Path Variants (R2)
//
// At milestone levels (every 10th: L10, L20, L30, ... L150), the player
// chooses one of three "paths" before entering the chamber. The path
// alters the run's flavor — same level number, different feel — adding
// branching variance without rebuilding the canonical 150-level spine.
//
// Why "branching" without per-player path schema:
//   • The campaign curve, leaderboards, mechanic introduction, mastery
//     gates all stay anchored to the linear level numbers.
//   • A path is a per-RUN choice — not a permanent fork — so leaderboard
//     fairness is preserved (each variant has its own score weighting
//     that the engine reconciles at finalize).
//   • Stored in localStorage per (user, level) just to remember the
//     last-picked path for visual continuity. Players can re-pick any
//     time by tapping the milestone again.
//
// Engine integration surface (hooks the play page honours):
//   eliteEnemyHpMult     — multiplies every enemy's HP on init
//   shardBonusMult       — multiplies final shard award (clear OR fail)
//   bonusDropChance      — adds to base relic drop chance (R7)
//   lockedModifierId     — forces this modifier; skips the R3 picker
//   layoutOverride       — forces a specific chamber layout (R1 zones)

import type { RuneLayoutId } from './runeLayouts';

export type PathVariantId = 'standard' | 'treasure' | 'elite';

export interface PathVariantEffect {
  /** Multiplier applied to every enemy's HP at run init. */
  eliteEnemyHpMult?: number;
  /** Multiplier applied to the final shard reward (clear or fail). */
  shardBonusMult?: number;
  /** Additive bonus to relic drop chance (capped by R7's hard ceiling). */
  bonusDropChance?: number;
  /** Force this modifier id and skip the R3 picker. */
  lockedModifierId?: string;
  /** Force this layout id, overriding chamberAssignment.ts. */
  layoutOverride?: RuneLayoutId;
}

export interface PathVariant {
  id: PathVariantId;
  name: string;
  /** One-line teaser for the picker card. */
  tagline: string;
  /** Three short bullet points spelling out the effect. */
  effectLines: string[];
  /** Single emoji / glyph for the card icon. */
  glyph: string;
  /** HSL triple for accent treatment. */
  accent: string;
  /** Risk label shown as a pill — orienting the player to the trade-off. */
  tier: 'safe' | 'flavored' | 'risky';
  effect: PathVariantEffect;
}

export const PATH_VARIANTS: PathVariant[] = [
  {
    id: 'standard',
    name: 'Standard Path',
    tagline: 'Play the chamber as-written. No twist, no twist.',
    effectLines: [
      'Default enemies & rewards',
      'Modifier picker as usual',
      'No bonus, no penalty',
    ],
    glyph: '◆',
    accent: '0 0% 60%',
    tier: 'safe',
    effect: {},
  },
  {
    id: 'treasure',
    name: 'Treasure Path',
    tagline: 'A buried vault chamber, hunter’s rules already in play.',
    effectLines: [
      'Chamber: Cursed Vault layout',
      'Modifier locked: Treasure Hunter',
      '+25% Rune Shards on clear',
    ],
    glyph: '✨',
    accent: '45 95% 60%',
    tier: 'flavored',
    effect: {
      layoutOverride: 'cursed_vault',
      lockedModifierId: 'treasure_hunter',
      shardBonusMult: 1.25,
    },
  },
  {
    id: 'elite',
    name: 'Elite Path',
    tagline: 'Tougher enemies, sweeter rewards if you survive.',
    effectLines: [
      'Enemy HP +25%',
      '+50% Rune Shards on clear',
      '+8% relic drop chance',
    ],
    glyph: '⚔',
    accent: '350 75% 60%',
    tier: 'risky',
    effect: {
      eliteEnemyHpMult: 1.25,
      shardBonusMult: 1.50,
      bonusDropChance: 0.08,
    },
  },
];

export function getPathVariant(id: string | null | undefined): PathVariant | null {
  if (!id) return null;
  return PATH_VARIANTS.find(p => p.id === id) ?? null;
}

/** Default empty effect — engine reads this when no variant is active. */
export const EMPTY_PATH_EFFECT: Required<PathVariantEffect> = Object.freeze({
  eliteEnemyHpMult: 1,
  shardBonusMult: 1,
  bonusDropChance: 0,
  lockedModifierId: '',
  layoutOverride: '' as RuneLayoutId,
}) as Required<PathVariantEffect>;

/** Resolve a (possibly null) variant into a fully-populated effect spec
 *  the engine can read without guards. */
export function resolvePathEffect(v: PathVariant | null | undefined): Required<PathVariantEffect> {
  if (!v) return EMPTY_PATH_EFFECT;
  return { ...EMPTY_PATH_EFFECT, ...v.effect };
}

/** localStorage key for last-picked path per (user, level). */
function pathChoiceKey(userId: string, levelNumber: number): string {
  return `rd-path-choice:${userId}:${levelNumber}`;
}

/** Read last-picked path variant id for visual continuity on the map. */
export function readLastPathChoice(userId: string, levelNumber: number): PathVariantId | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(pathChoiceKey(userId, levelNumber));
    if (!v) return null;
    return PATH_VARIANTS.some(p => p.id === v) ? (v as PathVariantId) : null;
  } catch { return null; }
}

/** Persist the most recent path choice for a level. */
export function writeLastPathChoice(userId: string, levelNumber: number, id: PathVariantId): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(pathChoiceKey(userId, levelNumber), id); } catch { /* quota */ }
}
