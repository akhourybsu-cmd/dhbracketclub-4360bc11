// Aggregators for the Draft Stats hub. Pure functions over normalised
// arrays — no Supabase, no React. Build memoised views on top.

export interface StatsPick {
  id: string;
  draft_id: string;
  user_id: string;
  round: number;
  pick_number: number;
  pick_text: string;
  picked_at: string | null;
}

export interface StatsPickRating {
  pick_id: string;
  pick_text: string;
  score: number;
}

export interface StatsResult {
  id: string;
  draft_id: string;
  user_id: string;
  rank: number;
  total_score: number;
  points_awarded: number;
  pick_ratings: StatsPickRating[];
  /** When the Draft Report was generated — the de-facto completion date. */
  created_at?: string | null;
}


export interface StatsDraft {
  id: string;
  topic: string;
  category: string | null;
  created_by: string;
  created_at: string;
  num_rounds: number;
  status: string;
}

export interface StatsSeason {
  id: string;
  name: string;
  season_number: number | null;
  subtitle: string | null;
  status: string;
  starts_at: string;
  champion_user_id: string | null;
  runner_up_user_id: string | null;
  third_place_user_id: string | null;
  regular_season_champion_user_id: string | null;
}

export interface StatsStanding {
  season_id: string;
  user_id: string;
  season_points: number;
  drafts_played: number;
  wins: number;
  podiums: number;
  avg_finish: number;
  avg_score: number;
  best_score: number;
  worst_score: number;
  consistency: number;
  rank: number | null;
  playoff_seed: number | null;
}

export interface StatsPlayoffMatch {
  season_id: string;
  round: string;
  winner_user_id: string | null;
  user_a: string | null;
  user_b: string | null;
}

export interface StatsSeasonEntry {
  season_id: string;
  draft_id: string;
  is_playoff: boolean;
}

export interface StatsProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface StatsDataset {
  picks: StatsPick[];
  results: StatsResult[];
  drafts: StatsDraft[];
  seasons: StatsSeason[];
  standings: StatsStanding[];
  matches: StatsPlayoffMatch[];
  seasonEntries: StatsSeasonEntry[];
  profiles: Map<string, StatsProfile>;
}

export const displayName = (uid: string, d: StatsDataset) =>
  d.profiles.get(uid)?.display_name || 'Unknown';

export const avatarUrl = (uid: string, d: StatsDataset) =>
  d.profiles.get(uid)?.avatar_url || null;

/* ───── Per-user aggregate ───── */

export interface UserAggregate {
  userId: string;
  draftsPlayed: number;
  wins: number;
  podiums: number;
  totalSeasonPoints: number;
  avgFinish: number;
  avgScore: number;
  bestFinish: number;
  bestScore: number;
  worstScore: number;
  consistency: number; // std dev of total_score
  winRate: number;
  podiumRate: number;
  championships: number;
  finalsAppearances: number;
  regularSeasonTitles: number;
  thirdPlaceMedals: number;
}

export function computeChampionshipsByUser(d: StatsDataset): Map<string, number> {
  // Source of truth is `draft_seasons.champion_user_id` (set when a season
  // is finalised). Falls back to a best-of-3 series clinch (2+ final-game
  // wins in the same season) for seasons whose champion column was never
  // written — otherwise a completed playoff bracket would show 0 titles.
  const championBySeason = new Map<string, string>();
  for (const s of d.seasons) {
    if (s.champion_user_id) championBySeason.set(s.id, s.champion_user_id);
  }

  const finalsBySeason = new Map<string, Map<string, number>>();
  for (const m of d.matches) {
    if (m.round !== 'final' || !m.winner_user_id) continue;
    const seasonMap = finalsBySeason.get(m.season_id) || new Map();
    seasonMap.set(m.winner_user_id, (seasonMap.get(m.winner_user_id) || 0) + 1);
    finalsBySeason.set(m.season_id, seasonMap);
  }
  for (const [seasonId, sm] of finalsBySeason) {
    if (championBySeason.has(seasonId)) continue;
    for (const [uid, wins] of sm) {
      if (wins >= 2) championBySeason.set(seasonId, uid);
    }
  }

  const champCount = new Map<string, number>();
  for (const [, uid] of championBySeason) {
    champCount.set(uid, (champCount.get(uid) || 0) + 1);
  }
  return champCount;
}

export function computeFinalsAppearancesByUser(d: StatsDataset): Map<string, number> {
  // distinct seasons where user appeared in any final-round match
  const seasonsByUser = new Map<string, Set<string>>();
  for (const m of d.matches) {
    if (m.round !== 'final') continue;
    for (const uid of [m.user_a, m.user_b]) {
      if (!uid) continue;
      const s = seasonsByUser.get(uid) || new Set();
      s.add(m.season_id);
      seasonsByUser.set(uid, s);
    }
  }
  const out = new Map<string, number>();
  for (const [uid, set] of seasonsByUser) out.set(uid, set.size);
  return out;
}

export function computeUserAggregate(userId: string, d: StatsDataset): UserAggregate | null {
  const mine = d.results.filter(r => r.user_id === userId);
  if (mine.length === 0) {
    return {
      userId, draftsPlayed: 0, wins: 0, podiums: 0, totalSeasonPoints: 0,
      avgFinish: 0, avgScore: 0, bestFinish: 0, bestScore: 0, worstScore: 0,
      consistency: 0, winRate: 0, podiumRate: 0,
      championships: 0, finalsAppearances: 0, regularSeasonTitles: 0, thirdPlaceMedals: 0,
    };
  }
  const wins = mine.filter(r => r.rank === 1).length;
  const podiums = mine.filter(r => r.rank <= 3).length;
  const scores = mine.map(r => Number(r.total_score) || 0);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + (v - avgScore) ** 2, 0) / scores.length;
  const consistency = Math.sqrt(variance);
  const totalPoints = mine.reduce((s, r) => s + (r.points_awarded || 0), 0);
  const ranks = mine.map(r => r.rank);
  const champs = computeChampionshipsByUser(d).get(userId) || 0;
  const finals = computeFinalsAppearancesByUser(d).get(userId) || 0;
  const regTitles = d.seasons.filter(s => s.regular_season_champion_user_id === userId).length;
  const thirds = d.seasons.filter(s => s.third_place_user_id === userId).length;

  return {
    userId,
    draftsPlayed: mine.length,
    wins,
    podiums,
    totalSeasonPoints: totalPoints,
    avgFinish: ranks.reduce((a, b) => a + b, 0) / ranks.length,
    avgScore,
    bestFinish: Math.min(...ranks),
    bestScore: Math.max(...scores),
    worstScore: Math.min(...scores),
    consistency,
    winRate: wins / mine.length,
    podiumRate: podiums / mine.length,
    championships: champs,
    finalsAppearances: finals,
    regularSeasonTitles: regTitles,
    thirdPlaceMedals: thirds,
  };
}

