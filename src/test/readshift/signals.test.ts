import { describe, it, expect } from 'vitest';
import { assignSignals } from '@/lib/readshift/signals';
import type { Signal, SignalAssignment } from '@/lib/readshift/types';

/** Play a full game deterministically, feeding each round's result forward. */
function playGame(players: string[], rounds: number, seed: number): SignalAssignment[][] {
  const history: SignalAssignment[][] = [];
  for (let r = 0; r < rounds; r++) {
    history.push(assignSignals({ players, roundIndex: r, history, seed }));
  }
  return history;
}

describe('READSHIFT signal assignment', () => {
  it('assigns exactly one signal per active player per round', () => {
    const players = ['a', 'b', 'c', 'd', 'e'];
    const round = assignSignals({ players, roundIndex: 0, history: [], seed: 7 });
    expect(round.map((r) => r.userId).sort()).toEqual([...players].sort());
    for (const a of round) expect(['TELL', 'BLUR', 'FRAME']).toContain(a.signal);
  });

  it('is deterministic for a given seed', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f'];
    const g1 = playGame(players, 6, 4242);
    const g2 = playGame(players, 6, 4242);
    expect(g1).toEqual(g2);
  });

  it('never assigns a FRAME player themselves as target', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const players = ['a', 'b', 'c', 'd', 'e'];
      const game = playGame(players, 7, seed);
      for (const round of game) {
        for (const a of round) {
          if (a.signal === 'FRAME') {
            expect(a.frameTargetUserId).not.toBeNull();
            expect(a.frameTargetUserId).not.toBe(a.userId);
            expect(players).toContain(a.frameTargetUserId!);
          } else {
            expect(a.frameTargetUserId).toBeNull();
          }
        }
      }
    }
  });

  it('never gives a player the same signal 3+ times in a row', () => {
    for (const seed of [1, 5, 17, 500, 98765]) {
      for (const n of [4, 5, 6, 7, 8]) {
        const players = Array.from({ length: n }, (_, i) => `p${i}`);
        const game = playGame(players, 7, seed);
        for (const p of players) {
          const seq = game.map((round) => round.find((a) => a.userId === p)!.signal);
          for (let i = 2; i < seq.length; i++) {
            const threeSame = seq[i] === seq[i - 1] && seq[i] === seq[i - 2];
            expect(threeSame, `player ${p} seed ${seed} n${n}: ${seq.join(',')}`).toBe(false);
          }
        }
      }
    }
  });

  it('keeps per-player signal counts balanced over a full game', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f'];
    const game = playGame(players, 6, 321);
    for (const p of players) {
      const counts: Record<Signal, number> = { TELL: 0, BLUR: 0, FRAME: 0 };
      for (const round of game) counts[round.find((a) => a.userId === p)!.signal] += 1;
      const vals = Object.values(counts);
      // Every player sees each signal at least once when rounds permit (R=6, N=6),
      // and the spread stays tight.
      expect(Math.min(...vals)).toBeGreaterThanOrEqual(1);
      expect(Math.max(...vals) - Math.min(...vals)).toBeLessThanOrEqual(2);
    }
  });

  it('distributes signals across the room each round (roughly N/3 of each)', () => {
    const players = Array.from({ length: 9 }, (_, i) => `p${i}`);
    const round = assignSignals({ players, roundIndex: 0, history: [], seed: 11 });
    const counts: Record<Signal, number> = { TELL: 0, BLUR: 0, FRAME: 0 };
    for (const a of round) counts[a.signal] += 1;
    // 9 players → exactly 3 each.
    expect(counts).toEqual({ TELL: 3, BLUR: 3, FRAME: 3 });
  });

  it('balances FRAME targets and avoids repeat pairings when possible', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'f'];
    const game = playGame(players, 7, 246);
    const pairs = new Set<string>();
    let repeats = 0;
    const targetCounts: Record<string, number> = {};
    for (const round of game) {
      for (const a of round) {
        if (a.signal !== 'FRAME' || !a.frameTargetUserId) continue;
        targetCounts[a.frameTargetUserId] = (targetCounts[a.frameTargetUserId] ?? 0) + 1;
        const key = `${a.userId}->${a.frameTargetUserId}`;
        if (pairs.has(key)) repeats += 1;
        pairs.add(key);
      }
    }
    // Target load is reasonably balanced (no one is targeted excessively).
    const loads = Object.values(targetCounts);
    if (loads.length) {
      expect(Math.max(...loads) - Math.min(...loads)).toBeLessThanOrEqual(3);
    }
    // Repeat pairings are rare (avoided when alternatives exist).
    expect(repeats).toBeLessThanOrEqual(2);
  });

  it('handles the minimum room (4 players) without error', () => {
    const players = ['a', 'b', 'c', 'd'];
    const round = assignSignals({ players, roundIndex: 0, history: [], seed: 1 });
    expect(round).toHaveLength(4);
  });
});
