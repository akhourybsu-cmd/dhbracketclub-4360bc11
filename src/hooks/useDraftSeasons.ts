// Draft seasons hooks – commissioner controls, standings, entries, playoffs
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DraftSeason {
  id: string;
  name: string;
  year: number | null;
  season_label: string | null;
  season_number: number | null;
  subtitle: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  regular_season_weeks: number;
  regular_season_drafts: number;
  playoff_weeks: number;
  best_of: number;
  commissioner_user_id: string | null;
  champion_user_id?: string | null;
  runner_up_user_id?: string | null;
  third_place_user_id?: string | null;
  regular_season_champion_user_id?: string | null;
  archived_at?: string | null;
  summary?: {
    finalized_at?: string;
    series_score?: Record<string, number>;
    finals?: Array<{ game: number; winner: string; draft_id: string | null }>;
    third_place_match_id?: string | null;
  } | null;
}

/**
 * Display helper: "Season {N}" when season_number is set, else fall back to the
 * stored name (preserves legacy custom-named seasons).
 */
export function formatSeasonTitle(s: Pick<DraftSeason, 'season_number' | 'name'> | null | undefined): string {
  if (!s) return '';
  if (typeof s.season_number === 'number' && s.season_number > 0) return `Season ${s.season_number}`;
  return s.name || '';
}

/** Short chip label, e.g. "S4". Falls back to legacy formatting. */
export function formatSeasonChip(
  s: Pick<DraftSeason, 'season_number' | 'season_label' | 'year'> | null | undefined,
): string | null {
  if (!s) return null;
  if (typeof s.season_number === 'number' && s.season_number > 0) return `S${s.season_number}`;
  if (s.season_label) return s.season_label;
  if (s.year) return `'${String(s.year).slice(-2)}`;
  return null;
}

export interface SeasonStanding {
  id: string;
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
  is_eliminated: boolean;
  profiles?: { display_name: string; avatar_url: string | null };
}

export interface SeasonEntry {
  id: string;
  season_id: string;
  draft_id: string;
  week_number: number; // DB column name — represents sequential draft number
  is_playoff: boolean;
  season_points_awarded: Record<string, number>;
  drafts?: { topic: string; status: string };
}

export interface PlayoffMatch {
  id: string;
  season_id: string;
  round: string;
  match_number: number;
  seed_a: number;
  seed_b: number;
  user_a: string | null;
  user_b: string | null;
  draft_id: string | null;
  winner_user_id: string | null;
  status: string;
  topic_picker_user_id: string | null;
}

// Season points by placement
const SEASON_POINTS: Record<number, number> = {
  1: 10,
  2: 7,
  3: 5,
  4: 3,
  5: 2,
};
const PARTICIPATION_POINTS = 1;

export function getSeasonPointsForRank(rank: number): number {
  return SEASON_POINTS[rank] || PARTICIPATION_POINTS;
}

/** Get the total number of regular-season drafts for a season (draft-count model) */
export function getSeasonDraftTarget(season: DraftSeason): number {
  return season.regular_season_drafts || season.regular_season_weeks || 12;
}

export function useCurrentSeason() {
  const [season, setSeason] = useState<DraftSeason | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    // Get active season (regular_season or playoffs), or most recent upcoming
    const { data } = await supabase
      .from('draft_seasons' as any)
      .select('*')
      .in('status', ['regular_season', 'playoffs'])
      .order('starts_at', { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      setSeason(data[0] as unknown as DraftSeason);
    } else {
      // fallback: most recent season
      const { data: fallback } = await supabase
        .from('draft_seasons' as any)
        .select('*')
        .order('starts_at', { ascending: false })
        .limit(1);
      setSeason(fallback && fallback.length > 0 ? (fallback[0] as unknown as DraftSeason) : null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { season, loading, refetch };
}

export function useSeasonStandings(seasonId: string | undefined) {
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!seasonId) { setLoading(false); return; }
    const { data } = await supabase
      .from('draft_season_standings' as any)
      .select('*, profiles:user_id(display_name, avatar_url)')
      .eq('season_id', seasonId)
      .order('season_points', { ascending: false });
    setStandings((data || []) as unknown as SeasonStanding[]);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { standings, loading, refetch: fetch };
}

export function useSeasonEntries(seasonId: string | undefined) {
  const [entries, setEntries] = useState<SeasonEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!seasonId) { setLoading(false); return; }
    const { data } = await supabase
      .from('draft_season_entries' as any)
      .select('*, drafts:draft_id(topic, status)')
      .eq('season_id', seasonId)
      .order('week_number');
    setEntries((data || []) as unknown as SeasonEntry[]);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { entries, loading, refetch: fetch };
}

export function usePlayoffMatches(seasonId: string | undefined) {
  const [matches, setMatches] = useState<PlayoffMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!seasonId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('draft_playoff_matches' as any)
        .select('*')
        .eq('season_id', seasonId)
        .order('round')
        .order('match_number');
      setMatches((data || []) as unknown as PlayoffMatch[]);
      setLoading(false);
    })();
  }, [seasonId]);

  return { matches, loading };
}

