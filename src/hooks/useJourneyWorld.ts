// The Splendid Journey — authored world metadata for a run.
//
// The runtime state only ever stores keys (`brass_key`, `vessa`, `wardens`).
// Every player-facing surface (Hero sheet, Journal, Codex) needs the authored
// name / description / icon / portrait / objective text behind those keys, so
// this hook fetches the run's pinned world package once and exposes lookup
// maps plus a small set of resolvers.
//
// Content tables are author-only under RLS: reads go through the
// `journey_get_world` SECURITY DEFINER RPC, pinned to the run's version.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import { EMPTY_WORLD } from '@/lib/journey/types';
import type {
  JourneyWorld, WorldFaction, WorldItem, WorldNpc, WorldQuest,
} from '@/lib/journey/types';

function byKey<T>(rows: T[], key: keyof T): Record<string, T> {
  const out: Record<string, T> = {};
  for (const r of rows) {
    const k = r?.[key];
    if (typeof k === 'string') out[k] = r;
  }
  return out;
}

/** Fall back to a readable version of the key rather than showing raw ids. */
export function humanizeKey(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface JourneyWorldView {
  world: JourneyWorld;
  loading: boolean;
  error: string | null;
  items: Record<string, WorldItem>;
  npcs: Record<string, WorldNpc>;
  factions: Record<string, WorldFaction>;
  quests: Record<string, WorldQuest>;
  /** Authored item name (falls back to a humanized key). */
  itemName: (key: string) => string;
  npcName: (key: string) => string;
  factionName: (key: string) => string;
  /** Authored objective text for a quest step key. */
  objectiveText: (questKey: string, stepKey: string | null | undefined) => string | null;
  refresh: () => Promise<void>;
}

export function useJourneyWorld(runId: string | undefined): JourneyWorldView {
  const [world, setWorld] = useState<JourneyWorld>(EMPTY_WORLD);
  const [loading, setLoading] = useState(Boolean(runId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!runId) { setWorld(EMPTY_WORLD); setLoading(false); return; }
    setError(null);
    try {
      const { data, error: rpcErr } = await withTimeout<any>(
        (supabase as any).rpc('journey_get_world', { _run_id: runId }),
        QUERY_TIMEOUT_MS, 'journey world',
      );
      if (rpcErr) throw new Error(rpcErr.message);
      setWorld({ ...EMPTY_WORLD, ...((data ?? {}) as JourneyWorld) });
    } catch (e) {
      setError((e as Error).message ?? 'The world record could not be read.');
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => { void load(); }, [load]);

  const items = useMemo(() => byKey(world.items ?? [], 'item_key'), [world.items]);
  const npcs = useMemo(() => byKey(world.npcs ?? [], 'npc_key'), [world.npcs]);
  const factions = useMemo(() => byKey(world.factions ?? [], 'faction_key'), [world.factions]);
  const quests = useMemo(() => byKey(world.quests ?? [], 'quest_key'), [world.quests]);

  const itemName = useCallback((k: string) => items[k]?.name ?? humanizeKey(k), [items]);
  const npcName = useCallback((k: string) => npcs[k]?.name ?? humanizeKey(k), [npcs]);
  const factionName = useCallback((k: string) => factions[k]?.name ?? humanizeKey(k), [factions]);

  const objectiveText = useCallback((questKey: string, stepKey: string | null | undefined) => {
    if (!stepKey) return null;
    const objectives = quests[questKey]?.objectives ?? [];
    const hit = objectives.find((o) => o?.key === stepKey);
    return hit?.text ?? humanizeKey(stepKey);
  }, [quests]);

  return {
    world, loading, error,
    items, npcs, factions, quests,
    itemName, npcName, factionName, objectiveText,
    refresh: load,
  };
}
