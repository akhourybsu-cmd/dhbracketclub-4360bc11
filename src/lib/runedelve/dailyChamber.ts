// Rune Delve — Daily Chamber (R4)
//
// A campaign-mode daily challenge that sits alongside the existing
// Endless Survival "Daily" surface (which is the 2-min arena). Daily
// Chamber picks a specific campaign level + locks in a specific run
// modifier, deterministically rolled from today's UTC date so every
// player sees the same configuration on the same day.
//
// Why no schema work in R4 first cut:
//   • Selection is pure-function of date → no DB row needed
//   • "Played today" is tracked in localStorage (per-device, fine
//     for first-cut UX). Server-side enforcement / leaderboards are
//     a follow-up if engagement warrants it.
//   • Resulting runs land in `rune_delve_runs` as normal (campaign
//     row), so personal bests + score history still work — they
//     just won't be filtered as "daily-only" yet.
//
// Constraints on level pick:
//   • Avoid the absolute floor (L1–4) — too easy, no challenge
//   • Avoid the cap (L141–150) — too punishing for daily attempts
//   • Player's highest unlocked level caps the pick on their end so
//     a brand-new player can't be offered L78 they haven't reached

import { todayUtcDateString } from './dailyChallenge';
import { mulberry32 } from './prng';
import { RUN_MODIFIERS, type RunModifier } from './runModifiers';

const MIN_LEVEL = 5;
const MAX_LEVEL = 140;

/** Hash a YYYY-MM-DD string into a 32-bit seed. djb2-ish; fast +
 *  good-enough variance for one number per day. */
function seedFromDateString(dateStr: string): number {
  let h = 5381;
  for (let i = 0; i < dateStr.length; i++) {
    h = ((h << 5) + h) ^ dateStr.charCodeAt(i);
  }
  // Force unsigned 32-bit so the PRNG never sees a negative seed.
  return h >>> 0;
}

export interface DailyChamberSelection {
  date: string;
  /** Level number to play. */
  levelNumber: number;
  /** Modifier the player MUST use — no picker shown when daily mode is on. */
  modifier: RunModifier;
}

/**
 * Pick today's Daily Chamber (or a specific date for testing /
 * countdown rendering). Pure function — same date in always yields the
 * same selection across the player base.
 *
 * `playerCap` clamps the level to what the player has unlocked so a
 * brand-new player isn't shown L120 they can't reach. Pass `Infinity`
 * (or omit) to get the unclamped global selection.
 */
export function dailyChamberFor(date: Date = new Date(), playerCap = Infinity): DailyChamberSelection {
  const dateStr = todayUtcDateString(date);
  const seed = seedFromDateString(dateStr);
  const rng = mulberry32(seed);

  // First roll picks the level. Clamp the global ceiling to whatever
  // the player can actually reach so the daily isn't a tease.
  const upperCap = Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, Math.floor(playerCap)));
  const range = Math.max(1, upperCap - MIN_LEVEL + 1);
  const levelNumber = MIN_LEVEL + Math.floor(rng() * range);

  // Second roll picks the modifier from the full pool — no "Steady
  // Path" offered for the daily, since the locked modifier IS the
  // daily's twist.
  const modIdx = Math.floor(rng() * RUN_MODIFIERS.length);
  const modifier = RUN_MODIFIERS[modIdx];

  return { date: dateStr, levelNumber, modifier };
}

/** localStorage key for the per-user "played today" flag. Scoped to
 *  the date so it auto-rolls over at UTC midnight. */
export function dailyPlayedKey(userId: string, dateStr: string): string {
  return `rd-daily-chamber-played:${userId}:${dateStr}`;
}

/** Helper: has the user played today's chamber? */
export function hasPlayedDailyChamber(userId: string, dateStr: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(dailyPlayedKey(userId, dateStr)) === '1';
  } catch {
    return false;
  }
}

/** Helper: mark today's chamber as played. */
export function markDailyChamberPlayed(userId: string, dateStr: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(dailyPlayedKey(userId, dateStr), '1');
  } catch {
    /* private mode / quota — silent */
  }
}