export function useAllSeasons() {
  const [seasons, setSeasons] = useState<DraftSeason[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('draft_seasons' as any)
        .select('*')
        .order('season_number', { ascending: false, nullsFirst: false })
        .order('starts_at', { ascending: false });
      setSeasons((data || []) as unknown as DraftSeason[]);
      setLoading(false);
    })();
  }, []);

  return { seasons, loading };
}

export function useLifetimeStats(userId: string | undefined) {
  const [stats, setStats] = useState<{
    totalSeasons: number;
    totalWins: number;
    totalPodiums: number;
    totalPlayoffs: number;
    totalChampionships: number;
    avgSeasonFinish: number;
    bestSeasonPoints: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      const { data: allStandings } = await supabase
        .from('draft_season_standings' as any)
        .select('*')
        .eq('user_id', userId);

      const { data: playoffWins } = await supabase
        .from('draft_playoff_matches' as any)
        .select('*')
        .eq('winner_user_id', userId)
        .eq('round', 'final');

      const rows = (allStandings || []) as unknown as SeasonStanding[];
      // Championships = best-of-3 series clinches, NOT individual game wins.
      // A user must win ≥2 final games in the same season to claim the title.
      const finalGameWins = ((playoffWins || []) as unknown as PlayoffMatch[]);
      const winsBySeason = new Map<string, number>();
      for (const w of finalGameWins) {
        winsBySeason.set(w.season_id, (winsBySeason.get(w.season_id) || 0) + 1);
      }
      const championships = Array.from(winsBySeason.values()).filter(n => n >= 2).length;

      if (rows.length === 0) {
        setStats(null);
      } else {
        const ranks = rows.filter(r => r.rank).map(r => r.rank!);
        setStats({
          totalSeasons: rows.length,
          totalWins: rows.reduce((s, r) => s + r.wins, 0),
          totalPodiums: rows.reduce((s, r) => s + r.podiums, 0),
          totalPlayoffs: rows.filter(r => r.playoff_seed !== null).length,
          totalChampionships: championships,
          avgSeasonFinish: ranks.length > 0 ? ranks.reduce((a, b) => a + b, 0) / ranks.length : 0,
          bestSeasonPoints: Math.max(...rows.map(r => r.season_points), 0),
        });
      }
      setLoading(false);
    })();
  }, [userId]);

  return { stats, loading };
}

