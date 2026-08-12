// The Splendid Journey — campaign library, heroes and runs for the current player.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import type { CampaignRow, HeroRow, RunRow } from '@/lib/journey/types';

export interface JourneyLibrary {
  campaigns: CampaignRow[];
  runs: RunRow[];
  heroes: HeroRow[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createHero: (input: Partial<HeroRow> & { name: string }) => Promise<HeroRow | null>;
  startRun: (campaignId: string, heroId: string, isTest?: boolean) => Promise<RunRow | null>;
  abandonRun: (runId: string) => Promise<boolean>;
  /** Most recent active run, used for "Continue Journey". */
  currentRun: RunRow | null;
}

export function useJourneyLibrary(): JourneyLibrary {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [heroes, setHeroes] = useState<HeroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setError(null);
    try {
      const [c, r, h] = await withTimeout<any[]>(Promise.all([
        withTimeout<any>((supabase as any).from('journey_campaigns').select('*').order('created_at', { ascending: false }), QUERY_TIMEOUT_MS, 'journey campaigns'),
        withTimeout<any>((supabase as any).from('journey_campaign_runs').select('*').eq('user_id', user.id).order('last_played_at', { ascending: false }), QUERY_TIMEOUT_MS, 'journey runs'),
        withTimeout<any>((supabase as any).from('journey_characters').select('*').eq('user_id', user.id).order('created_at', { ascending: false }), QUERY_TIMEOUT_MS, 'journey heroes'),
      ]), HYDRATE_TIMEOUT_MS, 'journey library');
      if (c?.error) throw new Error(c.error.message);
      setCampaigns((c?.data ?? []) as CampaignRow[]);
      setRuns((r?.data ?? []) as RunRow[]);
      setHeroes((h?.data ?? []) as HeroRow[]);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load the journey library');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const createHero = useCallback(async (input: Partial<HeroRow> & { name: string }) => {
    if (!user) return null;
    const { data, error: err } = await (supabase as any)
      .from('journey_characters')
      .insert({
        user_id: user.id,
        name: input.name,
        pronouns: input.pronouns ?? null,
        origin: input.origin ?? null,
        background: input.background ?? null,
        stats: input.stats ?? { might: 2, finesse: 2, wits: 2, resolve: 2 },
      })
      .select('*')
      .single();
    if (err) { setError(err.message); return null; }
    await refresh();
    return data as HeroRow;
  }, [user, refresh]);

  const startRun = useCallback(async (campaignId: string, heroId: string, isTest = false) => {
    const { data, error: err } = await (supabase as any).rpc('journey_start_run', {
      _campaign_id: campaignId, _character_id: heroId, _is_test: isTest,
    });
    if (err) { setError(err.message); return null; }
    const row = (Array.isArray(data) ? data[0] : data) as RunRow;
    await refresh();
    return row ?? null;
  }, [refresh]);

  const abandonRun = useCallback(async (runId: string) => {
    const { error: err } = await (supabase as any)
      .from('journey_campaign_runs').update({ status: 'abandoned' }).eq('id', runId);
    if (err) { setError(err.message); return false; }
    await refresh();
    return true;
  }, [refresh]);

  const currentRun = useMemo(
    () => runs.find((r) => r.status === 'active' && !r.is_test_run) ?? null,
    [runs],
  );

  return { campaigns, runs, heroes, loading, error, refresh, createHero, startRun, abandonRun, currentRun };
}
