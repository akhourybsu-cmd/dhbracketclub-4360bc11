// ═══════════════════════════════════════════════════════════════════
// READSHIFT — game constants & default configuration
// ═══════════════════════════════════════════════════════════════════
import type { ScoringConfig } from './types';

export const MIN_PLAYERS = 4;
export const RECOMMENDED_MAX_PLAYERS = 10;
export const HARD_MAX_PLAYERS = 12;

export const DEFAULT_ROUNDS = 5;
export const MIN_ROUNDS = 3;
export const MAX_ROUNDS = 7;

/** A round needs at least this many valid submitted answers to be scored. */
export const MIN_VALID_ANSWERS = 3;

export const DEFAULT_SHIFT_HOURS = 24;
export const DEFAULT_READ_HOURS = 24;
/** How long a reveal stays open before the next round auto-starts. */
export const DEFAULT_REVEAL_HOURS = 12;

export const ANSWER_MAX_CHARS = 240;
export const ANSWER_MIN_CHARS = 1;

/**
 * Scoring formula (documented):
 *
 * READING (per reader, excluding their own answer):
 *   +1 per correctly identified author
 *   +2 extra if their Strong Read guess was correct (no penalty if wrong)
 *   +3 Perfect Read bonus if they correctly identify EVERY eligible answer
 *
 * SIGNAL (per answer/author), capped at `signalCapPerRound` (default 10)
 * AFTER bonuses so large rooms can't runaway-inflate:
 *   TELL  : +1 per correct reader; +2 if a strict majority identified them
 *   BLUR  : +1 per WRONG reader; +2 if nobody identified them;
 *           +1 diversity bonus if ≥3 distinct authors were guessed for it
 *   FRAME : +2 per reader who guessed the target; +3 if the target is tied
 *           for the most guesses; +1 if nobody identified the real author
 */
export const DEFAULT_SCORING: ScoringConfig = {
  signalCapPerRound: 10,
  correctReadPoints: 1,
  strongReadBonus: 2,
  perfectReadBonus: 3,
  tellPerReader: 1,
  tellMajorityBonus: 2,
  blurPerWrongReader: 1,
  blurShutoutBonus: 2,
  blurDiversityBonus: 1,
  blurDiversityThreshold: 3,
  framePerTargetGuess: 2,
  frameMajorityBonus: 3,
  frameHiddenAuthorBonus: 1,
};

export const READSHIFT_SLUG = 'readshift';
