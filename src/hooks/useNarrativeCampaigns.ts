// DH Club — Narrative RPG · Campaign list + create + approval hooks
//
// One hook returns the campaigns visible to the current user in the
// active club (RLS does the heavy lifting). Mutators delegate to two
// SECURITY DEFINER RPCs (`create_narrative_campaign` and
// `transition_narrative_campaign`) so that the campaign insert / status
// change is atomic with the GM-membership row and the audit-trail
// entry. The client no longer needs to coordinate three separate
// writes.
//
// All mutator errors are surfaced via the returned `error` field AND
// toasted by the caller — the prior "silent setError + generic toast"
// pattern masked the missing-schema bug for an entire review cycle.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import type { Campaign, CampaignStatus, CampaignPlayMode, CampaignVisibility } from '@/lib/narrative/types';
import { getTemplate, type TemplateKey } from '@/lib/narrative/templates';
import { seedCampaignFromTemplate } from '@/lib/narrative/templateSeeder';

interface UseNarrativeCampaignsResult {
  campaigns: Campaign[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createCampaign: (input: CreateCampaignInput) => Promise<Campaign | null>;
  approveCampaign: (campaignId: string, notes?: string) => Promise<boolean>;
  requestChanges: (campaignId: string, notes: string) => Promise<boolean>;
  rejectCampaign: (campaignId: string, notes: string) => Promise<boolean>;
  archiveCampaign: (campaignId: string) => Promise<boolean>;
  /** Hard-delete a campaign. Removes the row and CASCADEs every child
   *  entity (members, characters, scenes, messages, NPCs, clues, items,
   *  factions, clocks, memory, summaries, rolls, ai_suggestions, GM
   *  notes, approval events). Only club admins can call this — RLS
   *  enforces the same. Returns true on success. */
  deleteCampaign: (campaignId: string) => Promise<boolean>;
  submitForApproval: (campaignId: string) => Promise<boolean>;
}

export interface CreateCampaignInput {
  title: string;
  pitch?: string;
  description?: string;
  template_key: TemplateKey;
  tone_profile?: string;
  play_mode: CampaignPlayMode;
  visibility: CampaignVisibility;
  proposed_gm_id?: string | null;
  player_limit?: number | null;
  spectators_allowed?: boolean;
  content_notes?: string;
  opening_premise?: string;
  schedule_note?: string;
  /** Submit immediately vs save as draft. */
  submit: boolean;
}

export function useNarrativeCampaigns(): UseNarrativeCampaignsResult {
  const { user } = useAuth();
  const { club } = useClub();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<() => Promise<void>>();

  const refresh = useCallback(async () => {
    // Same defensive pattern as useNarrativeCampaign: initial loading
    // is `true`, so an early-return without clearing loading leaves
    // the list page stuck on the skeleton if user/club briefly
    // resolve to null during context hydration.
    if (!user || !club?.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      // RLS filters everything — we just ask for the club's campaigns.
      const { data, error: dbErr } = await (supabase as any)
        .from('narrative_campaigns')
        .select('*')
        .eq('club_id', club.id)
        .order('updated_at', { ascending: false });
      if (dbErr) {
        // Surface the real Postgres message so missing-table / RLS
        // errors are visible during dev (the old behavior swallowed
        // them).
        setError(dbErr.message);
        return;
      }
      setCampaigns((data ?? []) as Campaign[]);
    } catch (e) {
      // Network / SDK failures end up here. Surface the message so
      // the user sees what went wrong instead of an eternal skeleton.
      setError((e as Error).message ?? 'Failed to load campaigns');
    } finally {
      // Always clear loading — closes the permanent-skeleton bug.
      setLoading(false);
    }
  }, [user, club?.id]);

  // Mirror refresh in a ref so the realtime subscription can call the
  // latest version without re-subscribing every render.
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: any insert/update on a campaign in the current club
  // triggers a refresh. RLS still gates what comes back. Cheap because
  // campaigns are low-volume per club.
  useEffect(() => {
    if (!club?.id) return;
    const channel = (supabase as any)
      .channel(`narrative-campaigns:${club.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'narrative_campaigns', filter: `club_id=eq.${club.id}` },
        () => { refreshRef.current?.(); },
      )
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [club?.id]);

  const createCampaign = useCallback(async (input: CreateCampaignInput): Promise<Campaign | null> => {
    if (!user || !club?.id) {
      setError('No active club');
      return null;
    }
    const template = getTemplate(input.template_key);
    setError(null);

    const { data, error: rpcErr } = await (supabase as any).rpc('create_narrative_campaign', {
      _club_id: club.id,
      _title: input.title,
      _pitch: input.pitch ?? null,
      _description: input.description ?? null,
      _template_key: input.template_key,
      _tone_profile: input.tone_profile?.trim() || template.toneProfile || null,
      _play_mode: input.play_mode,
      _visibility: input.visibility,
      _player_limit: input.player_limit ?? null,
      _spectators_allowed: input.spectators_allowed ?? false,
      _content_notes: input.content_notes ?? null,
      _opening_premise: input.opening_premise?.trim() || template.openingPremise || null,
      _schedule_note: input.schedule_note ?? null,
      _proposed_gm_id: input.proposed_gm_id ?? user.id,
      _submit: input.submit,
    });

    if (rpcErr) {
      // Surface the Postgres exception message so the UI can show a
      // useful toast instead of a generic "couldn't create campaign".
      setError(rpcErr.message);
      return null;
    }
    // .rpc returning a setof/row gives us either an object or a single-
    // element array depending on definition. Normalize.
    const row: Campaign | null = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
    if (!row) {
      setError('Campaign was not created');
      return null;
    }
    // Write campaign metadata only (tone_profile + canon_locks) so the
    // GM lands on a blank-canvas campaign they can populate manually
    // via the GM Console. Starter NPCs / locations / factions / clues
    // / clocks / opening scene are NOT auto-instantiated — the GM
    // opts in via the GmOnboardingSheet's "Pre-fill starters" button
    // on first open.
    try {
      const seed = await seedCampaignFromTemplate(row.id, input.template_key);
      if (seed.errors.length > 0) {
        setError(`Campaign created, but the template metadata couldn't be saved (${seed.errors[0]}). The GM Console will still work.`);
      }
    } catch (seedErr) {
      // Best-effort — never block the create flow on seed failure.
      console.warn('[narrative] seed after create failed:', seedErr);
    }
    await refresh();
    return row;
  }, [user, club?.id, refresh]);