/* ───── Pick quality ───── */

export interface PickQuality {
  totalRated: number;
  avgPickScore: number;
  histogram: number[]; // length 10, buckets 0-0.99, 1-1.99, ..., 9-10
  bestPick: { text: string; score: number; draftTopic: string } | null;
  worstPick: { text: string; score: number; draftTopic: string } | null;
  earlyAvg: number; // first-half rounds
  lateAvg: number;  // second-half rounds
  stealRate: number; // late-round picks with score ≥ 7.5
  bustRate: number;  // picks ≤ 4
  topMvpPicks: number; // picks scoring ≥ 9
}

const normText = (t: string | null | undefined) =>
  (t || '').trim().toLowerCase().replace(/\s+/g, ' ');

export function computePickQuality(userId: string, d: StatsDataset): PickQuality {
  const myResults = d.results.filter(r => r.user_id === userId);
  const myPickIdMap = new Map<string, { round: number; draftId: string; pickText: string }>();
  // Secondary index keyed by `${draft_id}::${normalised pick_text}`. The AI
  // judge occasionally returns a pick_id it invented rather than the real
  // row id (~2% of ratings in production), which used to make those picks
  // vanish from Pick Quality even though they still counted in total_score.
  const myPickTextMap = new Map<string, { round: number; draftId: string; pickText: string }>();
  for (const p of d.picks) {
    if (p.user_id !== userId) continue;
    const meta = { round: p.round, draftId: p.draft_id, pickText: p.pick_text };
    myPickIdMap.set(p.id, meta);
    const key = `${p.draft_id}::${normText(p.pick_text)}`;
    if (!myPickTextMap.has(key)) myPickTextMap.set(key, meta);
  }

  const ratings: { score: number; round: number; text: string; draftId: string; totalRounds: number }[] = [];
  const draftRounds = new Map(d.drafts.map(x => [x.id, x.num_rounds]));
  for (const r of myResults) {
    for (const pr of r.pick_ratings || []) {
      const meta =
        myPickIdMap.get(pr.pick_id) ||
        myPickTextMap.get(`${r.draft_id}::${normText(pr.pick_text)}`);
      if (!meta) continue;
      ratings.push({
        score: Number(pr.score) || 0,
        round: meta.round,
        text: meta.pickText || pr.pick_text,
        draftId: meta.draftId,
        totalRounds: draftRounds.get(meta.draftId) || 5,
      });
    }
  }

  const histogram = new Array(10).fill(0);
  for (const r of ratings) {
    const idx = Math.max(0, Math.min(9, Math.floor(r.score)));
    histogram[idx]++;
  }
  const draftTopic = (id: string) => d.drafts.find(x => x.id === id)?.topic || 'Unknown';

  let best: PickQuality['bestPick'] = null;
  let worst: PickQuality['worstPick'] = null;
  for (const r of ratings) {
    if (!best || r.score > best.score) best = { text: r.text, score: r.score, draftTopic: draftTopic(r.draftId) };
    if (!worst || r.score < worst.score) worst = { text: r.text, score: r.score, draftTopic: draftTopic(r.draftId) };
  }

  const early = ratings.filter(r => r.round <= Math.ceil(r.totalRounds / 2));
  const late = ratings.filter(r => r.round > Math.ceil(r.totalRounds / 2));
  const avg = (arr: typeof ratings) => arr.length ? arr.reduce((s, r) => s + r.score, 0) / arr.length : 0;
  const stealCandidates = late;
  const stealHits = stealCandidates.filter(r => r.score >= 7.5).length;
  const busts = ratings.filter(r => r.score <= 4).length;

  return {
    totalRated: ratings.length,
    avgPickScore: avg(ratings),
    histogram,
    bestPick: best,
    worstPick: worst,
    earlyAvg: avg(early),
    lateAvg: avg(late),
    stealRate: stealCandidates.length ? stealHits / stealCandidates.length : 0,
    bustRate: ratings.length ? busts / ratings.length : 0,
    topMvpPicks: ratings.filter(r => r.score >= 9).length,
  };
}

/* ───── Timing ───── */

export interface TimingProfile {
  avgMs: number;
  fastestMs: number;
  slowestMs: number;
  totalMs: number;
  sampleCount: number;
}

/* Drafts run asynchronously over days, so the raw gap between two picks
 * is mostly "nobody was looking at the app", not deliberation. Counting
 * those gaps produced nonsense tempo numbers (22h "slowest pick",
 * 884h "on clock"). Only deltas inside an active session window count. */
const ACTIVE_PICK_WINDOW_MS = 30 * 60 * 1000;

