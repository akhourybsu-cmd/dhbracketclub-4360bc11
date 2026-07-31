import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS, HYDRATE_TIMEOUT_MS } from '@/lib/asyncGuards';
import type {
  StatsDataset, StatsPick, StatsResult, StatsDraft, StatsSeason,
  StatsStanding, StatsPlayoffMatch, StatsSeasonEntry, StatsProfile,
} from '@/lib/draft/statsAggregators';

const EMPTY: StatsDataset = {
  picks: [], results: [], drafts: [], seasons: [],
  standings: [], matches: [], seasonEntries: [], profiles: new Map(),
};

export function useDraftStatsHub() {
  const [dataset, setDataset] = useState<StatsDataset>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = <T,>(p: PromiseLike<{ data: any; error: any }>, label: string) =>
        withTimeout(Promise.resolve(p).then(r => {
          if (r.error) throw r.error;
          return (r.data || []) as T;
        }), QUERY_TIMEOUT_MS, label);

      /* Paged fetch.
       *
       * PostgREST caps a single response at 1000 rows. `draft_picks` is
       * already past that in production, so an unpaged select silently
       * dropped the oldest ~30% of picks — which quietly corrupted Pick
       * Quality, Tempo, hot streaks and every pick-derived leaderboard.
       * Page through with .range() until a short page comes back. */
      const PAGE = 1000;
      const qAll = async <T,>(build: (from: number, to: number) => any, label: string): Promise<T[]> => {
        const out: T[] = [];
        for (let page = 0; page < 50; page++) {
          const from = page * PAGE;
          const rows = await q<any[]>(build(from, from + PAGE - 1), `${label} p${page}`);
          out.push(...(rows as T[]));
          if (rows.length < PAGE) break;
        }
        return out;
      };

      const [picks, results, drafts, seasons, standings, matches, entries] = await withTimeout(
        Promise.all([
          qAll<any>((f, t) => supabase.from('draft_picks').select('id, draft_id, user_id, round, pick_number, pick_text, picked_at').order('id').range(f, t) as any, 'draft_picks'),
          qAll<any>((f, t) => supabase.from('draft_results' as any).select('id, draft_id, user_id, rank, total_score, points_awarded, pick_ratings, created_at').order('id').range(f, t) as any, 'draft_results'),
          qAll<any>((f, t) => supabase.from('drafts').select('id, topic, category, created_by, created_at, num_rounds, status').order('id').range(f, t) as any, 'drafts'),
          q<any[]>(supabase.from('draft_seasons' as any).select('id, name, season_number, subtitle, status, starts_at, champion_user_id, runner_up_user_id, third_place_user_id, regular_season_champion_user_id') as any, 'draft_seasons'),
          q<any[]>(supabase.from('draft_season_standings' as any).select('season_id, user_id, season_points, drafts_played, wins, podiums, avg_finish, avg_score, best_score, worst_score, consistency, rank, playoff_seed') as any, 'draft_season_standings'),
          q<any[]>(supabase.from('draft_playoff_matches' as any).select('season_id, round, winner_user_id, user_a, user_b') as any, 'draft_playoff_matches'),
          q<any[]>(supabase.from('draft_season_entries' as any).select('season_id, draft_id, is_playoff') as any, 'draft_season_entries'),
        ]),
        HYDRATE_TIMEOUT_MS,
        'stats hydrate',
      );

      // Collect every relevant user id then bulk-fetch profiles
      const uids = new Set<string>();
      results.forEach((r: any) => uids.add(r.user_id));
      picks.forEach((p: any) => uids.add(p.user_id));
      drafts.forEach((d: any) => uids.add(d.created_by));
      seasons.forEach((s: any) => {
        if (s.champion_user_id) uids.add(s.champion_user_id);
        if (s.runner_up_user_id) uids.add(s.runner_up_user_id);
        if (s.third_place_user_id) uids.add(s.third_place_user_id);
        if (s.regular_season_champion_user_id) uids.add(s.regular_season_champion_user_id);
      });
      matches.forEach((m: any) => { if (m.winner_user_id) uids.add(m.winner_user_id); if (m.user_a) uids.add(m.user_a); if (m.user_b) uids.add(m.user_b); });

      let profilesMap = new Map<string, StatsProfile>();
      if (uids.size > 0) {
        const ids = Array.from(uids);
        const profiles: any[] = [];
        for (let i = 0; i < ids.length; i += 200) {
          const chunk = await q<any[]>(
            supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids.slice(i, i + 200)) as any,
            'profiles',
          );
          profiles.push(...chunk);
        }
        profilesMap = new Map(profiles.map((p: any) => [p.id, p as StatsProfile]));
      }

      setDataset({
        picks: picks as StatsPick[],
        results: (results as any[]).map(r => ({
          ...r,
          pick_ratings: Array.isArray(r.pick_ratings) ? r.pick_ratings : [],
        })) as StatsResult[],
        drafts: drafts as StatsDraft[],
        seasons: seasons as StatsSeason[],
        standings: standings as StatsStanding[],
        matches: matches as StatsPlayoffMatch[],
        seasonEntries: entries as StatsSeasonEntry[],
        profiles: profilesMap,
      });
    } catch (err: any) {
      console.error('useDraftStatsHub: failed to hydrate', err);
      setError(err?.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { dataset, loading, error, refresh };
}
