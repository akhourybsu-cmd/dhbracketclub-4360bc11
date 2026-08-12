// Campaign Studio — developer/QA data layer.
//
// Studio is deliberately NOT a heavyweight visual CMS: the primary authoring
// workflow is "structured campaign package → import → validate → playtest".
// This hook provides the read side (assemble a full CampaignPackage from the
// relational rows) plus import, publish and test-run helpers.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import type {
  CampaignPackage, CampaignRow, CampaignStatus, RunState,
} from '@/lib/journey/types';

const table = (t: string) => (supabase as any).from(t);

/** Rebuild the machine-readable package for a campaign (export / validate). */
export async function exportCampaignPackage(campaignId: string): Promise<CampaignPackage> {
  const q = (t: string) => withTimeout<any>(table(t).select('*').eq('campaign_id', campaignId), QUERY_TIMEOUT_MS, `studio ${t}`);
  const [camp, acts, chapters, scenes, blocks, choices, npcs, items, quests, locations, codex, variables, factions, enemies, endings] =
    await Promise.all([
      withTimeout<any>(table('journey_campaigns').select('*').eq('id', campaignId).maybeSingle(), QUERY_TIMEOUT_MS, 'studio campaign'),
      q('journey_acts'), q('journey_chapters'), q('journey_scenes'), q('journey_scene_blocks'), q('journey_choices'),
      q('journey_npcs'), q('journey_items'), q('journey_quests'), q('journey_locations'), q('journey_codex_entries'),
      q('journey_campaign_variables'), q('journey_factions'), q('journey_enemies'), q('journey_endings'),
    ]);

  const c = camp?.data;
  const chapterById = new Map<string, string>((chapters?.data ?? []).map((r: any) => [r.id, r.chapter_key]));
  const actById = new Map<string, string>((acts?.data ?? []).map((r: any) => [r.id, r.act_key]));
  const blocksByScene = new Map<string, any[]>();
  (blocks?.data ?? []).forEach((b: any) => {
    blocksByScene.set(b.scene_id, [...(blocksByScene.get(b.scene_id) ?? []), b]);
  });
  const choicesByScene = new Map<string, any[]>();
  (choices?.data ?? []).forEach((ch: any) => {
    choicesByScene.set(ch.scene_id, [...(choicesByScene.get(ch.scene_id) ?? []), ch]);
  });

  const strip = <T extends Record<string, unknown>>(row: T) => {
    const { id, campaign_id, created_at, updated_at, scene_id, chapter_id, act_id, ...rest } = row as any;
    return rest;
  };

  return {
    campaign: {
      slug: c?.slug, title: c?.title, subtitle: c?.subtitle, description: c?.description,
      cover_image: c?.cover_image, hero_image: c?.hero_image, status: c?.status, version: c?.version,
      author: c?.author, estimated_length: c?.estimated_length, minimum_level: c?.minimum_level,
      recommended_level: c?.recommended_level, starting_scene_key: c?.starting_scene_key,
      content_notes: c?.content_notes, config: c?.config, tags: c?.tags, author_notes: c?.author_notes,
    },
    acts: (acts?.data ?? []).map(strip),
    chapters: (chapters?.data ?? []).map((r: any) => ({ ...strip(r), act_key: r.act_id ? actById.get(r.act_id) : undefined })),
    scenes: (scenes?.data ?? [])
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((s: any) => ({
        ...strip(s),
        chapter_key: s.chapter_id ? chapterById.get(s.chapter_id) : undefined,
        blocks: (blocksByScene.get(s.id) ?? []).sort((a, b) => a.display_order - b.display_order).map(strip),
        choices: (choicesByScene.get(s.id) ?? []).sort((a, b) => a.display_order - b.display_order).map(strip),
      })),
    npcs: (npcs?.data ?? []).map(strip),
    items: (items?.data ?? []).map(strip),
    quests: (quests?.data ?? []).map(strip),
    locations: (locations?.data ?? []).map(strip),
    codex: (codex?.data ?? []).map(strip),
    variables: (variables?.data ?? []).map(strip),
    factions: (factions?.data ?? []).map(strip),
    enemies: (enemies?.data ?? []).map(strip),
    endings: (endings?.data ?? []).map(strip),
  } as CampaignPackage;
}

export function useJourneyStudio() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await withTimeout<any>(
        table('journey_campaigns').select('*').order('updated_at', { ascending: false }),
        QUERY_TIMEOUT_MS, 'studio campaigns',
      );
      if (err) throw new Error(err.message);
      setCampaigns((data ?? []) as CampaignRow[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /** Import (or fully replace) a campaign from a structured package. */
  const importPackage = useCallback(async (pkg: CampaignPackage) => {
    const { data, error: err } = await (supabase as any).rpc('journey_import_campaign', { _package: pkg });
    if (err) { setError(err.message); return null; }
    await refresh();
    return data as { campaign_id: string; scenes: number; blocks: number; choices: number };
  }, [refresh]);

  const setStatus = useCallback(async (campaignId: string, status: CampaignStatus) => {
    const patch: Record<string, unknown> = { status };
    if (status === 'published') patch.published_at = new Date().toISOString();
    const { error: err } = await table('journey_campaigns').update(patch).eq('id', campaignId);
    if (err) { setError(err.message); return false; }
    await refresh();
    return true;
  }, [refresh]);

  const bumpVersion = useCallback(async (campaignId: string, version: number) => {
    const { error: err } = await table('journey_campaigns').update({ version: version + 1 }).eq('id', campaignId);
    if (err) { setError(err.message); return false; }
    await refresh();
    return true;
  }, [refresh]);

  const deleteCampaign = useCallback(async (campaignId: string) => {
    const { error: err } = await table('journey_campaigns').delete().eq('id', campaignId);
    if (err) { setError(err.message); return false; }
    await refresh();
    return true;
  }, [refresh]);

  return { campaigns, loading, error, refresh, importPackage, setStatus, bumpVersion, deleteCampaign };
}

/** Test-mode: jump a run to a scene and/or patch its state. Authors only. */
export async function patchTestRun(runId: string, sceneKey: string | null, statePatch: Partial<RunState>) {
  const { data, error } = await (supabase as any).rpc('journey_test_patch_run', {
    _run_id: runId, _scene_key: sceneKey, _state_patch: statePatch,
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data[0] : data;
}
