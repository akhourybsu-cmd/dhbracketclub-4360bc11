// ═══════════════════════════════════════════════════════════════════
// READSHIFT — deterministic Signal assignment
//
// At the start of every round each active player is assigned exactly one
// Signal (TELL / BLUR / FRAME). This is SERVER-AUTHORITATIVE and must be
// reproducible from a stored seed. Goals (from the spec):
//   • Fairly distributed over the whole game (counts as balanced as the
//     math allows; every player gets each Signal at least once when
//     rounds permit).
//   • Never the same Signal 3+ times in a row for a player.
//   • FRAME targets are active participants, never self, balanced, and
//     avoid repeating the same framer→target pairing when alternatives
//     exist.
//
// Pure function: no persistence, no Date/Math.random. The DB layer feeds
// prior rounds' assignments in and stores the result.
// ═══════════════════════════════════════════════════════════════════
import type { Signal, SignalAssignment } from './types';
import { SIGNALS } from './types';
import { mulberry32, deriveRoundSeed, seededShuffle, type Rng } from './prng';

export interface AssignSignalsInput {
  /** Active players for THIS round (author-eligible at round start). */
  players: string[];
  /** 0-based index of the round being assigned. */
  roundIndex: number;
  /** history[r] = the assignments made for round r, for all r < roundIndex. */
  history: SignalAssignment[][];
  /** Per-game stored seed. */
  seed: number;
}

interface PlayerHistory {
  counts: Record<Signal, number>;
  last: Signal | null;
  streak: number; // consecutive count of `last`
}

function buildHistory(players: string[], history: SignalAssignment[][]): Record<string, PlayerHistory> {
  const h: Record<string, PlayerHistory> = {};
  for (const p of players) h[p] = { counts: { TELL: 0, BLUR: 0, FRAME: 0 }, last: null, streak: 0 };
  for (const round of history) {
    for (const a of round) {
      const rec = h[a.userId];
      if (!rec) continue; // player not active this round — ignore
      rec.counts[a.signal] += 1;
      if (rec.last === a.signal) rec.streak += 1;
      else { rec.last = a.signal; rec.streak = 1; }
    }
  }
  return h;
}

/** Round type quota: base floor(N/3) each, remainder to the globally-scarcest types. */
function computeQuota(n: number, history: SignalAssignment[][], rng: Rng): Record<Signal, number> {
  const quota: Record<Signal, number> = { TELL: 0, BLUR: 0, FRAME: 0 };
  const base = Math.floor(n / 3);
  for (const s of SIGNALS) quota[s] = base;
  let remainder = n - base * 3;

  // Global usage so far, to steer the remainder toward under-used types.
  const globalCount: Record<Signal, number> = { TELL: 0, BLUR: 0, FRAME: 0 };
  for (const round of history) for (const a of round) globalCount[a.signal] += 1;

  while (remainder > 0) {
    // Prefer the least globally-used type; deterministic tie-break by a
    // seeded shuffle of the signal order.
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

  // Assign in a seeded player order, but move "at-risk" players (already on
  // a 2-long streak) to the FRONT so they can claim a non-streak type while
  // round quota is still available. For N ≥ 4 the per-round quota of any one
  // signal is ≤ ⌈N/3⌉, so the count of players streaking on a given signal
  // can never exceed the non-streak quota — making no-3-in-a-row guaranteed.
  const shuffled = seededShuffle(players, rng);
  const atRisk = shuffled.filter((p) => hist[p].streak >= 2);
  const rest = shuffled.filter((p) => hist[p].streak < 2);
  const order = [...atRisk, ...rest];
  const result: Record<string, Signal> = {};

  for (const player of order) {
    const rec = hist[player];
    // Types that still have quota this round.
    const withQuota = SIGNALS.filter((s) => remaining[s] > 0);
    const pool = withQuota.length ? withQuota : [...SIGNALS]; // safety: never empty

    // Forbid a type that would create a 3-in-a-row streak, UNLESS that
    // leaves nothing available (then relax — correctness/liveness first).
    const nonStreak = pool.filter((s) => !(rec.last === s && rec.streak >= 2));
    const candidates = nonStreak.length ? nonStreak : pool;

    // Prefer the type the player has had LEAST (drives per-player balance
    // and "each signal at least once"); tie-break by most remaining round
    // quota, then by seeded order already baked into `SIGNALS` iteration.
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

/** Assign FRAME targets: balanced, never self, avoid repeat pairings. */
function assignFrameTargets(
  players: string[],
  signals: Record<string, Signal>,
  history: SignalAssignment[][],
  rng: Rng,
): SignalAssignment[] {
  // How often each player has previously been a FRAME target.
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

    // Prefer: (1) least-targeted overall, (2) an unseen pairing, (3) seeded tie-break.
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

  // Emit in the original player order for stable output.
  return players.map((userId) => ({
    userId,
    signal: signals[userId],
    frameTargetUserId: signals[userId] === 'FRAME' ? assignments[userId] ?? null : null,
  }));
}
