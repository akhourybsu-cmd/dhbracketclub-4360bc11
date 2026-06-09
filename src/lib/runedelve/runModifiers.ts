// Rune Delve — Run Modifiers (R3)
//
// At the start of every chamber, the player is offered three random
// modifiers. Picking one (or skipping for the Steady Path) sets the
// rules of THIS particular run — the same level can play very
// differently from one attempt to the next.
//
// Modifier effects are a flat-data spec: a small object of multipliers
// and deltas. The play engine reads the spec at the relevant moments
// (run-init, chain resolve, hazard hit, treasure hit, finalize) and
// applies whatever fields are present. Missing fields are no-ops, so
// modifiers stay easy to add — just append an entry below.
//
// Design notes:
// - Tier 1: mild swap-mode (small bonus, small cost). Casual feel.
// - Tier 2: stronger lever (clear upside + clear downside). Strategic.
// - Tier 3: extreme/risky. Either you snowball or you die.
// - Steady Path: a "no-op" option offered as a Skip button in the
//   picker — there's no shame in playing plain. It's not in the random
//   pool, but available via the picker's escape hatch.
//
// Engine integration surface (these are the only hooks the engine
// honours; adding a new effect field requires both updating this file
// AND wiring it in RuneDelvePlayPage.tsx):
//   hpMult            – max HP × on init
//   turnDelta         – turn limit + on init
//   manaStart         – starting mana + on init
//   redDamageMult     – red-chain damage × at resolve
//   healMult          – green-chain heal × at resolve
//   shieldMult        – gold-chain shield × at resolve
//   treasureMult      – treasure cell rewards × at hit
//   hazardMult        – hazard cell damage × at hit
//   scoreMult         – total score × at finalize

export interface RunModifierEffect {
  /** Multiply max HP at run init (0.85 = −15%). */
  hpMult?: number;
  /** Add to turn limit at run init (−2 = harder). */
  turnDelta?: number;
  /** Add to starting mana (capped at MAX_MANA by the engine). */
  manaStart?: number;
  /** Multiply red-chain damage dealt. */
  redDamageMult?: number;
  /** Multiply green-chain heal output. */
  healMult?: number;
  /** Multiply gold-chain shield turns granted. */
  shieldMult?: number;
  /** Multiply treasure cell score + shard rewards. */
  treasureMult?: number;
  /** Multiply hazard cell HP cost. */
  hazardMult?: number;
  /** Multiply final score at finalize. */
  scoreMult?: number;
}

export interface RunModifier {
  id: string;
  name: string;
  description: string;
  /** 0 = Steady Path (skip), 1 = mild, 2 = strong, 3 = volatile. */
  tier: 0 | 1 | 2 | 3;
  /** Single character / emoji glyph for the card. */
  glyph: string;
  /** HSL triple for the accent color (matches the layout style). */
  accent: string;
  effect: RunModifierEffect;
}

/** The "no modifier" option — always available via the picker's Skip
 *  affordance. Never appears in the random offer pool. */
export const STEADY_PATH: RunModifier = {
  id: 'steady_path',
  name: 'Steady Path',
  description: 'Play the chamber as-written. No bonus, no penalty.',
  tier: 0,
  glyph: '◇',
  accent: '0 0% 60%',
  effect: {},
};

/** The pool of modifiers offered at run-start. Keep this list balanced —
 *  every modifier should have a clear upside AND downside (or no down-
 *  side if it's tier 1 niche flavor). When adding a new modifier:
 *    1. Append here
 *    2. Make sure every effect field used is honoured by the engine
 *    3. Aim for ~3 modifiers per tier for variety */
