// ═══════════════════════════════════════════════════════════════════
// READSHIFT — Deno-side engine (self-contained, pure)
//
// Edge functions (Deno) cannot import from the Vite app's `src/`, so this
// is a faithful copy of the canonical, unit-tested logic in
// `src/lib/readshift/*`. It is kept BYTE-FOR-BEHAVIOUR identical by
// `src/test/readshift/engineSync.test.ts`, which runs the same fixtures
// through this copy AND the canonical modules and asserts equality. If
// you change scoring/assignment here, change it in `src/lib/readshift/`
// too — the sync test fails otherwise.
//
// No Deno-only APIs are used, so this file is importable by both Deno and
// Node (vitest).
// ═══════════════════════════════════════════════════════════════════

export type Signal = 'TELL' | 'BLUR' | 'FRAME';
export const SIGNALS: readonly Signal[] = ['TELL', 'BLUR', 'FRAME'] as const;

export type Phase =
  | 'lobby' | 'shift' | 'read' | 'reveal' | 'completed' | 'paused' | 'cancelled';

export interface SignalAssignment {
  userId: string;
  signal: Signal;
  frameTargetUserId: string | null;
}

export interface Ballot {
  readerUserId: string;
  guesses: Record<string, string>;
  strongReadAuthorUserId: string | null;
  complete: boolean;
}

