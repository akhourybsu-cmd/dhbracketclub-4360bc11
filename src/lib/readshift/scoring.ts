// ═══════════════════════════════════════════════════════════════════
// READSHIFT — deterministic, server-authoritative round scoring
//
// Pure logic (no persistence, no clock). See constants.ts DEFAULT_SCORING
// for the fully documented formula. Key design choices, per spec:
//
//  • Self-answer exclusion: a reader NEVER scores (or is scored by) their
//    own answer. We take the "show every answer, exclude self-guess from
//    scoring" approach — the caller may still surface the reader's own
//    card in the UI; here any self-guess is simply ignored.
//  • "Eligible readers" for an answer = readers with a COMPLETE ballot,
//    excluding the answer's author.
//  • Signal points are capped per answer per round (default 10) AFTER
//    bonuses so large rooms can't inflate scores without bound.
// ═══════════════════════════════════════════════════════════════════
import type { Ballot, RoundScore, ScoringConfig, Signal, AnswerScoreDetail } from './types';
import { DEFAULT_SCORING } from './constants';

export interface ScoreRoundInput {
  /** Author ids of players who submitted a valid answer (the answer pool). */
  answers: string[];
  /** author id → their Signal + optional FRAME target for this round. */
  signals: Record<string, { signal: Signal; frameTargetUserId: string | null }>;
  /** All ballots submitted this round (any reader, incl. non-submitters). */
  ballots: Ballot[];
  config?: Partial<ScoringConfig>;
}

function emptyDetail(
  authorUserId: string,
  signal: Signal,
  frameTargetUserId: string | null,
): AnswerScoreDetail {
  return {
    authorUserId,
    signal,
    frameTargetUserId,
    eligibleReaderCount: 0,
    correctGuessCount: 0,
    guessDistribution: {},
    targetGuessCount: 0,
    strongReadCount: 0,
    strongReadCorrectCount: 0,
    signalBaseTotal: 0,
    bonuses: [],
    signalPoints: 0,
  };
}