export function computeTiming(userId: string, d: StatsDataset): TimingProfile {
  // Group picks per draft, sort by pick_number, compute delta vs previous pick (any user) for this user's picks
  const byDraft = new Map<string, StatsPick[]>();
  for (const p of d.picks) {
    const arr = byDraft.get(p.draft_id) || [];
    arr.push(p);
    byDraft.set(p.draft_id, arr);
  }
  const deltas: number[] = [];
  for (const [, arr] of byDraft) {
    const sorted = [...arr].sort((a, b) => a.pick_number - b.pick_number);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1], cur = sorted[i];
      if (cur.user_id !== userId) continue;
      if (!prev.picked_at || !cur.picked_at) continue;
      const dt = new Date(cur.picked_at).getTime() - new Date(prev.picked_at).getTime();
      if (dt > 500 && dt <= ACTIVE_PICK_WINDOW_MS) deltas.push(dt);
    }
  }
  if (deltas.length === 0) {
    return { avgMs: 0, fastestMs: 0, slowestMs: 0, totalMs: 0, sampleCount: 0 };
  }
  const total = deltas.reduce((a, b) => a + b, 0);
  return {
    avgMs: total / deltas.length,
    fastestMs: Math.min(...deltas),
    slowestMs: Math.max(...deltas),
    totalMs: total,
    sampleCount: deltas.length,
  };
}

export function fmtDuration(ms: number): string {
  if (!ms) return '—';
  if (ms < 1000) return '<1s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/* ───── Career pulse (avg score per draft over time, chronological) ───── */

export interface CareerPoint {
  draftId: string;
  topic: string;
  date: string;
  score: number;
  rank: number;
}

/** Completion date for a draft.
 *
 * Ordering career history by `drafts.created_at` was misleading: a draft
 * opened in January but scored in June sorted as a January data point.
 * The truthful timestamp is when the Draft Report landed — i.e. the
 * earliest `draft_results.created_at` for that draft. Falls back to the
 * last pick timestamp, then to the draft's creation date. */
export function buildCompletionDates(d: StatsDataset): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of d.results) {
    if (!r.created_at) continue;
    const cur = out.get(r.draft_id);
    if (!cur || r.created_at < cur) out.set(r.draft_id, r.created_at);
  }
  for (const p of d.picks) {
    if (out.has(p.draft_id) || !p.picked_at) continue;
    // track max pick time per draft
    const key = `__pick:${p.draft_id}`;
    const cur = out.get(key);
    if (!cur || p.picked_at > cur) out.set(key, p.picked_at);
  }
  for (const drf of d.drafts) {
    if (out.has(drf.id)) continue;
    out.set(drf.id, out.get(`__pick:${drf.id}`) || drf.created_at);
  }
  // strip helper keys
  for (const k of Array.from(out.keys())) if (k.startsWith('__pick:')) out.delete(k);
  return out;
}

export function computeCareerPulse(userId: string, d: StatsDataset): CareerPoint[] {
  const draftsById = new Map(d.drafts.map(x => [x.id, x]));
  const completed = buildCompletionDates(d);
  return d.results
    .filter(r => r.user_id === userId)
    .map(r => {
      const drf = draftsById.get(r.draft_id);
      return drf ? {
        draftId: r.draft_id,
        topic: drf.topic,
        date: r.created_at || completed.get(r.draft_id) || drf.created_at,
        score: Number(r.total_score) || 0,
        rank: r.rank,
      } : null;
    })
    .filter((x): x is CareerPoint => !!x)
    .sort((a, b) => a.date.localeCompare(b.date));
}


/* ───── Streaks (consecutive picks ≥ threshold within same draft) ───── */

export function computeLongestStreak(userId: string, d: StatsDataset, threshold = 7.5): number {
  const myResults = d.results.filter(r => r.user_id === userId);
  const picksByDraftUser = new Map<string, StatsPick[]>();
  for (const p of d.picks) {
    if (p.user_id !== userId) continue;
    const arr = picksByDraftUser.get(p.draft_id) || [];
    arr.push(p);
    picksByDraftUser.set(p.draft_id, arr);
  }
  let best = 0;
  for (const r of myResults) {
    const arr = (picksByDraftUser.get(r.draft_id) || []).sort((a, b) => a.pick_number - b.pick_number);
    const scoreById = new Map((r.pick_ratings || []).map(pr => [pr.pick_id, Number(pr.score) || 0]));
    const scoreByText = new Map((r.pick_ratings || []).map(pr => [normText(pr.pick_text), Number(pr.score) || 0]));
    let cur = 0;
    for (const p of arr) {
      const s = scoreById.get(p.id) ?? scoreByText.get(normText(p.pick_text));
      if (s !== undefined && s >= threshold) {
        cur++;
        if (cur > best) best = cur;
      } else {
        cur = 0;
      }
    }
  }
  return best;
}

/* ───── Topic tendencies ───── */

export interface TopicTendencies {
  totalDraftsPlayed: number;
  draftsCreated: number;
  byCategory: { category: string; count: number; avgScore: number }[];
  bestCategory: { category: string; avgScore: number } | null;
  worstCategory: { category: string; avgScore: number } | null;
}

export function computeTopicTendencies(userId: string, d: StatsDataset): TopicTendencies {
  const draftsById = new Map(d.drafts.map(x => [x.id, x]));
  const mine = d.results.filter(r => r.user_id === userId);
  const map = new Map<string, { count: number; scoreSum: number }>();
  for (const r of mine) {
    const drf = draftsById.get(r.draft_id);
    const cat = drf?.category || 'Other';
    const entry = map.get(cat) || { count: 0, scoreSum: 0 };
    entry.count++;
    entry.scoreSum += Number(r.total_score) || 0;
    map.set(cat, entry);
  }
  const byCategory = Array.from(map.entries())
    .map(([category, v]) => ({ category, count: v.count, avgScore: v.count ? v.scoreSum / v.count : 0 }))
    .sort((a, b) => b.count - a.count);
  const eligible = byCategory.filter(c => c.count >= 1);
  const bestCategory = eligible.length ? [...eligible].sort((a, b) => b.avgScore - a.avgScore)[0] : null;
  const worstCategory = eligible.length > 1 ? [...eligible].sort((a, b) => a.avgScore - b.avgScore)[0] : null;
  const draftsCreated = d.drafts.filter(x => x.created_by === userId).length;
  return {
    totalDraftsPlayed: mine.length,
    draftsCreated,
    byCategory: byCategory.slice(0, 5),
    bestCategory,
    worstCategory,
  };
}