export interface ScoringConfig {
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

export interface AnswerScoreDetail {
  authorUserId: string;
  signal: Signal;
  frameTargetUserId: string | null;
  eligibleReaderCount: number;
  correctGuessCount: number;
  guessDistribution: Record<string, number>;
  targetGuessCount: number;
  strongReadCount: number;
  strongReadCorrectCount: number;
  signalBaseTotal: number;
  bonuses: { name: string; points: number }[];
  signalPoints: number;
}

export interface RoundScore {
  readingPoints: Record<string, number>;
  signalPoints: Record<string, number>;
  totalPoints: Record<string, number>;
  perAnswer: Record<string, AnswerScoreDetail>;
  correctReads: Record<string, number>;
  strongReadCorrect: Record<string, boolean>;
}

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

// ── PRNG ──────────────────────────────────────────────────────────
type Rng = () => number;
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function deriveRoundSeed(seed: number, roundIndex: number): number {
  return (seed ^ Math.imul(roundIndex + 1, 0x9e3779b1)) >>> 0;
}
export function seededShuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Signal assignment ─────────────────────────────────────────────
export interface AssignSignalsInput {
  players: string[];
  roundIndex: number;
  history: SignalAssignment[][];
  seed: number;
}
interface PlayerHistory { counts: Record<Signal, number>; last: Signal | null; streak: number; }

function buildHistory(players: string[], history: SignalAssignment[][]): Record<string, PlayerHistory> {
  const h: Record<string, PlayerHistory> = {};
  for (const p of players) h[p] = { counts: { TELL: 0, BLUR: 0, FRAME: 0 }, last: null, streak: 0 };
  for (const round of history) {
    for (const a of round) {
      const rec = h[a.userId];
      if (!rec) continue;
      rec.counts[a.signal] += 1;
      if (rec.last === a.signal) rec.streak += 1;
      else { rec.last = a.signal; rec.streak = 1; }
    }
  }
  return h;
}

function computeQuota(n: number, history: SignalAssignment[][], rng: Rng): Record<Signal, number> {
  const quota: Record<Signal, number> = { TELL: 0, BLUR: 0, FRAME: 0 };
  const base = Math.floor(n / 3);
  for (const s of SIGNALS) quota[s] = base;
  let remainder = n - base * 3;
  const globalCount: Record<Signal, number> = { TELL: 0, BLUR: 0, FRAME: 0 };
  for (const round of history) for (const a of round) globalCount[a.signal] += 1;
  while (remainder > 0) {
    const order = seededShuffle(SIGNALS, rng);
    let pick: Signal = order[0];
    for (const s of order) {
      if (globalCount[s] + quota[s] < globalCount[pick] + quota[pick]) pick = s;
    }
    quota[pick] += 1;
    remainder -= 1;
  }
  return quota;
}

export function assignSignals(input: AssignSignalsInput): SignalAssignment[] {
  const { players, roundIndex, history, seed } = input;
  const n = players.length;
  if (n === 0) return [];
  const rng = mulberry32(deriveRoundSeed(seed, roundIndex));
  const hist = buildHistory(players, history);
  const quota = computeQuota(n, history, rng);
  const remaining: Record<Signal, number> = { ...quota };
  const shuffled = seededShuffle(players, rng);
  const atRisk = shuffled.filter((p) => hist[p].streak >= 2);
  const rest = shuffled.filter((p) => hist[p].streak < 2);
  const order = [...atRisk, ...rest];
  const result: Record<string, Signal> = {};
  for (const player of order) {
    const rec = hist[player];
    const withQuota = SIGNALS.filter((s) => remaining[s] > 0);
    const pool = withQuota.length ? withQuota : [...SIGNALS];
    const nonStreak = pool.filter((s) => !(rec.last === s && rec.streak >= 2));
    const candidates = nonStreak.length ? nonStreak : pool;
    let best = candidates[0];
    for (const s of candidates) {
      const better =
        rec.counts[s] < rec.counts[best] ||
        (rec.counts[s] === rec.counts[best] && remaining[s] > remaining[best]);
      if (better) best = s;
    }
    result[player] = best;
    if (remaining[best] > 0) remaining[best] -= 1;
  }
  return assignFrameTargets(players, result, history, rng);
}

function assignFrameTargets(
  players: string[], signals: Record<string, Signal>, history: SignalAssignment[][], rng: Rng,
): SignalAssignment[] {
  const targetCount: Record<string, number> = {};
  for (const p of players) targetCount[p] = 0;
  const seenPairs = new Set<string>();
  for (const round of history) {
    for (const a of round) {
      if (a.signal === 'FRAME' && a.frameTargetUserId) {
        if (targetCount[a.frameTargetUserId] != null) targetCount[a.frameTargetUserId] += 1;
        seenPairs.add(`${a.userId}->${a.frameTargetUserId}`);
      }
    }
  }
  const framers = seededShuffle(players.filter((p) => signals[p] === 'FRAME'), rng);
  const assignments: Record<string, string | null> = {};
  for (const framer of framers) {
    const options = players.filter((p) => p !== framer);
    if (options.length === 0) { assignments[framer] = null; continue; }
    const shuffled = seededShuffle(options, rng);
    let best = shuffled[0];
    for (const cand of shuffled) {
      const candSeen = seenPairs.has(`${framer}->${cand}`) ? 1 : 0;
      const bestSeen = seenPairs.has(`${framer}->${best}`) ? 1 : 0;
      const better =
        targetCount[cand] < targetCount[best] ||
        (targetCount[cand] === targetCount[best] && candSeen < bestSeen);
      if (better) best = cand;
    }
    assignments[framer] = best;
    targetCount[best] += 1;
    seenPairs.add(`${framer}->${best}`);
  }
  return players.map((userId) => ({
    userId,
    signal: signals[userId],
    frameTargetUserId: signals[userId] === 'FRAME' ? assignments[userId] ?? null : null,
  }));
}

// ── Scoring ───────────────────────────────────────────────────────
export interface ScoreRoundInput {
  answers: string[];
  signals: Record<string, { signal: Signal; frameTargetUserId: string | null }>;
  ballots: Ballot[];
  config?: Partial<ScoringConfig>;
}

function emptyDetail(authorUserId: string, signal: Signal, frameTargetUserId: string | null): AnswerScoreDetail {
  return {
    authorUserId, signal, frameTargetUserId,
    eligibleReaderCount: 0, correctGuessCount: 0, guessDistribution: {},
    targetGuessCount: 0, strongReadCount: 0, strongReadCorrectCount: 0,
    signalBaseTotal: 0, bonuses: [], signalPoints: 0,
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
  const bump = (map: Record<string, number>, k: string, v: number) => { map[k] = (map[k] ?? 0) + v; };

  for (const a of input.answers) { readingPoints[a] ??= 0; signalPoints[a] ??= 0; correctReads[a] ??= 0; }
  for (const b of countedBallots) { readingPoints[b.readerUserId] ??= 0; correctReads[b.readerUserId] ??= 0; }

  for (const b of countedBallots) {
    const reader = b.readerUserId;
    const scorable = input.answers.filter((author) => author !== reader);
    let correct = 0;
    for (const author of scorable) if (b.guesses[author] === author) correct += 1;
    correctReads[reader] = (correctReads[reader] ?? 0) + correct;
    bump(readingPoints, reader, correct * cfg.correctReadPoints);
    const sr = b.strongReadAuthorUserId;
    const srValid = sr != null && sr !== reader && answerSet.has(sr);
    const srCorrect = srValid && b.guesses[sr] === sr;
    strongReadCorrect[reader] = !!srCorrect;
    if (srCorrect) bump(readingPoints, reader, cfg.strongReadBonus);
    if (scorable.length > 0 && correct === scorable.length) bump(readingPoints, reader, cfg.perfectReadBonus);
  }

  for (const author of input.answers) {
    const sig = input.signals[author];
    const signal: Signal = sig?.signal ?? 'TELL';
    const frameTarget = sig?.frameTargetUserId ?? null;
    const detail = emptyDetail(author, signal, frameTarget);
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
      if (detail.eligibleReaderCount > 0 && correctCount === 0) bonuses.push({ name: 'Perfect Blur', points: cfg.blurShutoutBonus });
      if (distinctAuthorsGuessed >= cfg.blurDiversityThreshold) bonuses.push({ name: 'Spread', points: cfg.blurDiversityBonus });
    } else {
      base = targetCount * cfg.framePerTargetGuess;
      if (frameTarget && maxGuesses > 0 && (detail.guessDistribution[frameTarget] ?? 0) === maxGuesses) {
        bonuses.push({ name: 'Convincing Frame', points: cfg.frameMajorityBonus });
      }
      if (detail.eligibleReaderCount > 0 && correctCount === 0) bonuses.push({ name: 'Stayed Hidden', points: cfg.frameHiddenAuthorBonus });
    }
    const bonusTotal = bonuses.reduce((s, b) => s + b.points, 0);
    detail.signalBaseTotal = base;
    detail.bonuses = bonuses;
    detail.signalPoints = Math.min(base + bonusTotal, cfg.signalCapPerRound);
    perAnswer[author] = detail;
    bump(signalPoints, author, detail.signalPoints);
  }

  const everyone = new Set<string>([...Object.keys(readingPoints), ...Object.keys(signalPoints)]);
  for (const p of everyone) totalPoints[p] = (readingPoints[p] ?? 0) + (signalPoints[p] ?? 0);

  return { readingPoints, signalPoints, totalPoints, perAnswer, correctReads, strongReadCorrect };
}

// ── Phase transitions ─────────────────────────────────────────────
export type TransitionTrigger = 'start' | 'advance' | 'pause' | 'resume' | 'cancel';
export interface PhaseContext { round: number; totalRounds: number; resumeInto?: Phase; }
const ACTIVE_PHASES: Phase[] = ['shift', 'read', 'reveal'];

export function resolveTransition(
  from: Phase, trigger: TransitionTrigger, ctx: PhaseContext,
): { to: Phase; nextRound?: number } | null {
  switch (trigger) {
    case 'start': return from === 'lobby' ? { to: 'shift', nextRound: 1 } : null;
    case 'advance':
      if (from === 'shift') return { to: 'read' };
      if (from === 'read') return { to: 'reveal' };
      if (from === 'reveal') return ctx.round < ctx.totalRounds ? { to: 'shift', nextRound: ctx.round + 1 } : { to: 'completed' };
      return null;
    case 'pause': return ACTIVE_PHASES.includes(from) ? { to: 'paused' } : null;
    case 'resume':
      if (from !== 'paused') return null;
      return ctx.resumeInto && ACTIVE_PHASES.includes(ctx.resumeInto) ? { to: ctx.resumeInto } : null;
    case 'cancel': return from === 'completed' || from === 'cancelled' ? null : { to: 'cancelled' };
    default: return null;
  }
}

// ── Round awards ──────────────────────────────────────────────────
export interface RoundAward { key: string; label: string; userId: string; value: number; }

function pickAnswer(details: AnswerScoreDetail[], metric: (d: AnswerScoreDetail) => number, requirePositive = true): AnswerScoreDetail | null {
  let best: AnswerScoreDetail | null = null;
  let bestVal = -Infinity;
  for (const d of details) {
    const v = metric(d);
    if (v > bestVal || (v === bestVal && best && d.authorUserId < best.authorUserId)) { best = d; bestVal = v; }
  }
  if (!best) return null;
  if (requirePositive && metric(best) <= 0) return null;
  return best;
}

export function computeRoundAwards(score: RoundScore): RoundAward[] {
  const details = Object.values(score.perAnswer);
  const awards: RoundAward[] = [];
  const push = (key: string, label: string, d: AnswerScoreDetail | null, value: number) => { if (d) awards.push({ key, label, userId: d.authorUserId, value }); };
  const bestFrame = pickAnswer(details.filter((d) => d.signal === 'FRAME'), (d) => d.targetGuessCount);
  push('best_frame', 'Best Frame', bestFrame, bestFrame?.targetGuessCount ?? 0);
  const bestBlur = pickAnswer(details.filter((d) => d.signal === 'BLUR'), (d) => d.eligibleReaderCount - d.correctGuessCount);
  push('best_blur', 'Best Blur', bestBlur, bestBlur ? bestBlur.eligibleReaderCount - bestBlur.correctGuessCount : 0);
  const obviousTell = pickAnswer(details.filter((d) => d.signal === 'TELL'), (d) => d.correctGuessCount);
  push('most_obvious_tell', 'Most Obvious Tell', obviousTell, obviousTell?.correctGuessCount ?? 0);
  const hardest = pickAnswer(details.filter((d) => d.eligibleReaderCount >= 2), (d) => (d.eligibleReaderCount - d.correctGuessCount) / d.eligibleReaderCount, false);
  push('hardest_to_read', 'Hardest to Read', hardest, hardest ? hardest.eligibleReaderCount - hardest.correctGuessCount : 0);
  let consensus: { d: AnswerScoreDetail; count: number } | null = null;
  for (const d of details) {
    for (const [guessed, count] of Object.entries(d.guessDistribution)) {
      if (guessed === d.authorUserId) continue;
      if (!consensus || count > consensus.count || (count === consensus.count && d.authorUserId < consensus.d.authorUserId)) consensus = { d, count };
    }
  }
  if (consensus && consensus.count >= 2) awards.push({ key: 'biggest_incorrect_consensus', label: 'Biggest Incorrect Consensus', userId: consensus.d.authorUserId, value: consensus.count });
  let topReader: string | null = null;
  let topReads = 0;
  for (const [reader, count] of Object.entries(score.correctReads)) {
    if (count > topReads || (count === topReads && topReader && reader < topReader)) { topReader = reader; topReads = count; }
  }
  if (topReader && topReads > 0) awards.push({ key: 'mind_reader', label: 'Mind Reader', userId: topReader, value: topReads });
  return awards;
}