export const RUN_MODIFIERS: RunModifier[] = [
  // ── Tier 1 — mild flavor ──────────────────────────────────────────
  {
    id: 'crimson_edge',
    name: 'Crimson Edge',
    description: '+30% red damage · −15% max HP. Trade durability for punch.',
    tier: 1,
    glyph: '⚔',
    accent: '0 75% 58%',
    effect: { redDamageMult: 1.30, hpMult: 0.85 },
  },
  {
    id: 'verdant_heart',
    name: 'Verdant Heart',
    description: '+60% green healing · −15% red damage. Survivor build.',
    tier: 1,
    glyph: '❀',
    accent: '140 60% 50%',
    effect: { healMult: 1.60, redDamageMult: 0.85 },
  },
  {
    id: 'iron_veil',
    name: 'Iron Veil',
    description: '+1 shield turn from every gold chain. Score ×0.92 trade-off.',
    tier: 1,
    glyph: '◈',
    accent: '45 90% 56%',
    effect: { shieldMult: 1.50, scoreMult: 0.92 },
  },

  // ── Tier 2 — strong levers ────────────────────────────────────────
  {
    id: 'treasure_hunter',
    name: 'Treasure Hunter',
    description: 'Treasure pays 3× · hazard hurts 2×. The chamber pays you to dance.',
    tier: 2,
    glyph: '✨',
    accent: '45 95% 60%',
    effect: { treasureMult: 3, hazardMult: 2 },
  },
  {
    id: 'speedrun',
    name: 'Speedrun',
    description: '−2 turns to clear · score ×1.35. Move fast or break.',
    tier: 2,
    glyph: '⚡',
    accent: '195 90% 65%',
    effect: { turnDelta: -2, scoreMult: 1.35 },
  },
  {
    id: 'wellspring',
    name: 'Wellspring',
    description: '+2 starting mana · −10% max HP. Cast first, ask later.',
    tier: 2,
    glyph: '✦',
    accent: '215 75% 60%',
    effect: { manaStart: 2, hpMult: 0.90 },
  },

  // ── Tier 3 — volatile ─────────────────────────────────────────────
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: '+60% red damage · −35% max HP. One slip ends it.',
    tier: 3,
    glyph: '💥',
    accent: '350 75% 60%',
    effect: { redDamageMult: 1.60, hpMult: 0.65 },
  },
  {
    id: 'last_stand',
    name: 'Last Stand',
    description: '+30% max HP · −15% red damage · score ×1.15. Outlast everything.',
    tier: 3,
    glyph: '🛡',
    accent: '38 95% 55%',
    effect: { hpMult: 1.30, redDamageMult: 0.85, scoreMult: 1.15 },
  },
  {
    id: 'feast_or_famine',
    name: 'Feast or Famine',
    description: '+50% all damage AND healing · −2 turns to do it.',
    tier: 3,
    glyph: '🔥',
    accent: '15 95% 60%',
    effect: { redDamageMult: 1.50, healMult: 1.50, turnDelta: -2 },
  },
];

/** Default empty effect — useful as a fallback when no modifier is set
 *  so the engine never has to undefined-check fields. */
export const EMPTY_EFFECT: Required<RunModifierEffect> = Object.freeze({
  hpMult: 1,
  turnDelta: 0,
  manaStart: 0,
  redDamageMult: 1,
  healMult: 1,
  shieldMult: 1,
  treasureMult: 1,
  hazardMult: 1,
  scoreMult: 1,
}) as Required<RunModifierEffect>;

/** Resolve a (possibly null) modifier into a fully-populated effect
 *  spec the engine can read without guards. */
export function resolveEffect(mod: RunModifier | null | undefined): Required<RunModifierEffect> {
  if (!mod) return EMPTY_EFFECT;
  return { ...EMPTY_EFFECT, ...mod.effect };
}

/** Pick three distinct modifiers from the pool. Uses Math.random by
 *  default — modifier choice is intentionally NOT deterministic per
 *  level, since the whole point is "same level plays different across
 *  runs". A custom rng can be passed for testing. */
export function pickModifierOffer(rng: () => number = Math.random): RunModifier[] {
  const pool = [...RUN_MODIFIERS];
  // Fisher–Yates shuffle, take first 3.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

/** Look up a modifier by id — used when rehydrating a session from
 *  the run snapshot (player backgrounded the tab mid-run). */
export function getModifierById(id: string | null | undefined): RunModifier | null {
  if (!id) return null;
  if (id === STEADY_PATH.id) return STEADY_PATH;
  return RUN_MODIFIERS.find(m => m.id === id) ?? null;
}