/* ───── Leaderboards ───── */

export type LeaderMetric =
  | 'wins' | 'podiums' | 'draftsPlayed' | 'avgScore' | 'consistency'
  | 'mvpPicks' | 'highestSingleScore' | 'longestStreak' | 'fastestAvg' | 'championships';

export interface LeaderRow {
  userId: string;
  name: string;
  avatar: string | null;
  value: number;
  display: string;
}

export function computeLeaderboard(
  metric: LeaderMetric,
  d: StatsDataset,
  highlightUserId?: string,
): LeaderRow[] {
  // collect users with any results
  const userIds = new Set<string>();
  for (const r of d.results) userIds.add(r.user_id);

  const champByUser = computeChampionshipsByUser(d);

  const rows: LeaderRow[] = [];
  for (const uid of userIds) {
    const agg = computeUserAggregate(uid, d);
    if (!agg) continue;
    let value = 0;
    let display = '';
    switch (metric) {
      case 'wins': value = agg.wins; display = `${agg.wins}W`; break;
      case 'podiums': value = agg.podiums; display = `${agg.podiums}`; break;
      case 'draftsPlayed': value = agg.draftsPlayed; display = `${agg.draftsPlayed}`; break;
      case 'avgScore': value = agg.avgScore; display = agg.avgScore.toFixed(1); break;
      case 'consistency':
        // lower is better → invert by negating, then re-display
        value = agg.draftsPlayed >= 3 ? -agg.consistency : -9999;
        display = agg.draftsPlayed >= 3 ? `σ ${agg.consistency.toFixed(2)}` : '—';
        if (agg.draftsPlayed < 3) continue;
        break;
      case 'mvpPicks': {
        const pq = computePickQuality(uid, d);
        value = pq.topMvpPicks; display = `${pq.topMvpPicks}`;
        break;
      }
      case 'highestSingleScore': value = agg.bestScore; display = agg.bestScore.toFixed(1); break;
      case 'longestStreak': {
        const st = computeLongestStreak(uid, d);
        value = st; display = `${st}`;
        if (st === 0) continue;
        break;
      }
      case 'fastestAvg': {
        const t = computeTiming(uid, d);
        if (t.sampleCount < 5) continue;
        value = -t.avgMs;
        display = fmtDuration(t.avgMs);
        break;
      }
      case 'championships':
        value = champByUser.get(uid) || 0;
        display = `${value}`;
        if (value === 0) continue;
        break;
    }
    rows.push({
      userId: uid,
      name: displayName(uid, d),
      avatar: avatarUrl(uid, d),
      value,
      display,
    });
  }
  rows.sort((a, b) => b.value - a.value);
  return rows;
}

/* ───── Fun awards ───── */

export interface FunAward {
  key: string;
  icon: string;
  title: string;
  caption: string;
  winnerId: string | null;
  winnerName: string;
  value: string;
}

export function computeFunAwards(d: StatsDataset): FunAward[] {
  const awards: FunAward[] = [];

  const championships = computeLeaderboard('championships', d)[0];
  if (championships) awards.push({
    key: 'goat', icon: '🏆', title: 'G.O.A.T.', caption: 'Most championships',
    winnerId: championships.userId, winnerName: championships.name, value: `${championships.display} title${championships.value === 1 ? '' : 's'}`,
  });

  const streak = computeLeaderboard('longestStreak', d)[0];
  if (streak) awards.push({
    key: 'streak', icon: '🔥', title: 'Streak King', caption: 'Longest 7.5+ run',
    winnerId: streak.userId, winnerName: streak.name, value: `${streak.display} picks`,
  });

  // Sniper: highest single pick across history
  let snipe: { uid: string; score: number; text: string } | null = null;
  for (const r of d.results) {
    for (const pr of r.pick_ratings || []) {
      const s = Number(pr.score) || 0;
      if (!snipe || s > snipe.score) snipe = { uid: r.user_id, score: s, text: pr.pick_text };
    }
  }
  if (snipe) awards.push({
    key: 'sniper', icon: '🎯', title: 'The Sniper', caption: 'Highest single pick',
    winnerId: snipe.uid, winnerName: displayName(snipe.uid, d), value: `${snipe.score.toFixed(1)} · ${snipe.text}`,
  });

  // Fastest avg
  const fastest = computeLeaderboard('fastestAvg', d)[0];
  if (fastest) awards.push({
    key: 'fastest', icon: '⚡', title: 'Quickdraw', caption: 'Fastest avg pick',
    winnerId: fastest.userId, winnerName: fastest.name, value: fastest.display,
  });

  // Deliberator — slowest avg
  const allTiming = Array.from(new Set(d.results.map(r => r.user_id))).map(uid => ({
    uid, t: computeTiming(uid, d),
  })).filter(x => x.t.sampleCount >= 5);
  allTiming.sort((a, b) => b.t.avgMs - a.t.avgMs);
  const slow = allTiming[0];
  if (slow) awards.push({
    key: 'slow', icon: '🐢', title: 'The Deliberator', caption: 'Slowest avg pick',
    winnerId: slow.uid, winnerName: displayName(slow.uid, d), value: fmtDuration(slow.t.avgMs),
  });

  // The Closer — highest avg score in final round across drafts
  const closerMap = new Map<string, { sum: number; count: number }>();
  const draftsById = new Map(d.drafts.map(x => [x.id, x]));
  const lastPickById = new Map<string, StatsPick>();
  for (const p of d.picks) {
    const drf = draftsById.get(p.draft_id);
    if (!drf) continue;
    if (p.round === drf.num_rounds) lastPickById.set(p.id, p);
  }
  for (const r of d.results) {
    for (const pr of r.pick_ratings || []) {
      const p = lastPickById.get(pr.pick_id);
      if (!p) continue;
      const e = closerMap.get(p.user_id) || { sum: 0, count: 0 };
      e.sum += Number(pr.score) || 0;
      e.count++;
      closerMap.set(p.user_id, e);
    }
  }
  let closer: { uid: string; avg: number; count: number } | null = null;
  for (const [uid, e] of closerMap) {
    if (e.count < 2) continue;
    const avg = e.sum / e.count;
    if (!closer || avg > closer.avg) closer = { uid, avg, count: e.count };
  }
  if (closer) awards.push({
    key: 'closer', icon: '💎', title: 'The Closer', caption: 'Best final-round avg',
    winnerId: closer.uid, winnerName: displayName(closer.uid, d), value: `${closer.avg.toFixed(1)} avg`,
  });

  // Rock Steady — lowest consistency with ≥5 drafts
  const steadyCandidates = Array.from(new Set(d.results.map(r => r.user_id)))
    .map(uid => computeUserAggregate(uid, d)!)
    .filter(a => a.draftsPlayed >= 5)
    .sort((a, b) => a.consistency - b.consistency);
  if (steadyCandidates[0]) awards.push({
    key: 'steady', icon: '🪨', title: 'Rock Steady', caption: 'Most consistent scorer',
    winnerId: steadyCandidates[0].userId, winnerName: displayName(steadyCandidates[0].userId, d),
    value: `σ ${steadyCandidates[0].consistency.toFixed(2)}`,
  });

  // Most podiums
  const podiums = computeLeaderboard('podiums', d)[0];
  if (podiums && podiums.value > 0) awards.push({
    key: 'podiums', icon: '🥇', title: 'Podium Magnet', caption: 'Most top-3 finishes',
    winnerId: podiums.userId, winnerName: podiums.name, value: `${podiums.display} podium${podiums.value === 1 ? '' : 's'}`,
  });

  return awards;
}