/** Recalculate season standings from draft_results for a given season */
export async function recalculateSeasonStandings(seasonId: string) {
  // 1. Get all season entries with their draft results
  const { data: entries } = await supabase
    .from('draft_season_entries' as any)
    .select('draft_id, week_number, is_playoff')
    .eq('season_id', seasonId)
    .eq('is_playoff', false);

  if (!entries || entries.length === 0) {
    // No drafts in season — wipe all standings for this season
    await supabase
      .from('draft_season_standings' as any)
      .delete()
      .eq('season_id', seasonId);
    return;
  }

  const draftIds = (entries as any[]).map(e => e.draft_id);
  const { data: results } = await supabase
    .from('draft_results' as any)
    .select('draft_id, user_id, rank, total_score, points_awarded')
    .in('draft_id', draftIds);

  if (!results || (results as any[]).length === 0) {
    await supabase
      .from('draft_season_standings' as any)
      .delete()
      .eq('season_id', seasonId);
    return;
  }

  // Get season config
  const { data: seasonData } = await supabase
    .from('draft_seasons' as any)
    .select('best_of, regular_season_drafts, regular_season_weeks')
    .eq('id', seasonId)
    .single();

  const bestOf = (seasonData as any)?.best_of || 10;

  // Group results by user
  const userResults = new Map<string, Array<{ rank: number; total_score: number; draft_id: string }>>();
  for (const r of results as any[]) {
    const arr = userResults.get(r.user_id) || [];
    arr.push({ rank: r.rank, total_score: Number(r.total_score), draft_id: r.draft_id });
    userResults.set(r.user_id, arr);
  }

  // Calculate standings per user
  const standingsUpdates: Array<{
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
  }> = [];

  for (const [userId, drafts] of userResults) {
    const withPoints = drafts.map(d => ({
      ...d,
      seasonPts: getSeasonPointsForRank(d.rank),
    }));
    withPoints.sort((a, b) => b.seasonPts - a.seasonPts);

    const counted = withPoints.slice(0, bestOf);
    const seasonPoints = counted.reduce((s, d) => s + d.seasonPts, 0);
    const wins = drafts.filter(d => d.rank === 1).length;
    const podiums = drafts.filter(d => d.rank <= 3).length;
    const avgFinish = drafts.reduce((s, d) => s + d.rank, 0) / drafts.length;
    const scores = drafts.map(d => d.total_score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const bestScore = Math.max(...scores);
    const worstScore = Math.min(...scores);
    const mean = avgScore;
    const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
    const consistency = Math.sqrt(variance);

    standingsUpdates.push({
      season_id: seasonId,
      user_id: userId,
      season_points: seasonPoints,
      drafts_played: drafts.length,
      wins,
      podiums,
      avg_finish: Math.round(avgFinish * 100) / 100,
      avg_score: Math.round(avgScore * 100) / 100,
      best_score: Math.round(bestScore * 100) / 100,
      worst_score: Math.round(worstScore * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
    });
  }

  // Sort by season points with multi-factor tiebreaker, then assign ranks
  standingsUpdates.sort((a, b) => {
    if (b.season_points !== a.season_points) return b.season_points - a.season_points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.podiums !== a.podiums) return b.podiums - a.podiums;
    if (a.avg_finish !== b.avg_finish) return a.avg_finish - b.avg_finish; // lower is better
    return b.avg_score - a.avg_score;
  });
  let rank = 1;
  for (let i = 0; i < standingsUpdates.length; i++) {
    if (i > 0 && standingsUpdates[i].season_points < standingsUpdates[i - 1].season_points) {
      rank = i + 1;
    }
    (standingsUpdates[i] as any).rank = rank;
    (standingsUpdates[i] as any).playoff_seed = i + 1;
  }

  // Clear old standings then insert fresh — ensures removed-draft users don't linger
  await supabase
    .from('draft_season_standings' as any)
    .delete()
    .eq('season_id', seasonId);

  for (const s of standingsUpdates) {
    await supabase
      .from('draft_season_standings' as any)
      .insert(s as any);
  }

  // Update season_points_awarded on entries
  for (const entry of entries as any[]) {
    const entryResults = (results as any[]).filter(r => r.draft_id === (entry as any).draft_id);
    const pointsMap: Record<string, number> = {};
    for (const r of entryResults) {
      pointsMap[r.user_id] = getSeasonPointsForRank(r.rank);
    }
    await supabase
      .from('draft_season_entries' as any)
      .update({ season_points_awarded: pointsMap })
      .eq('draft_id', (entry as any).draft_id);
  }
}

/** Create a new season (draft-count based). Auto-assigns the next per-club season_number. */
export async function createSeason(params: {
  startsAt: string;
  endsAt: string;
  subtitle?: string | null;
  regularSeasonDrafts?: number;
  bestOf?: number;
}) {
  // Resolve current user's club to compute next season_number per club.
  const { data: clubRow } = await supabase.rpc('current_user_club_id' as any);
  const clubId = (clubRow as unknown as string) || null;

  let nextNumber = 1;
  if (clubId) {
    const { data: maxRow } = await supabase
      .from('draft_seasons' as any)
      .select('season_number')
      .eq('club_id', clubId)
      .order('season_number', { ascending: false, nullsFirst: false })
      .limit(1);
    const cur = (maxRow && (maxRow as any[])[0]?.season_number) as number | null | undefined;
    nextNumber = (cur || 0) + 1;
  }

  const cleanSubtitle = (params.subtitle || '').trim() || null;

  const { data, error } = await supabase
    .from('draft_seasons' as any)
    .insert({
      name: `Season ${nextNumber}`,
      season_number: nextNumber,
      subtitle: cleanSubtitle,
      starts_at: params.startsAt,
      ends_at: params.endsAt,
      regular_season_drafts: params.regularSeasonDrafts || 12,
      regular_season_weeks: params.regularSeasonDrafts || 12, // keep in sync for compat
      best_of: params.bestOf || 10,
      status: 'regular_season',
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Set the commissioner on a season (admin / commissioner-only via RLS). */
export async function setSeasonCommissioner(seasonId: string, userId: string) {
  const { error } = await supabase
    .from('draft_seasons' as any)
    .update({ commissioner_user_id: userId } as any)
    .eq('id', seasonId);
  if (error) throw error;
}

/** Assign a draft to the current season (draft_number = sequential position) */
export async function assignDraftToSeason(seasonId: string, draftId: string, draftNumber: number, isPlayoff = false) {
  const { error } = await supabase
    .from('draft_season_entries' as any)
    .upsert({
      season_id: seasonId,
      draft_id: draftId,
      week_number: draftNumber,
      is_playoff: isPlayoff,
    } as any, { onConflict: 'draft_id' });

  if (error) throw error;
}

/** Check if the current user is the commissioner for the active season */
export function useIsCommissioner(season: DraftSeason | null) {
  const { user } = useAuth();
  return !!(season && user && season.commissioner_user_id === user.id);
}

/** Fetch all drafts NOT assigned to any season (candidates for commissioner to add) */
export function useUnassignedDrafts(seasonId: string | undefined) {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!seasonId) { setLoading(false); return; }

    // Get every draft_id that's been assigned to ANY season (regular or playoff).
    // A draft can only ever belong to one season — once it's claimed, it's
    // permanently off the candidate list for every other season.
    const { data: entries } = await supabase
      .from('draft_season_entries' as any)
      .select('draft_id');

    const assignedIds = new Set((entries || []).map((e: any) => e.draft_id));

    // Get all drafts
    const { data: allDrafts } = await supabase
      .from('drafts')
      .select('id, topic, status, created_at, category, num_rounds, profiles:created_by(display_name)')
      .order('created_at', { ascending: false });

    const unassigned = (allDrafts || []).filter(d => !assignedIds.has(d.id));
    setDrafts(unassigned);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { drafts, loading, refetch: fetch };
}

/** Commissioner: add a draft to the season with auto-numbered position */
export async function addDraftToSeason(seasonId: string, draftId: string) {
  // Get current max week_number for this season
  const { data: existing } = await supabase
    .from('draft_season_entries' as any)
    .select('week_number')
    .eq('season_id', seasonId)
    .eq('is_playoff', false)
    .order('week_number', { ascending: false })
    .limit(1);

  const nextNumber = existing && existing.length > 0 ? (existing[0] as any).week_number + 1 : 1;

  const { error } = await supabase
    .from('draft_season_entries' as any)
    .insert({
      season_id: seasonId,
      draft_id: draftId,
      week_number: nextNumber,
      is_playoff: false,
    } as any);

  if (error) throw error;
  return nextNumber;
}

/** Commissioner: remove a draft from the season and renumber remaining entries */
export async function removeDraftFromSeason(draftId: string) {
  // Get the season_id before deleting so we can renumber
  const { data: entry } = await supabase
    .from('draft_season_entries' as any)
    .select('season_id')
    .eq('draft_id', draftId)
    .single();

  const { error } = await supabase
    .from('draft_season_entries' as any)
    .delete()
    .eq('draft_id', draftId);

  if (error) throw error;

  // Renumber remaining regular-season entries sequentially
  if (entry) {
    await renumberSeasonEntries((entry as any).season_id);
  }
}

/** Trigger playoff advancement (transition + winner scoring + next-round generation) */
export async function advancePlayoffs(seasonId: string) {
  const { data, error } = await supabase.functions.invoke('advance-playoffs', {
    body: { seasonId },
  });
  if (error) throw error;
  return data;
}

/** Fetch 3 AI-generated topic options for a playoff matchup. */
export async function suggestPlayoffTopics(seasonId: string, matchId: string): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke('suggest-playoff-topics', {
    body: { seasonId, matchId },
  });
  if (data && (data as any).error === 'Rate limit reached') {
    throw new Error("You've hit the AI helper limit for now. Try again in a bit.");
  }
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return ((data as any)?.topics || []) as string[];
}

/** Higher seed locks in a topic → creates the draft + participants and links to the match. */
export async function startPlayoffMatch(matchId: string, topic: string) {
  const { data, error } = await supabase.functions.invoke('start-playoff-match', {
    body: { matchId, topic },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { ok: boolean; draft_id: string };
}

/** Bulk lookup: playoff match metadata for a set of draft IDs. Used to render
 *  tournament chrome on draft list/dashboard rows in a single query. */
export function usePlayoffMatchByDraftIds(draftIds: string[]) {
  const [matchByDraft, setMatchByDraft] = useState<Map<string, PlayoffMatch>>(new Map());
  const key = draftIds.slice().sort().join(',');

  useEffect(() => {
    if (!draftIds.length) { setMatchByDraft(new Map()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('draft_playoff_matches' as any)
        .select('*')
        .in('draft_id', draftIds);
      if (cancelled) return;
      const map = new Map<string, PlayoffMatch>();
      ((data || []) as unknown as PlayoffMatch[]).forEach(m => {
        if (m.draft_id) map.set(m.draft_id, m);
      });
      setMatchByDraft(map);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return matchByDraft;
}

/** Live subscription to playoff matches for a season — re-fetches whenever any row changes. */
export function usePlayoffMatchesLive(seasonId: string | undefined) {
  const [matches, setMatches] = useState<PlayoffMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!seasonId) { setLoading(false); return; }
    const { data } = await supabase
      .from('draft_playoff_matches' as any)
      .select('*')
      .eq('season_id', seasonId)
      .order('round')
      .order('match_number');
    setMatches((data || []) as unknown as PlayoffMatch[]);
    setLoading(false);
  }, [seasonId]);

  useEffect(() => {
    fetch();
    if (!seasonId) return;
    const ch = supabase
      .channel(`playoff-matches-${seasonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'draft_playoff_matches', filter: `season_id=eq.${seasonId}` }, () => fetch())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [seasonId, fetch]);

  return { matches, loading, refetch: fetch };
}

/** Renumber all regular-season entries sequentially (1, 2, 3…) by current week_number order */
async function renumberSeasonEntries(seasonId: string) {
  const { data: remaining } = await supabase
    .from('draft_season_entries' as any)
    .select('id, week_number')
    .eq('season_id', seasonId)
    .eq('is_playoff', false)
    .order('week_number');

  if (!remaining) return;

  for (let i = 0; i < (remaining as any[]).length; i++) {
    const entry = (remaining as any[])[i];
    const correctNumber = i + 1;
    if (entry.week_number !== correctNumber) {
      await supabase
        .from('draft_season_entries' as any)
        .update({ week_number: correctNumber } as any)
        .eq('id', entry.id);
    }
  }
}

/** Fetch a single season by id. */
export function useSeasonById(seasonId: string | undefined) {
  const [season, setSeason] = useState<DraftSeason | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!seasonId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase
        .from('draft_seasons' as any)
        .select('*')
        .eq('id', seasonId)
        .maybeSingle();
      setSeason((data as unknown as DraftSeason) ?? null);
      setLoading(false);
    })();
  }, [seasonId]);
  return { season, loading };
}

/** Fetch display profile rows for a list of user ids. */
export function useProfilesByIds(ids: Array<string | null | undefined>) {
  const key = Array.from(new Set(ids.filter(Boolean) as string[])).sort().join(',');
  const [map, setMap] = useState<Map<string, { display_name: string; avatar_url: string | null }>>(new Map());
  useEffect(() => {
    if (!key) { setMap(new Map()); return; }
    const idArr = key.split(',');
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', idArr);
      const m = new Map<string, { display_name: string; avatar_url: string | null }>();
      (data || []).forEach((p: any) => m.set(p.id, { display_name: p.display_name, avatar_url: p.avatar_url }));
      setMap(m);
    })();
  }, [key]);
  return map;
}

