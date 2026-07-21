// ═══════════════════════════════════════════════════════════════════
// READSHIFT — final leaderboard + deterministic tie-breakers
//
// Tie-break order (spec):
//   1. Highest total score
//   2. Highest Reading score
//   3. Highest total correct Reads
//   4. Highest correct Strong Reads
//   5. Shared placement if still tied (NO random tie-break)
// ═══════════════════════════════════════════════════════════════════
import type { LeaderboardRow, PlayerAggregate } from './types';

/** Compare two aggregates by the tie-break chain. >0 means `a` ranks ahead. */
export function comparePlayers(a: PlayerAggregate, b: PlayerAggregate): number {
  if (b.totalScore !== a.totalScore) return a.totalScore - b.totalScore;
  if (b.readingScore !== a.readingScore) return a.readingScore - b.readingScore;
  if (b.correctReads !== a.correctReads) return a.correctReads - b.correctReads;
  if (b.correctStrongReads !== a.correctStrongReads) return a.correctStrongReads - b.correctStrongReads;
  return 0; // genuinely tied → shared placement
}

/** True when two players are equal across the ENTIRE tie-break chain. */
function fullyTied(a: PlayerAggregate, b: PlayerAggregate): boolean {
  return comparePlayers(a, b) === 0;
}

/**
 * Build the final standings. Players who remain tied after the full chain
 * share a rank (competition ranking: the next distinct player's rank
 * skips the tied positions). Sort is stable on userId for reproducibility
 * among fully-tied players.
 */
export function buildLeaderboard(players: PlayerAggregate[]): LeaderboardRow[] {
  const sorted = [...players].sort((a, b) => {
    const c = comparePlayers(a, b);
    if (c !== 0) return -c; // higher first
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });

  const rows: LeaderboardRow[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const prev = i > 0 ? sorted[i - 1] : null;
    const tiedWithPrev = prev != null && fullyTied(prev, sorted[i]);
    const rank = tiedWithPrev ? rows[i - 1].rank : i + 1;
    rows.push({ ...sorted[i], rank, tied: tiedWithPrev });
  }
  return rows;
}

/** The winner(s): every row sharing rank 1 (usually one; ties possible). */
export function winners(rows: LeaderboardRow[]): LeaderboardRow[] {
  return rows.filter((r) => r.rank === 1);
}