/* ───── Identity nickname ───── */

export interface IdentityProfile {
  title: string;
  blurb: string;
  /** Rough prestige tier, used for colouring. */
  tier: 'legend' | 'elite' | 'notable' | 'base';
}

/** Rich draft identity. Ordered most-prestigious → most-generic; the first
 *  rule that matches wins, so hard-earned titles always outrank flavour. */
export function computeIdentityProfile(agg: UserAggregate, pq: PickQuality, t: TimingProfile): IdentityProfile {
  const L = (title: string, blurb: string): IdentityProfile => ({ title, blurb, tier: 'legend' });
  const E = (title: string, blurb: string): IdentityProfile => ({ title, blurb, tier: 'elite' });
  const N = (title: string, blurb: string): IdentityProfile => ({ title, blurb, tier: 'notable' });
  const B = (title: string, blurb: string): IdentityProfile => ({ title, blurb, tier: 'base' });

  if (agg.championships >= 3) return L('Dynasty', 'Three or more titles. The era belongs to you.');
  if (agg.championships === 2) return L('Two-Time', 'Back in the winner\'s circle — twice.');
  if (agg.championships === 1 && agg.regularSeasonTitles >= 1) return L('Wire-to-Wire', 'Regular season crown and the title in the same run.');
  if (agg.championships === 1) return L('Champion', 'You have a ring. Nobody can take it back.');
  if (agg.regularSeasonTitles >= 1) return E('Frontrunner', 'Regular season champion — dominance over the long haul.');
  if (agg.finalsAppearances >= 2) return E('Perennial', 'Multiple finals appearances. Always in the mix.');
  if (agg.draftsPlayed >= 6 && agg.winRate >= 0.5) return E('Apex Drafter', 'You win over half the drafts you enter.');
  if (agg.wins >= 4) return E('Closer', 'A serial winner when it matters.');
  if (pq.totalRated >= 20 && pq.avgPickScore >= 8) return E('Tastemaker', 'An 8+ average across a large body of picks.');
  if (pq.totalRated >= 15 && pq.topMvpPicks >= 6) return E('Marksman', 'You keep finding 9s and 10s.');
  if (pq.totalRated >= 12 && pq.stealRate >= 0.4) return N('Steal Artist', 'Late rounds are where you do damage.');
  if (pq.totalRated >= 12 && pq.earlyAvg - pq.lateAvg >= 1.5) return N('Front-Loader', 'You spend your best ammo early.');
  if (pq.totalRated >= 12 && pq.bustRate <= 0.05) return N('Clean Board', 'You almost never take a bust.');
  if (agg.draftsPlayed >= 5 && agg.consistency <= 4) return N('Steady Hand', 'Your scores barely move — reliability is the edge.');
  if (agg.draftsPlayed >= 5 && agg.consistency >= 12) return N('Wildcard', 'Boom or bust. Never boring.');
  if (t.sampleCount >= 10 && t.avgMs < 45_000) return N('Quickdraw', 'On the clock for seconds, not minutes.');
  if (t.sampleCount >= 10 && t.avgMs > 8 * 60_000) return N('The Deliberator', 'Every pick gets the full treatment.');
  if (agg.podiums >= 4) return N('Podium Regular', 'Top three shows up on your card a lot.');
  if (agg.podiums >= 2) return N('Contender', 'Knocking on the door.');
  if (agg.wins >= 1) return N('Winner', 'You have taken one down.');
  if (agg.draftsPlayed >= 10) return B('Iron Drafter', 'Never miss a draft night.');
  if (agg.draftsPlayed === 0) return B('Rookie', 'No scored drafts yet — your first report is coming.');
  if (agg.draftsPlayed <= 2) return B('Newcomer', 'Early days. Build the résumé.');
  return B('Drafter', 'Grinding out the reps.');
}

export function computeIdentity(agg: UserAggregate, pq: PickQuality, t: TimingProfile): string {
  return computeIdentityProfile(agg, pq, t).title;
}

/* ───── Achievements ─────
 *
 * Hard, specific objectives. Unlike the Hall of Fame (which is a
 * "who's best right now" comparison between members), achievements are
 * absolute — either you did the thing or you didn't — and most of them
 * are deliberately difficult. Everything is derived from data already in
 * the dataset; nothing is persisted, so scope filters apply naturally. */

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'mythic';

