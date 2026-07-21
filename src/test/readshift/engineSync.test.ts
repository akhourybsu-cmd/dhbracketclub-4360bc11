// Guards that the Deno-side edge engine (supabase/functions/_shared/
// readshiftEngine.ts) stays behaviourally identical to the canonical,
// unit-tested logic in src/lib/readshift/*. We run a battery of
// deterministic fixtures through BOTH and assert deep equality. If this
// fails, the two copies have diverged — reconcile them.
import { describe, it, expect } from 'vitest';

import { assignSignals as canonAssign } from '@/lib/readshift/signals';
import { scoreRound as canonScore } from '@/lib/readshift/scoring';
import { computeRoundAwards as canonAwards } from '@/lib/readshift/awards';
import { resolveTransition as canonResolve } from '@/lib/readshift/phaseEngine';
import { mulberry32 } from '@/lib/readshift/prng';
import type { Ballot, SignalAssignment, Signal } from '@/lib/readshift/types';

import {
  assignSignals as denoAssign,
  scoreRound as denoScore,
  computeRoundAwards as denoAwards,
  resolveTransition as denoResolve,
  type TransitionTrigger,
} from '../../../supabase/functions/_shared/readshiftEngine';

const SIGS: Signal[] = ['TELL', 'BLUR', 'FRAME'];

describe('READSHIFT engine sync — Deno copy matches canonical', () => {
  it('assignSignals is identical across a matrix of rooms/seeds/rounds', () => {
    for (const n of [4, 5, 6, 7, 8, 10, 12]) {
      for (const seed of [1, 7, 42, 1000, 999999]) {
        const players = Array.from({ length: n }, (_, i) => `u${i}`);
        const canonHist: SignalAssignment[][] = [];
        const denoHist: SignalAssignment[][] = [];
        for (let r = 0; r < 7; r++) {
          const c = canonAssign({ players, roundIndex: r, history: canonHist, seed });
          const d = denoAssign({ players, roundIndex: r, history: denoHist, seed });
          expect(d).toEqual(c);
          canonHist.push(c);
          denoHist.push(d);
        }
      }
    }
  });

  it('scoreRound is identical across randomized fixtures', () => {
    const rng = mulberry32(20260721);
    const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

    for (let f = 0; f < 200; f++) {
      const n = 4 + Math.floor(rng() * 8); // 4..11
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      // A random subset submits (>=3).
      const submitters = players.filter(() => rng() < 0.85);
      const answers = submitters.length >= 3 ? submitters : players.slice(0, 3);

      const signals: Record<string, { signal: Signal; frameTargetUserId: string | null }> = {};
      for (const a of answers) {
        const sig = pick(SIGS);
        const others = players.filter((p) => p !== a);
        signals[a] = { signal: sig, frameTargetUserId: sig === 'FRAME' ? pick(others) : null };
      }

      const ballots: Ballot[] = players.map((reader) => {
        const guesses: Record<string, string> = {};
        for (const author of answers) if (author !== reader) guesses[author] = pick(players);
        const complete = rng() < 0.8 && answers.some((a) => a !== reader);
        const guessableAnswers = answers.filter((a) => a !== reader);
        return {
          readerUserId: reader,
          guesses,
          strongReadAuthorUserId: guessableAnswers.length ? pick(guessableAnswers) : null,
          complete,
        };
      });

      const input = { answers, signals, ballots };
      expect(denoScore(input)).toEqual(canonScore(input));
    }
  });

  it('computeRoundAwards is identical on scored fixtures', () => {
    const rng = mulberry32(555);
    const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
    for (let f = 0; f < 50; f++) {
      const players = Array.from({ length: 6 }, (_, i) => `q${i}`);
      const answers = players.slice(0, 5);
      const signals: Record<string, { signal: Signal; frameTargetUserId: string | null }> = {};
      for (const a of answers) {
        const sig = pick(SIGS);
        signals[a] = { signal: sig, frameTargetUserId: sig === 'FRAME' ? pick(players.filter((p) => p !== a)) : null };
      }
      const ballots: Ballot[] = players.map((reader) => {
        const guesses: Record<string, string> = {};
        for (const author of answers) if (author !== reader) guesses[author] = pick(players);
        return { readerUserId: reader, guesses, strongReadAuthorUserId: null, complete: true };
      });
      const canonScored = canonScore({ answers, signals, ballots });
      const denoScored = denoScore({ answers, signals, ballots });
      expect(denoAwards(denoScored)).toEqual(canonAwards(canonScored));
    }
  });

  it('resolveTransition is identical across the trigger matrix', () => {
    const phases = ['lobby', 'shift', 'read', 'reveal', 'completed', 'paused', 'cancelled'] as const;
    const triggers: TransitionTrigger[] = ['start', 'advance', 'pause', 'resume', 'cancel'];
    for (const from of phases) {
      for (const trigger of triggers) {
        for (const round of [1, 3, 5]) {
          const ctx = { round, totalRounds: 5, resumeInto: 'read' as const };
          expect(denoResolve(from, trigger, ctx)).toEqual(canonResolve(from, trigger, ctx));
        }
      }
    }
  });
});
