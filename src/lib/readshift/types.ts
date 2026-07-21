// ═══════════════════════════════════════════════════════════════════
// READSHIFT — shared domain types (pure, no React / no Supabase)
//
// READSHIFT is an asynchronous social identity game. Each round every
// active player privately receives one Signal (TELL / BLUR / FRAME) and
// answers a prompt; then everyone guesses who wrote each anonymous
// answer; then results are revealed and scored.
//
// These types are the single source of truth for the deterministic
// engine (signal assignment, scoring, awards, leaderboard, phase
// machine). Keep them free of persistence concerns — the DB layer maps
// rows onto these shapes.
// ═══════════════════════════════════════════════════════════════════

/** The three private objectives a player can be assigned each round. */
export type Signal = 'TELL' | 'BLUR' | 'FRAME';

export const SIGNALS: readonly Signal[] = ['TELL', 'BLUR', 'FRAME'] as const;

/** Game / round lifecycle phases. Mirrors the DB `status`/`phase` columns. */
export type Phase =
  | 'lobby'
  | 'shift'
  | 'read'
  | 'reveal'
  | 'completed'
  | 'paused'
  | 'cancelled';

/** A single round's private Signal assignment for one player. */
export interface SignalAssignment {
  userId: string;
  signal: Signal;
  /** Present only when signal === 'FRAME'. Always another active player. */
  frameTargetUserId: string | null;
}

/**
 * One reader's ballot for a round.
 *
 * `guesses` maps an answer's AUTHOR id → the author id the reader thinks
 * wrote it. (Each author submits exactly one answer per round, so keying
 * by author id is unambiguous internally; the UI keys by answer id and
 * the persistence layer translates.)
 *
 * `complete` reflects the "full ballot" rule: a ballot only counts for
 * scoring when the reader has selected an author for every eligible
 * answer. Incomplete ballots earn no Reading points and their guesses do
 * not contribute to other players' Signal points.
 */
export interface Ballot {
  readerUserId: string;
  guesses: Record<string, string>;
  /** The answer (by author id) the reader marked as their Strong Read. */
  strongReadAuthorUserId: string | null;
  complete: boolean;
}

/** Tunable scoring/assignment parameters. Defaults live in constants.ts. */
export interface ScoringConfig {
  /** Hard cap on a single answer's Signal points per round (pre game-wide modifiers). */
  signalCapPerRound: number;
  correctReadPoints: number;
  strongReadBonus: number;
  perfectReadBonus: number;
  tellPerReader: number;
  tellMajorityBonus: number;
  blurPerWrongReader: number;
  blurShutoutBonus: number;
  blurDiversityBonus: number;
  blurDiversityThreshold: number;
  framePerTargetGuess: number;
  frameMajorityBonus: number;
  frameHiddenAuthorBonus: number;
}

/** Per-answer scoring breakdown — feeds the Reveal screen and awards. */
export interface AnswerScoreDetail {
  authorUserId: string;
  signal: Signal;
  frameTargetUserId: string | null;
  /** Readers eligible to guess THIS answer (counted ballots, excluding the author). */
  eligibleReaderCount: number;
  /** How many eligible readers correctly identified the real author. */
  correctGuessCount: number;
  /** authorId → number of eligible readers who guessed that author for this answer. */
  guessDistribution: Record<string, number>;
  /** For FRAME answers: how many eligible readers guessed the assigned target. */
  targetGuessCount: number;
  /** How many readers put their Strong Read on this answer, and how many were right. */
  strongReadCount: number;
  strongReadCorrectCount: number;
  /** Signal points before the per-round cap. */
  signalBaseTotal: number;
  /** Named bonus contributions (for transparent reveal display). */
  bonuses: { name: string; points: number }[];
  /** Final Signal points after applying the per-round cap. */
  signalPoints: number;
}

/** Full deterministic result of scoring one round. */
export interface RoundScore {
  /** reader id → Reading points earned this round. */
  readingPoints: Record<string, number>;
  /** author id → Signal points earned this round. */
  signalPoints: Record<string, number>;
  /** player id → reading + signal for the round. */
  totalPoints: Record<string, number>;
  /** author id → detailed breakdown. */
  perAnswer: Record<string, AnswerScoreDetail>;
  /** reader id → count of correct author identifications this round (for tie-breakers/stats). */
  correctReads: Record<string, number>;
  /** reader id → whether their Strong Read was correct this round. */
  strongReadCorrect: Record<string, boolean>;
}

/** A player's cumulative game aggregate — the input to the final leaderboard. */
export interface PlayerAggregate {
  userId: string;
  totalScore: number;
  readingScore: number;
  signalScore: number;
  correctReads: number;
  correctStrongReads: number;
}

/** Final standings row after tie-breakers are applied. */
export interface LeaderboardRow extends PlayerAggregate {
  rank: number;
  /** true when this row shares its rank with the row(s) above (unbroken tie). */
  tied: boolean;
}