  /** Internal helper — calls the transition RPC and refreshes. */
  const transition = useCallback(async (
    campaignId: string,
    nextStatus: CampaignStatus,
    eventType: string,
    notes?: string,
  ): Promise<boolean> => {
    if (!user) {
      setError('Not signed in');
      return false;
    }
    setError(null);
    const { error: rpcErr } = await (supabase as any).rpc('transition_narrative_campaign', {
      _campaign_id: campaignId,
      _next_status: nextStatus,
      _event_type: eventType,
      _notes: notes ?? null,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      return false;
    }
    await refresh();
    return true;
  }, [user, refresh]);

  const submitForApproval = useCallback((id: string) =>
    transition(id, 'pending_approval', 'submitted'),
  [transition]);

  const approveCampaign = useCallback((id: string, notes?: string) =>
    transition(id, 'active', 'approved', notes),
  [transition]);

  const requestChanges = useCallback((id: string, notes: string) =>
    transition(id, 'needs_changes', 'changes_requested', notes),
  [transition]);

  const rejectCampaign = useCallback((id: string, notes: string) =>
    transition(id, 'rejected', 'rejected', notes),
  [transition]);

  const archiveCampaign = useCallback((id: string) =>
    transition(id, 'archived', 'archived'),
  [transition]);

  const deleteCampaign = useCallback(async (id: string): Promise<boolean> => {
    if (!user) {
      setError('Not signed in');
      return false;
    }
    setError(null);
    // Hard delete — RLS gates this to club admins (narrative_campaigns_delete
    // policy uses narrative_is_club_admin). Cascade FKs handle every child
    // entity automatically; no orphan rows survive.
    const { error: delErr } = await (supabase as any)
      .from('narrative_campaigns')
      .delete()
      .eq('id', id);
    if (delErr) {
      setError(delErr.message);
      return false;
    }
    // Realtime subscription on narrative_campaigns will catch the DELETE
    // and refresh the list for every viewer. We also refresh locally
    // immediately so the navigating user sees the list update without
    // waiting for the realtime round-trip.
    await refresh();
    return true;
  }, [user, refresh]);

  return useMemo(() => ({
    campaigns,
    loading,
    error,
    refresh,
    createCampaign,
    approveCampaign,
    requestChanges,
    rejectCampaign,
    archiveCampaign,
    deleteCampaign,
    submitForApproval,
  }), [campaigns, loading, error, refresh, createCampaign, approveCampaign, requestChanges, rejectCampaign, archiveCampaign, deleteCampaign, submitForApproval]);
}
