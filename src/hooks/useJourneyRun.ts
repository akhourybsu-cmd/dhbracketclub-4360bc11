// The Splendid Journey — active campaign run.
//
// Loads the run, its campaign and the *current scene only* (blocks + choices),
// so reading stays instant no matter how large the campaign is. Choice
// execution is server-authoritative via the `journey_execute_choice` RPC; the
// client only decides presentation (hidden vs locked) using the shared
// requirement engine.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import { evaluateRequirements, describeRequirement } from '@/lib/journey/requirements';
import { effectNotices } from '@/lib/journey/effects';
import { EMPTY_RUN_STATE } from '@/lib/journey/types';
import type {
  BlockRow, CampaignRow, ChoiceRow, RunRow, RunState, SceneRow,
} from '@/lib/journey/types';

export interface PresentedChoice {
  choice: ChoiceRow;
  available: boolean;
  /** Hidden choices are filtered out entirely before this list is returned. */
  lockedLabel: string | null;
}

export interface JourneyRunView {
  run: RunRow | null;
  campaign: CampaignRow | null;
  scene: SceneRow | null;
  chapterTitle: string | null;
  locationName: string | null;
  blocks: BlockRow[];
  choices: PresentedChoice[];
  state: RunState;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notices: string[];
  clearNotices: () => void;
  refresh: () => Promise<void>;
  chooseChoice: (choiceKey: string) => Promise<boolean>;
}

export function useJourneyRun(runId: string | undefined): JourneyRunView {
  const [run, setRun] = useState<RunRow | null>(null);
  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [scene, setScene] = useState<SceneRow | null>(null);
  const [chapterTitle, setChapterTitle] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);
  const [rawChoices, setRawChoices] = useState<ChoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<string[]>([]);
  const inFlight = useRef(false);

  const loadScene = useCallback(async (r: RunRow) => {
    if (!r.current_scene_key) { setScene(null); setBlocks([]); setRawChoices([]); return; }
    const { data: sceneRow, error: sErr } = await withTimeout<any>(
      (supabase as any).from('journey_scenes').select('*')
        .eq('campaign_id', r.campaign_id).eq('scene_key', r.current_scene_key).maybeSingle(),
      QUERY_TIMEOUT_MS, 'journey scene',
    );
    if (sErr) throw new Error(sErr.message);
    if (!sceneRow) { setScene(null); setBlocks([]); setRawChoices([]); return; }
    setScene(sceneRow as SceneRow);

    const [b, c, ch, loc] = await Promise.all([
      withTimeout<any>((supabase as any).from('journey_scene_blocks').select('*').eq('scene_id', sceneRow.id).order('display_order'), QUERY_TIMEOUT_MS, 'journey blocks'),
      withTimeout<any>((supabase as any).from('journey_choices').select('*').eq('scene_id', sceneRow.id).order('display_order'), QUERY_TIMEOUT_MS, 'journey choices'),
      sceneRow.chapter_id
        ? withTimeout<any>((supabase as any).from('journey_chapters').select('title').eq('id', sceneRow.chapter_id).maybeSingle(), QUERY_TIMEOUT_MS, 'journey chapter')
        : Promise.resolve({ data: null }),
      sceneRow.location_key
        ? withTimeout<any>((supabase as any).from('journey_locations').select('name,region').eq('campaign_id', r.campaign_id).eq('location_key', sceneRow.location_key).maybeSingle(), QUERY_TIMEOUT_MS, 'journey location')
        : Promise.resolve({ data: null }),
    ]);
    setBlocks((b?.data ?? []) as BlockRow[]);
    setRawChoices((c?.data ?? []) as ChoiceRow[]);
    setChapterTitle(ch?.data?.title ?? null);
    setLocationName(loc?.data?.name ?? null);
  }, []);

  const refresh = useCallback(async () => {
    if (!runId) { setLoading(false); return; }
    setError(null);
    try {
      const { data: runRow, error: rErr } = await withTimeout<any>(
        (supabase as any).from('journey_campaign_runs').select('*').eq('id', runId).maybeSingle(),
        QUERY_TIMEOUT_MS, 'journey run',
      );
      if (rErr) throw new Error(rErr.message);
      if (!runRow) throw new Error('This journey could not be found.');
      setRun(runRow as RunRow);

      const { data: camp } = await withTimeout<any>(
        (supabase as any).from('journey_campaigns').select('*').eq('id', runRow.campaign_id).maybeSingle(),
        QUERY_TIMEOUT_MS, 'journey campaign',
      );
      setCampaign((camp ?? null) as CampaignRow | null);
      await loadScene(runRow as RunRow);
    } catch (e) {
      setError((e as Error).message ?? 'Something went wrong loading this journey.');
    } finally {
      setLoading(false);
    }
  }, [runId, loadScene]);

  useEffect(() => { refresh(); }, [refresh]);

  const state: RunState = useMemo(
    () => ({ ...EMPTY_RUN_STATE, ...(run?.state ?? {}) }) as RunState,
    [run?.state],
  );

  const choices: PresentedChoice[] = useMemo(() => rawChoices.flatMap((c) => {
    const available = evaluateRequirements(c.requirements, state);
    const alreadyTaken = c.once_only && (state.choices_made ?? []).includes(c.choice_key);
    if ((!available || alreadyTaken) && c.hidden_when_unavailable) return [];
    return [{
      choice: c,
      available: available && !alreadyTaken,
      lockedLabel: available && !alreadyTaken
        ? null
        : (c.locked_hint || describeRequirement(c.requirements) || 'Unavailable'),
    }];
  }), [rawChoices, state]);

  const chooseChoice = useCallback(async (choiceKey: string) => {
    if (!run || !run.current_scene_key || inFlight.current) return false;
    const target = rawChoices.find((c) => c.choice_key === choiceKey);
    if (!target) return false;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const { data, error: rpcErr } = await (supabase as any).rpc('journey_execute_choice', {
        _run_id: run.id,
        _scene_key: run.current_scene_key,
        _choice_key: choiceKey,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      const next = (Array.isArray(data) ? data[0] : data) as RunRow;
      setRun(next);
      await loadScene(next);
      setNotices(effectNotices(target.effects));
      return true;
    } catch (e) {
      setError((e as Error).message ?? 'That choice could not be made.');
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [run, rawChoices, loadScene]);

  return {
    run, campaign, scene, chapterTitle, locationName, blocks, choices, state,
    loading, busy, error, notices,
    clearNotices: () => setNotices([]),
    refresh, chooseChoice,
  };
}