export const ACHIEVEMENT_TIER_ORDER: AchievementTier[] = ['bronze', 'silver', 'gold', 'platinum', 'mythic'];

export interface AchievementRung {
  tier: AchievementTier;
  /** Metric value required to earn this rung. */
  target: number;
  /** Rung-specific display name, e.g. "Steal Artist III". */
  label: string;
  earned: boolean;
}

export interface Achievement {
  key: string;
  icon: string;
  title: string;
  description: string;
  /** Raw (unclamped) metric value driving the ladder. */
  value: number;
  /** Ascending ladder, bronze → mythic. */
  rungs: AchievementRung[];
  /** Index of the highest earned rung, -1 when none. */
  earnedIndex: number;
  /** Highest earned tier, or the first rung's tier when nothing earned. */
  tier: AchievementTier;
  /** True once at least the bronze rung is earned. */
  unlocked: boolean;
  /** True when every rung is earned. */
  maxed: boolean;
  /** Progress within the *current* rung being chased. */
  progress: number;
  target: number;
  /** Optional formatter for value/target display (durations etc). */
  unit?: 'count' | 'minutes' | 'score';
  /** Optional human detail, e.g. the pick that earned it. */
  detail?: string;
}

/** Display helper — formats a metric value for the given unit. */
export function formatAchievementValue(n: number, unit: Achievement['unit']): string {
  if (unit === 'minutes') return fmtDuration(n * 60_000);
  if (unit === 'score') return n.toFixed(1);
  return String(Math.round(n));
}