export function scoreRound(input: ScoreRoundInput): RoundScore {
  const cfg: ScoringConfig = { ...DEFAULT_SCORING, ...(input.config ?? {}) };
  const answerSet = new Set(input.answers);
  const countedBallots = input.ballots.filter((b) => b.complete);

  const readingPoints: Record<string, number> = {};
  const signalPoints: Record<string, number> = {};
  const totalPoints: Record<string, number> = {};
  const correctReads: Record<string, number> = {};
  const strongReadCorrect: Record<string, boolean> = {};
  const perAnswer: Record<string, AnswerScoreDetail> = {};

  const bump = (map: Record<string, number>, k: string, v: number) => {
    map[k] = (map[k] ?? 0) + v;
  };

  // Ensure every author and every counted reader appears in the maps.
  for (const a of input.answers) {
    readingPoints[a] ??= 0;
    signalPoints[a] ??= 0;
    correctReads[a] ??= 0;
  }
  for (const b of countedBallots) {
    readingPoints[b.readerUserId] ??= 0;
    correctReads[b.readerUserId] ??= 0;
  }

  // ── READING points ──────────────────────────────────────────────
  for (const b of countedBallots) {
    const reader = b.readerUserId;
    // Answers this reader can score = every valid answer except their own.
    const scorable = input.answers.filter((author) => author !== reader);
    let correct = 0;
    for (const author of scorable) {
      if (b.guesses[author] === author) correct += 1;
    }
    correctReads[reader] = (correctReads[reader] ?? 0) + correct;
    bump(readingPoints, reader, correct * cfg.correctReadPoints);

    // Strong Read: must target a scorable answer and be correct.
    const sr = b.strongReadAuthorUserId;
    const srValid = sr != null && sr !== reader && answerSet.has(sr);
    const srCorrect = srValid && b.guesses[sr] === sr;
    strongReadCorrect[reader] = !!srCorrect;
    if (srCorrect) bump(readingPoints, reader, cfg.strongReadBonus);

    // Perfect Read: correctly identified every scorable answer (≥1).
    if (scorable.length > 0 && correct === scorable.length) {
      bump(readingPoints, reader, cfg.perfectReadBonus);
    }
  }

  // ── SIGNAL points (per answer/author) ────────────────────────────
  for (const author of input.answers) {
    const sig = input.signals[author];
    const signal: Signal = sig?.signal ?? 'TELL';
    const frameTarget = sig?.frameTargetUserId ?? null;
    const detail = emptyDetail(author, signal, frameTarget);

    // Eligible readers for this answer: counted ballots that aren't the author.
    const eligible = countedBallots.filter((b) => b.readerUserId !== author);
    detail.eligibleReaderCount = eligible.length;

    let correctCount = 0;
    let targetCount = 0;
    for (const b of eligible) {
      const guess = b.guesses[author];
      if (guess == null) continue;
      detail.guessDistribution[guess] = (detail.guessDistribution[guess] ?? 0) + 1;
      if (guess === author) correctCount += 1;
      if (frameTarget && guess === frameTarget) targetCount += 1;
      if (b.strongReadAuthorUserId === author) {
        detail.strongReadCount += 1;
        if (guess === author) detail.strongReadCorrectCount += 1;
      }
    }
    detail.correctGuessCount = correctCount;
    detail.targetGuessCount = targetCount;

    const distinctAuthorsGuessed = Object.keys(detail.guessDistribution).length;
    const maxGuesses = Math.max(0, ...Object.values(detail.guessDistribution));

    let base = 0;
    const bonuses: { name: string; points: number }[] = [];

    if (signal === 'TELL') {
      base = correctCount * cfg.tellPerReader;
      if (detail.eligibleReaderCount > 0 && correctCount > detail.eligibleReaderCount / 2) {
        bonuses.push({ name: 'Majority Tell', points: cfg.tellMajorityBonus });
      }
    } else if (signal === 'BLUR') {
      const wrong = detail.eligibleReaderCount - correctCount;
      base = wrong * cfg.blurPerWrongReader;
      if (detail.eligibleReaderCount > 0 && correctCount === 0) {
        bonuses.push({ name: 'Perfect Blur', points: cfg.blurShutoutBonus });
      }
      if (distinctAuthorsGuessed >= cfg.blurDiversityThreshold) {
        bonuses.push({ name: 'Spread', points: cfg.blurDiversityBonus });
      }
    } else {
      // FRAME
      base = targetCount * cfg.framePerTargetGuess;
      // Majority bonus: target is tied-for-most (spec: award on tie).
      if (frameTarget && maxGuesses > 0 && (detail.guessDistribution[frameTarget] ?? 0) === maxGuesses) {
        bonuses.push({ name: 'Convincing Frame', points: cfg.frameMajorityBonus });
      }
      if (detail.eligibleReaderCount > 0 && correctCount === 0) {
        bonuses.push({ name: 'Stayed Hidden', points: cfg.frameHiddenAuthorBonus });
      }
    }

    const bonusTotal = bonuses.reduce((s, b) => s + b.points, 0);
    detail.signalBaseTotal = base;
    detail.bonuses = bonuses;
    detail.signalPoints = Math.min(base + bonusTotal, cfg.signalCapPerRound);

    perAnswer[author] = detail;
    bump(signalPoints, author, detail.signalPoints);
  }

  // ── Totals ───────────────────────────────────────────────────────
  const everyone = new Set<string>([...Object.keys(readingPoints), ...Object.keys(signalPoints)]);
  for (const p of everyone) {
    totalPoints[p] = (readingPoints[p] ?? 0) + (signalPoints[p] ?? 0);
  }

  return { readingPoints, signalPoints, totalPoints, perAnswer, correctReads, strongReadCorrect };
}
