import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNexusProgress } from '@/hooks/useNexusProgress';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';
import { buildJourney, type JourneyModel } from '@/lib/nexus/journey';

const sb = supabase as any;

/**
 * Assembles the unified Nexus progression model: campaign progress (from
 * nexus_progress), endless best wave + run count, co-op participation, and
 * sigil collection — folded into stage statuses, an overall completion %,
 * and an operative rank via buildJourney().
 */
export function useNexusJourney() {
  const { user } = useAuth();
  const { progress, loading: progressLoading } = useNexusProgress();
  const [extra, setExtra] = useState({
    endlessBestWave: 0,
    endlessRuns: 0,
    opParticipated: false,
    sigilsOwned: 0,
    sigilsTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!user) { setLoading(false); return; }
    (async () => {
      try {
        const [best, endlessCount, opCount, sigOwned, sigTotal] = await Promise.all([
          sb.from('nexus_runs').select('waves_cleared').eq('user_id', user.id)
            .eq('mission_id', ENDLESS_MISSION_ID).order('waves_cleared', { ascending: false }).limit(1),
          sb.from('nexus_runs').select('id', { count: 'exact', head: true })
            .eq('user_id', user.id).eq('mission_id', ENDLESS_MISSION_ID),
          sb.from('nexus_operation_contributions').select('user_id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          sb.from('nexus_user_sigils').select('sigil_id', { count: 'exact', head: true })
            .eq('user_id', user.id),
          sb.from('nexus_sigils').select('code', { count: 'exact', head: true }),
        ]);
        if (cancelled) return;
        setExtra({
          endlessBestWave: best?.data?.[0]?.waves_cleared ?? 0,
          endlessRuns: endlessCount?.count ?? 0,
          opParticipated: (opCount?.count ?? 0) > 0,
          sigilsOwned: sigOwned?.count ?? 0,
          sigilsTotal: sigTotal?.count ?? 0,
        });
      } catch {
        /* leave defaults — journey still renders with campaign data */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const model: JourneyModel = useMemo(() => buildJourney({
    highestMission: progress.highest_mission,
    cores: progress.cores,
    ...extra,
  }), [progress.highest_mission, progress.cores, extra]);

  return { model, loading: loading || progressLoading };
}