export function computeAchievements(userId: string, d: StatsDataset): Achievement[] {
  const agg = computeUserAggregate(userId, d);
  const pq = computePickQuality(userId, d);
  const timing = computeTiming(userId, d);
  const out: Achievement[] = [];
  if (!agg) return out;

  const completed = buildCompletionDates(d);
  const draftsById = new Map(d.drafts.map(x => [x.id, x]));
  const myResults = d.results
    .filter(r => r.user_id === userId)
    .sort((a, b) => (completed.get(a.draft_id) || '').localeCompare(completed.get(b.draft_id) || ''));

  /* Per-draft rated picks for this user, keyed by draft. */
  const ratedByDraft = new Map<string, number[]>();
  const myPickMeta = new Map<string, { round: number; draftId: string; text: string }>();
  const myPickByText = new Map<string, { round: number; draftId: string; text: string }>();
  for (const p of d.picks) {
    if (p.user_id !== userId) continue;
    const meta = { round: p.round, draftId: p.draft_id, text: p.pick_text };
    myPickMeta.set(p.id, meta);
    const k = `${p.draft_id}::${normText(p.pick_text)}`;
    if (!myPickByText.has(k)) myPickByText.set(k, meta);
  }
  let bestSingle = 0;
  let bestSingleText = '';
  let lateBombs = 0;   // late-round picks ≥ 8
  let perfectTens = 0;
  for (const r of myResults) {
    const arr: number[] = [];
    for (const pr of r.pick_ratings || []) {
      const meta = myPickMeta.get(pr.pick_id) || myPickByText.get(`${r.draft_id}::${normText(pr.pick_text)}`);
      if (!meta) continue;
      const s = Number(pr.score) || 0;
      arr.push(s);
      if (s > bestSingle) { bestSingle = s; bestSingleText = meta.text || pr.pick_text; }
      if (s >= 10) perfectTens++;
      const rounds = draftsById.get(r.draft_id)?.num_rounds || 5;
      if (meta.round > Math.ceil(rounds / 2) && s >= 8) lateBombs++;
    }
    ratedByDraft.set(r.draft_id, arr);
  }

  /* Perfect boards: every rated pick in a draft ≥ 8 (min 4 picks). */
  let perfectBoards = 0;
  let cleanBoards = 0; // no pick ≤ 4, min 4 picks
  for (const [, arr] of ratedByDraft) {
    if (arr.length < 4) continue;
    if (arr.every(s => s >= 8)) perfectBoards++;
    if (arr.every(s => s > 4)) cleanBoards++;
  }

  /* Consecutive-win / podium streaks by completion order. */
  let winStreak = 0, bestWinStreak = 0, podStreak = 0, bestPodStreak = 0;
  for (const r of myResults) {
    if (r.rank === 1) { winStreak++; bestWinStreak = Math.max(bestWinStreak, winStreak); } else winStreak = 0;
    if (r.rank <= 3) { podStreak++; bestPodStreak = Math.max(bestPodStreak, podStreak); } else podStreak = 0;
  }

  /* Wire-to-wire blowout: won a draft by ≥ 10 total score over 2nd. */
  let biggestMargin = 0;
  for (const r of myResults) {
    if (r.rank !== 1) continue;
    const others = d.results
      .filter(x => x.draft_id === r.draft_id && x.user_id !== userId)
      .map(x => Number(x.total_score) || 0);
    if (!others.length) continue;
    const margin = (Number(r.total_score) || 0) - Math.max(...others);
    if (margin > biggestMargin) biggestMargin = margin;
  }

  /* Category range: distinct categories won. */
  const wonCategories = new Set<string>();
  for (const r of myResults) {
    if (r.rank !== 1) continue;
    const cat = draftsById.get(r.draft_id)?.category;
    if (cat) wonCategories.add(cat.toLowerCase());
  }

  /* Giant killer: beat the #1 playoff seed in a playoff match. */
  let giantKills = 0;
  for (const m of d.matches) {
    if (m.winner_user_id !== userId) continue;
    const opp = m.user_a === userId ? m.user_b : m.user_a;
    if (!opp) continue;
    const seed = d.standings.find(s => s.season_id === m.season_id && s.user_id === opp)?.playoff_seed;
    if (seed === 1) giantKills++;
  }

  /* Ladder builder.
   *
   * Every achievement is now cumulative: a single metric drives a
   * bronze → silver → gold → platinum → mythic ladder. Ladders with
   * fewer than five sensible steps simply declare fewer rungs — the
   * top rung is always the hardest tier that ladder supports. */
  const A = (
    key: string, icon: string, title: string, description: string,
    value: number,
    steps: Array<[AchievementTier, number, string]>,
    opts?: { unit?: Achievement['unit']; detail?: string },
  ) => {
    const rungs: AchievementRung[] = steps.map(([tier, target, label]) => ({
      tier, target, label, earned: value >= target,
    }));
    let earnedIndex = -1;
    rungs.forEach((r, i) => { if (r.earned) earnedIndex = i; });
    const maxed = earnedIndex === rungs.length - 1;
    const chasing = maxed ? rungs[rungs.length - 1] : rungs[earnedIndex + 1];
    const floor = earnedIndex >= 0 ? rungs[earnedIndex].target : 0;
    out.push({
      key, icon, title, description,
      value,
      rungs,
      earnedIndex,
      tier: earnedIndex >= 0 ? rungs[earnedIndex].tier : rungs[0].tier,
      unlocked: earnedIndex >= 0,
      maxed,
      progress: maxed ? chasing.target : Math.max(0, Math.min(value, chasing.target) - floor),
      target: maxed ? chasing.target : chasing.target - floor,
      unit: opts?.unit,
      detail: opts?.detail,
    });
  };

  const longestStreak = computeLongestStreak(userId, d);
  const timedMinutes = Math.floor(timing.totalMs / 60000);

  A('first_blood', '🎬', 'Trophy Hunter', 'Win drafts outright', agg.wins, [
    ['bronze', 1, 'First Blood'],
    ['silver', 3, 'Contender'],
    ['gold', 6, 'Front-Runner'],
    ['platinum', 12, 'Serial Winner'],
    ['mythic', 20, 'Dominator'],
  ]);
  A('iron', '🛡️', 'Iron Drafter', 'Play scored drafts', agg.draftsPlayed, [
    ['bronze', 5, 'Regular'],
    ['silver', 15, 'Veteran'],
    ['gold', 25, 'Iron Drafter'],
    ['platinum', 50, 'Ironclad'],
    ['mythic', 100, 'Eternal'],
  ]);
  A('scholar', '📚', 'Well Read', 'Accumulate rated picks', pq.totalRated, [
    ['bronze', 25, 'Student'],
    ['silver', 60, 'Scholar'],
    ['gold', 100, 'Curator'],
    ['platinum', 250, 'Archivist'],
    ['mythic', 500, 'Loremaster'],
  ]);
  A('century', '💯', 'Point Bank', 'Bank lifetime season points', Math.floor(agg.totalSeasonPoints), [
    ['bronze', 25, 'Scorer'],
    ['silver', 50, 'Half Century'],
    ['gold', 100, 'Century Club'],
    ['platinum', 250, 'Double Century'],
    ['mythic', 500, 'Point God'],
  ]);
  A('hot_hand', '🔥', 'Hot Hand', 'Longest run of picks rated 7.5+', longestStreak, [
    ['bronze', 3, 'Warm'],
    ['silver', 6, 'Heating Up'],
    ['gold', 10, 'Hot Hand'],
    ['platinum', 15, 'On Fire'],
    ['mythic', 20, 'Unconscious'],
  ]);
  A('steal_artist', '🕵️', 'Steal Artist', 'Late-round picks rated 8.0+', lateBombs, [
    ['bronze', 3, 'Bargain Hunter'],
    ['silver', 8, 'Value Merchant'],
    ['gold', 15, 'Steal Artist'],
    ['platinum', 30, 'Grand Larcenist'],
    ['mythic', 50, 'Ghost of the Board'],
  ]);
  A('podium_run', '🥇', 'Podium Run', 'Longest streak of top-three finishes', bestPodStreak, [
    ['bronze', 2, 'Consistent'],
    ['silver', 3, 'Reliable'],
    ['gold', 5, 'Podium Run'],
    ['platinum', 8, 'Fixture'],
    ['mythic', 12, 'Immovable'],
  ]);
  A('clean_sheets', '🧼', 'No Busts', 'Drafts finished with no pick rated 4.0 or lower', cleanBoards, [
    ['bronze', 1, 'Tidy'],
    ['silver', 3, 'Disciplined'],
    ['gold', 5, 'No Busts'],
    ['platinum', 10, 'Spotless'],
    ['mythic', 20, 'Flawless Record'],
  ]);
  A('perfect_board', '🧊', 'Perfect Board', 'Drafts where every pick rated 8.0+', perfectBoards, [
    ['silver', 1, 'Perfect Board'],
    ['gold', 2, 'Twice Perfect'],
    ['platinum', 4, 'Machine'],
    ['mythic', 7, 'Untouchable'],
  ]);
  A('immaculate', '💠', 'Immaculate', 'Picks rated a perfect 10.0', perfectTens, [
    ['gold', 1, 'Immaculate'],
    ['platinum', 3, 'Immaculate III'],
    ['mythic', 6, 'Perfectionist'],
  ], {
    detail: bestSingle >= 10 ? bestSingleText : bestSingle > 0 ? `Best so far: ${bestSingle.toFixed(1)}` : undefined,
  });
  A('streak_king', '👑', 'Win Streak', 'Consecutive draft wins', bestWinStreak, [
    ['silver', 2, 'Back-to-Back'],
    ['gold', 3, 'Three-Peat'],
    ['platinum', 4, 'Four-Peat'],
    ['mythic', 5, 'Untouchable Run'],
  ]);
  A('dynasty', '🏛️', 'Dynasty', 'League championships won', agg.championships, [
    ['gold', 1, 'Champion'],
    ['platinum', 2, 'Dynasty'],
    ['mythic', 3, 'Immortal'],
  ]);
  A('blowout', '💥', 'Statement Win', 'Biggest winning margin in total score', Math.floor(biggestMargin), [
    ['bronze', 3, 'Clear Win'],
    ['silver', 6, 'Comfortable'],
    ['gold', 10, 'Statement Win'],
    ['platinum', 15, 'Blowout'],
    ['mythic', 20, 'Annihilation'],
  ], {
    unit: 'score',
    detail: biggestMargin > 0 ? `Best margin: +${biggestMargin.toFixed(1)}` : undefined,
  });
  A('renaissance', '🎭', 'Renaissance', 'Distinct categories won', wonCategories.size, [
    ['bronze', 2, 'Dabbler'],
    ['silver', 3, 'Well Rounded'],
    ['gold', 5, 'Renaissance'],
    ['platinum', 8, 'Polymath'],
    ['mythic', 12, 'Omniscient'],
  ]);
  A('giant_killer', '🗡️', 'Giant Killer', 'Postseason wins over the #1 seed', giantKills, [
    ['gold', 1, 'Giant Killer'],
    ['platinum', 2, 'Kingslayer'],
    ['mythic', 3, 'Nemesis'],
  ]);
  A('marathon', '🕰️', 'The Long Game', 'Cumulative time on the clock', timedMinutes, [
    ['bronze', 30, 'Deliberate'],
    ['silver', 90, 'Patient'],
    ['gold', 180, 'The Long Game'],
    ['platinum', 420, 'Marathoner'],
    ['mythic', 900, 'Time Lord'],
  ], { unit: 'minutes', detail: timing.totalMs ? fmtDuration(timing.totalMs) : undefined });
  A('quickdraw', '⚡', 'Quickdraw', 'Timed picks made averaging under 45s',
    timing.sampleCount >= 20 && timing.avgMs < 45_000 ? timing.sampleCount : 0, [
      ['bronze', 20, 'Quickdraw'],
      ['silver', 50, 'Snap Judgement'],
      ['gold', 100, 'Gunslinger'],
      ['platinum', 200, 'Lightning'],
    ], {
      detail: timing.sampleCount >= 20 ? `Avg ${fmtDuration(timing.avgMs)}` : `${timing.sampleCount}/20 timed picks`,
    });

  const tierRank: Record<AchievementTier, number> = { mythic: 0, platinum: 1, gold: 2, silver: 3, bronze: 4 };
  return out.sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    if (a.unlocked) {
      if (a.maxed !== b.maxed) return a.maxed ? -1 : 1;
      const t = tierRank[a.tier] - tierRank[b.tier];
      if (t !== 0) return t;
      return b.earnedIndex - a.earnedIndex;
    }
    const ap = a.progress / a.target, bp = b.progress / b.target;
    if (ap !== bp) return bp - ap;
    return tierRank[a.tier] - tierRank[b.tier];
  });
}



