// The Splendid Journey — the ending experience.
//
// `journey_get_ending` resolves the ending record from the run's pinned
// campaign version, filters `epilogue_blocks` by their requirements against
// the final run state (server-side, so unqualified passages never reach the
// client) and returns a spoiler-safe recap of the decisions the player
// actually made — never paths they did not take.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import type { EndingPayload } from '@/lib/journey/types';

export interface JourneyEndingView {
  ending: EndingPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useJourneyEnding(runId: string | undefined, enabled = true): JourneyEndingView {
  const [ending, setEnding] = useState<EndingPayload | null>(null);
  const [loading, setLoading] = useState(Boolean(runId && enabled));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!runId || !enabled) { setLoading(false); return; }
    setError(null);
    try {
      const { data, error: rpcErr } = await withTimeout<any>(
        (supabase as any).rpc('journey_get_ending', { _run_id: runId }),
        QUERY_TIMEOUT_MS, 'journey ending',
      );
      if (rpcErr) throw new Error(rpcErr.message);
      setEnding((data ?? null) as EndingPayload | null);
    } catch (e) {
      setError((e as Error).message ?? 'The ending could not be read.');
    } finally {
      setLoading(false);
    }
  }, [runId, enabled]);

  useEffect(() => { void load(); }, [load]);

  return { ending, loading, error, refresh: load };
}
