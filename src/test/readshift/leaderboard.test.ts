import { describe, it, expect } from 'vitest';
import { buildLeaderboard, winners, comparePlayers } from '@/lib/readshift/leaderboard';
import type { PlayerAggregate } from '@/lib/readshift/types';

const p = (
  userId: string,
  totalScore: number,
  readingScore = 0,
  correctReads = 0,
  correctStrongReads = 0,
): PlayerAggregate => ({ userId, totalScore, readingScore, signalScore: totalScore - readingScore, correctReads, correctStrongReads });

describe('READSHIFT leaderboard tie-breakers', () => {
  it('ranks by total score first', () => {
    const rows = buildLeaderboard([p('a', 10), p('b', 30), p('c', 20)]);
    expect(rows.map((r) => r.userId)).toEqual(['b', 'c', 'a']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it('breaks total ties by reading score', () => {
    const rows = buildLeaderboard([p('a', 20, 5), p('b', 20, 12)]);
    expect(rows.map((r) => r.userId)).toEqual(['b', 'a']);
    expect(rows.every((r) => !r.tied)).toBe(true);
  });

  it('breaks total+reading ties by correct reads', () => {
    const rows = buildLeaderboard([p('a', 20, 10, 3), p('b', 20, 10, 7)]);
    expect(rows[0].userId).toBe('b');
  });

  it('breaks total+reading+reads ties by correct Strong Reads', () => {
    const rows = buildLeaderboard([p('a', 20, 10, 4, 1), p('b', 20, 10, 4, 3)]);
    expect(rows[0].userId).toBe('b');
  });

  it('assigns shared placement when fully tied (no random break) and skips ranks', () => {
    const rows = buildLeaderboard([p('a', 20, 10, 4, 2), p('b', 20, 10, 4, 2), p('c', 5)]);
    // a and b are fully tied → both rank 1 (shared), c is rank 3.
    expect(rows.filter((r) => r.rank === 1)).toHaveLength(2);
    expect(rows.find((r) => r.userId === 'c')!.rank).toBe(3);
    expect(rows.filter((r) => r.tied)).toHaveLength(1); // the second of the tied pair flags tied
  });

  it('winners() returns everyone sharing rank 1', () => {
    const rows = buildLeaderboard([p('a', 20, 10, 4, 2), p('b', 20, 10, 4, 2), p('c', 5)]);
    expect(winners(rows).map((r) => r.userId).sort()).toEqual(['a', 'b']);
  });

  it('comparePlayers is deterministic and sign-correct', () => {
    expect(comparePlayers(p('a', 30), p('b', 10))).toBeGreaterThan(0);
    expect(comparePlayers(p('a', 10), p('b', 30))).toBeLessThan(0);
    expect(comparePlayers(p('a', 10, 5, 2, 1), p('b', 10, 5, 2, 1))).toBe(0);
  });
});