/* ───── Scope filtering ─────
 *
 * Three flavours of scope:
 *   - 'all'    → entire dataset, seasoned + misc together
 *   - 'misc'   → ONLY drafts that aren't tied to any season (no row in
 *                season_draft_entries). These were always invisible as
 *                their own bucket before — `filterDatasetByScope` had
 *                no way to surface them, so the Stats Hub couldn't
 *                show users a misc-only breakdown.
 *   - seasonId → ONLY drafts that have a season_draft_entries row
 *                matching that season. Misc drafts have no such row
 *                so they're naturally excluded — this was already the
 *                case before, kept the same.
 */

export type ScopeKey = 'all' | 'misc' | string; // 'all' | 'misc' | seasonId

export function filterDatasetByScope(d: StatsDataset, scope: ScopeKey): StatsDataset {
  if (scope === 'all') return d;

  if (scope === 'misc') {
    // Misc = drafts that have NO row in seasonEntries. We don't ship
    // any seasons / matches / standings / seasonEntries through to the
    // downstream computations since none of those apply to misc.
    const seasonedDraftIds = new Set(d.seasonEntries.map(e => e.draft_id));
    const drafts = d.drafts.filter(x => !seasonedDraftIds.has(x.id));
    const draftIds = new Set(drafts.map(x => x.id));
    const results = d.results.filter(r => draftIds.has(r.draft_id));
    const picks = d.picks.filter(p => draftIds.has(p.draft_id));
    return { ...d, drafts, results, picks, matches: [], standings: [], seasons: [], seasonEntries: [] };
  }

  // Season scope (seasonId).
  const draftIds = new Set(d.seasonEntries.filter(e => e.season_id === scope).map(e => e.draft_id));
  const drafts = d.drafts.filter(x => draftIds.has(x.id));
  const results = d.results.filter(r => draftIds.has(r.draft_id));
  const picks = d.picks.filter(p => draftIds.has(p.draft_id));
  const matches = d.matches.filter(m => m.season_id === scope);
  const standings = d.standings.filter(s => s.season_id === scope);
  const seasons = d.seasons.filter(s => s.id === scope);
  const seasonEntries = d.seasonEntries.filter(e => e.season_id === scope);
  return { ...d, drafts, results, picks, matches, standings, seasons, seasonEntries };
}

/** Composition breakdown for the Stats Hub scope bar — splits the
 *  user's drafts into seasoned vs misc so the hub can show the split
 *  inline. Counts drafts the user actually participated in (i.e. has
 *  a result row for). */
export function countDraftComposition(d: StatsDataset, userId: string | undefined): { seasoned: number; misc: number; total: number } {
  if (!userId) return { seasoned: 0, misc: 0, total: 0 };
  const myDraftIds = new Set(d.results.filter(r => r.user_id === userId).map(r => r.draft_id));
  if (myDraftIds.size === 0) return { seasoned: 0, misc: 0, total: 0 };
  const seasonedSet = new Set(d.seasonEntries.map(e => e.draft_id));
  let seasoned = 0;
  let misc = 0;
  myDraftIds.forEach(id => { seasonedSet.has(id) ? seasoned++ : misc++; });
  return { seasoned, misc, total: seasoned + misc };
}
