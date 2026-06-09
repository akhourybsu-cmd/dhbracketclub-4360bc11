// Rune Delve — Class Trials (R6)
//
// Per-class lifetime achievement chains. Each trial has a class-flavored
// title that the player unlocks on completion — long-tail progression
// beyond the existing class XP / mastery curve.
//
// Schema-free for first cut: trials are pure code, evaluated against
// the data already on `rune_delve_heroes` + `rune_delve_progress`.
// Completion state is DERIVED on every load — there's no claimed flag
// because the player can wear any unlocked title freely (already how
// the existing cosmetic_title field is used).
//
// Stat surface used today (no DB writes needed for R6 to work):
//   hero.lifetime_runs       — every run played
//   hero.best_streak         — best consecutive clears
//   hero.lifetime_score      — total score across all runs
//   progress.highest_unlocked_level — depth reached
//
// Adding class-distinctive stats (like "lifetime red chains as Warrior",
// "spells cast as Mage", etc.) is a follow-up that needs schema work.
// For first cut, every class gets the same THRESHOLDS but distinct
// COSMETIC TITLES so the cosmetic flavor differentiates them.

import type { HeroClass } from './classConfig';

export type ClassTrialId =
  | `${HeroClass}_initiate`
  | `${HeroClass}_streak`
  | `${HeroClass}_score`
  | `${HeroClass}_boss`;

export interface ClassTrial {
  id: ClassTrialId;
  /** Class this trial belongs to. */
  heroClass: HeroClass;
  /** Tier 1-4 — drives ordering and visual weighting. */
  tier: 1 | 2 | 3 | 4;
  /** Cosmetic title awarded on completion. */
  title: string;
  /** Short flavor line for the trial card. */
  description: string;
  /** Eligibility check — returns { progress, target } for UI bars. */
  evaluate: (stats: ClassTrialStats) => { progress: number; target: number };
}

export interface ClassTrialStats {
  lifetimeRuns: number;
  bestStreak: number;
  lifetimeScore: number;
  highestUnlockedLevel: number;
}

// Per-class title tables. Same THRESHOLDS across classes for now (the
// gameplay challenge is identical); class-specific tracking would let
// us add genuinely different conditions in a future iteration.
const CLASS_TITLES: Record<HeroClass, [string, string, string, string]> = {
  warrior: ['Recruit',     'Battle-Hardened', 'Champion',      'Avatar of War'],
  mage:    ['Apprentice',  'Adept',           'Archmage',      'Spellweaver Eternal'],
  rogue:   ['Shadowstep',  'Quickblade',      'Master Thief',  'Phantom'],
  cleric:  ['Initiate',    'Devoted',         'Sanctified',    'Saint'],
};

const CLASS_FLAVOR: Record<HeroClass, [string, string, string, string]> = {
  warrior: [
    'Survive your first 10 chambers — every champion was once a recruit.',
    'String 3 chambers in a row without falling.',
    'Earn 50,000 lifetime score across your career.',
    'Break the seal of Chapter 1 — clear Level 50.',
  ],
  mage:    [
    'Study the runes — 10 chambers logged.',
    'Maintain a 3-streak of clears.',
    'Earn 50,000 lifetime score across your career.',
    'Conquer Chapter 1 — clear Level 50.',
  ],
  rogue:   [
    'Walk the corridors 10 times — feel the rhythm.',
    'Slip through 3 chambers in a row uncaught.',
    'Earn 50,000 lifetime score across your career.',
    'Vanish past Level 50 — the boss falls.',
  ],
  cleric:  [
    'Mend the order — 10 chambers tended.',
    'Hold faith through 3 consecutive clears.',
    'Earn 50,000 lifetime score across your career.',
    'Sanctify Chapter 1 — clear Level 50.',
  ],
};

const THRESHOLDS = {
  initiate: 10,        // lifetime runs
  streak: 3,           // best streak
  score: 50_000,       // lifetime score
  bossLevel: 50,       // highest_unlocked_level must exceed (i.e. > 50 means L50 was cleared)
} as const;

function buildTrialsForClass(cls: HeroClass): ClassTrial[] {
  const titles = CLASS_TITLES[cls];
  const flavor = CLASS_FLAVOR[cls];
  return [
    {
      id: `${cls}_initiate` as ClassTrialId,
      heroClass: cls,
      tier: 1,
      title: titles[0],
      description: flavor[0],
      evaluate: (s) => ({ progress: Math.min(s.lifetimeRuns, THRESHOLDS.initiate), target: THRESHOLDS.initiate }),
    },
    {
      id: `${cls}_streak` as ClassTrialId,
      heroClass: cls,
      tier: 2,
      title: titles[1],
      description: flavor[1],
      evaluate: (s) => ({ progress: Math.min(s.bestStreak, THRESHOLDS.streak), target: THRESHOLDS.streak }),
    },
    {
      id: `${cls}_score` as ClassTrialId,
      heroClass: cls,
      tier: 3,
      title: titles[2],
      description: flavor[2],
      evaluate: (s) => ({ progress: Math.min(s.lifetimeScore, THRESHOLDS.score), target: THRESHOLDS.score }),
    },
    {
      id: `${cls}_boss` as ClassTrialId,
      heroClass: cls,
      tier: 4,
      title: titles[3],
      description: flavor[3],
      // "Cleared L50" === unlocked is >50 (since clearing L50 unlocks L51).
      evaluate: (s) => ({
        progress: Math.min(Math.max(0, s.highestUnlockedLevel - THRESHOLDS.bossLevel), 1),
        target: 1,
      }),
    },
  ];
}

/** Get the four trials for a specific class. Stable order (tier 1 → 4). */
export function getClassTrials(cls: HeroClass): ClassTrial[] {
  return buildTrialsForClass(cls);
}

/** Convenience: which trials has the player COMPLETED for a class? */
export function completedTrialsFor(cls: HeroClass, stats: ClassTrialStats): ClassTrial[] {
  return getClassTrials(cls).filter(t => {
    const { progress, target } = t.evaluate(stats);
    return progress >= target;
  });
}

/** Convenience: count how many of the 4 trials are complete. */
export function classTrialProgressCount(cls: HeroClass, stats: ClassTrialStats): { done: number; total: number } {
  return { done: completedTrialsFor(cls, stats).length, total: 4 };
}
