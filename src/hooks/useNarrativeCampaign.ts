// DH Club — Narrative RPG · Single campaign hook
//
// Wraps everything the campaign detail page needs:
//   • The campaign row + my role within it
//   • Messages (real-time INSERT subscription)
//   • Characters + my character
//   • Members
//   • Scenes / chapters / clocks / NPCs / clues / factions / items / locations
//   • Mutators for messages, character, dice rolls
//
// Real-time: subscribes to message + clock INSERTs and merges them
// optimistically. Avoids fetching huge history on every push.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { rollChronicle, type ChronicleStat, type RollAdvantage } from '@/lib/narrative/chronicleRuleset';
import { ensureCampaignWorldSeeded } from '@/lib/narrative/templateSeeder';
import type {
  Campaign, CampaignMember, Character, Scene, Message, MessageType,
  NPC, Faction, Clock, Clue, Item, Location as NarrativeLocation,
  AiSuggestionRow,
} from '@/lib/narrative/types';

/**
 * Set of recently-mutated entity ids — surfaces ride this for a brief
 * highlight pulse when the entity changes (e.g. a clock just advanced
 * via an approved AI state update). Each id is auto-cleared 2.4s after
 * the change.
 */
export type RecentlyChangedSet = Set<string>;

interface UseNarrativeCampaignResult {
  campaign: Campaign | null;
  myRole: 'game_master' | 'player' | 'spectator' | null;
  isGm: boolean;
  members: CampaignMember[];
  characters: Character[];
  myCharacter: Character | null;
  currentScene: Scene | null;
  scenes: Scene[];
  messages: Message[];
  npcs: NPC[];
  factions: Faction[];
  clocks: Clock[];
  clues: Clue[];
  items: Item[];
  locations: NarrativeLocation[];
  aiSuggestions: AiSuggestionRow[];
  /** Ids of entities mutated within the last ~2.4s — UI surfaces can
   *  read this to render a brief highlight pulse on freshly-changed
   *  rows (e.g. clock advanced, faction heat shifted). */
  recentlyChanged: RecentlyChangedSet;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  // Story chat
  postMessage: (input: PostMessageInput) => Promise<Message | null>;
  rollDice: (input: RollDiceInput) => Promise<Message | null>;

  // Character
  createCharacter: (c: Omit<Character, 'id' | 'created_at' | 'updated_at' | 'campaign_id' | 'owner_id' | 'is_retired'>) => Promise<Character | null>;
  updateCharacter: (id: string, patch: Partial<Character>) => Promise<boolean>;

  // GM mutations
  createScene: (input: { title: string; location?: string; stakes?: string; objective?: string; public_notes?: string; gm_notes?: string }) => Promise<Scene | null>;
  endScene: (sceneId: string) => Promise<boolean>;
  advanceClock: (clockId: string, delta: number, note?: string) => Promise<boolean>;
  createClock: (input: { name: string; description?: string; max_value: number; clock_type: Clock['clock_type']; visibility: 'public' | 'gm_only' }) => Promise<Clock | null>;
  /** Persists the GM's "waiting on" pin. Pass mode=null (or no args)
   *  to clear. mode='specific' requires player_ids. The required flag
   *  tells the players whether a response is mandatory or optional. */
  setWaitingOn: (next: { mode: 'all' | 'specific' | null; player_ids?: string[]; required?: boolean }) => Promise<boolean>;
  createNpc: (input: Partial<NPC> & { name: string }) => Promise<NPC | null>;
  createClue: (input: Partial<Clue> & { name: string }) => Promise<Clue | null>;
  createFaction: (input: Partial<Faction> & { name: string }) => Promise<Faction | null>;
  createItem: (input: Partial<Item> & { name: string }) => Promise<Item | null>;
  createLocation: (input: Partial<NarrativeLocation> & { name: string }) => Promise<NarrativeLocation | null>;
}

interface PostMessageInput {
  body: string;
  message_type: MessageType;
  scene_id?: string | null;
  character_id?: string | null;
  visibility?: 'public' | 'gm_only' | 'private';
  metadata?: Record<string, unknown>;
}

interface RollDiceInput {
  stat: ChronicleStat | 'none';
  statValue: number;
  modifier?: number;
  difficulty?: number;
  advantage?: RollAdvantage;
  reason?: string;
  character_id?: string | null;
  visibility?: 'public' | 'gm_only';
  scene_id?: string | null;
}

export function useNarrativeCampaign(campaignId: string | undefined): UseNarrativeCampaignResult {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [members, setMembers] = useState<CampaignMember[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [npcs, setNpcs] = useState<NPC[]>([]);
  const [factions, setFactions] = useState<Faction[]>([]);
  const [clocks, setClocks] = useState<Clock[]>([]);
  const [clues, setClues] = useState<Clue[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<NarrativeLocation[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestionRow[]>([]);
  const [recentlyChanged, setRecentlyChanged] = useState<RecentlyChangedSet>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Mark an entity id as recently-changed and auto-clear after 2.4s.
   *  Called from realtime UPDATE handlers so any approved AI state
   *  update lights up the affected card briefly. */
  const flashChange = useCallback((id: string | undefined | null) => {
    if (!id) return;
    setRecentlyChanged(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTimeout(() => {
      setRecentlyChanged(prev => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2400);
  }, []);

  // Mirror campaign in a ref so real-time callbacks have current data.
  const campaignRef = useRef<Campaign | null>(null);
  useEffect(() => { campaignRef.current = campaign; }, [campaign]);

  const refresh = useCallback(async () => {
    if (!campaignId || !user) return;
    setLoading(true);
    setError(null);
    const sb = supabase as any;
    try {
      // Fetch everything in parallel. RLS handles visibility — anything
      // the user can't see simply doesn't come back. Promise.allSettled
      // is used instead of Promise.all so a single failed query (e.g.
      // narrative_ai_suggestions when the table doesn't exist yet
      // because migrations haven't been applied) can't bring down the
      // whole hydrate. Previously a single rejected promise left the
      // page stuck on the skeleton with no way out.
      const results = await Promise.allSettled([
        sb.from('narrative_campaigns').select('*').eq('id', campaignId).maybeSingle(),
        sb.from('narrative_campaign_members').select('*').eq('campaign_id', campaignId),
        sb.from('narrative_characters').select('*').eq('campaign_id', campaignId),
        sb.from('narrative_scenes').select('*').eq('campaign_id', campaignId).order('position', { ascending: true }),
        sb.from('narrative_messages').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true }).limit(200),
        sb.from('narrative_npcs').select('*').eq('campaign_id', campaignId),
        sb.from('narrative_factions').select('*').eq('campaign_id', campaignId),
        sb.from('narrative_clocks').select('*').eq('campaign_id', campaignId),
        sb.from('narrative_clues').select('*').eq('campaign_id', campaignId),
        sb.from('narrative_items').select('*').eq('campaign_id', campaignId),
        sb.from('narrative_locations').select('*').eq('campaign_id', campaignId),
        sb.from('narrative_ai_suggestions').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false }),
      ]);
      const [
        campRes, membersRes, charactersRes, scenesRes, messagesRes,
        npcsRes, factionsRes, clocksRes, cluesRes, itemsRes, locsRes,
        aiRes,
      ] = results;
      // Pull `.value.data` for fulfilled, fall back to [] / null for
      // rejected. Each query is independent — empty data is fine.
      const pickRow = (r: typeof campRes) => r.status === 'fulfilled' ? (r.value as any)?.data ?? null : null;
      const pickList = <T,>(r: PromiseSettledResult<any>): T[] =>
        r.status === 'fulfilled' ? ((r.value as any)?.data ?? []) as T[] : [];

      // Campaign row is the one query we MUST have. If it failed AND
      // returned an error message, surface it so the page can show
      // "Campaign not found / can't load" instead of the skeleton.
      if (campRes.status === 'fulfilled') {
        const cv = campRes.value as any;
        if (cv?.error) setError(cv.error.message);
      } else if (campRes.status === 'rejected') {
        setError(campRes.reason?.message ?? 'Failed to load campaign');
      }

      setCampaign(pickRow(campRes) as Campaign | null);
      setMembers(pickList<CampaignMember>(membersRes));
      setCharacters(pickList<Character>(charactersRes));
      setScenes(pickList<Scene>(scenesRes));
      setMessages(pickList<Message>(messagesRes));
      setNpcs(pickList<NPC>(npcsRes));
      setFactions(pickList<Faction>(factionsRes));
      setClocks(pickList<Clock>(clocksRes));
      setClues(pickList<Clue>(cluesRes));
      setItems(pickList<Item>(itemsRes));
      setLocations(pickList<NarrativeLocation>(locsRes));
      setAiSuggestions(pickList<AiSuggestionRow>(aiRes));

      // Log any rejected sub-queries to the console so we can spot
      // which table is the troublemaker without breaking the page.
      const rejected = results
        .map((r, i) => r.status === 'rejected' ? `${i}: ${r.reason?.message ?? 'unknown'}` : null)
        .filter(Boolean);
      if (rejected.length > 0) {
        console.warn('[useNarrativeCampaign] partial hydrate — failed queries:', rejected);
      }
    } catch (e) {
      // Should be unreachable now that we use allSettled, but a
      // belt-and-suspenders catch makes sure setLoading(false) always
      // runs even if something earlier in the function throws.
      console.error('[useNarrativeCampaign] refresh threw:', e);
      setError((e as Error).message ?? 'Failed to load campaign');
    } finally {
      // ALWAYS clear loading — fixes the permanent-skeleton bug where
      // a single rejected query left the page stuck on the loading
      // state with no way to recover short of a full reload.
      setLoading(false);
    }
  }, [campaignId, user]);

  useEffect(() => { refresh(); }, [refresh]);

  // The seed-attempt ref lives here so it persists across renders;
  // the actual effect that uses it runs further down after isGm has
  // been computed (TDZ rules mean we can't reference isGm above its
  // const declaration even from inside a callback).
  const seedAttemptedRef = useRef(false);

  // Real-time: messages, clocks, scenes, ai_suggestions PLUS every
  // GM-managed entity (characters, NPCs, clues, factions, items,
  // locations) so when the GM creates an NPC or a player creates their
  // character, other viewers see it without a manual refresh. RLS
  // still gates the payload — non-authorized viewers won't receive
  // gm_only rows.
  useEffect(() => {
    if (!campaignId) return;
    // Generic helper: bind INSERT + UPDATE + DELETE handlers for a
    // table to a stateful array setter. Keeps the channel registration
    // declarative.
    type Row = { id: string };
    type Setter<T> = (updater: (prev: T[]) => T[]) => void;
    const wireCrud = <T extends Row>(
      ch: any,
      table: string,
      setter: Setter<T>,
      /** When true, INSERT + UPDATE events flash a 2.4s highlight on
       *  the affected row so the UI can pulse it. Tables: clocks,
       *  factions, clues, items, locations. Skipped for messages
       *  (every message would flash) and members (high-volume joins). */
      withFlash = false,
    ) => ch
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => {
          setter(prev => prev.some(r => r.id === payload.new.id) ? prev : [...prev, payload.new as T]);
          if (withFlash) flashChange(payload.new?.id);
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => {
          setter(prev => prev.map(r => r.id === payload.new.id ? payload.new as T : r));
          if (withFlash) flashChange(payload.new?.id);
        })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table, filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => setter(prev => prev.filter(r => r.id !== payload.old?.id)));

    let ch = (supabase as any).channel(`narrative:${campaignId}`)
      // Messages: INSERT-only (we don't expose edit/delete UI yet).
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'narrative_messages', filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => setMessages(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new as Message]))
      // Scenes: also catch INSERT so newly-started scenes appear
      // immediately. (UPDATE was already covered for the active
      // scene transition.)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'narrative_scenes', filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => setScenes(prev => prev.some(s => s.id === payload.new.id) ? prev : [...prev, payload.new as Scene]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'narrative_scenes', filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => setScenes(prev => prev.map(s => s.id === payload.new.id ? payload.new as Scene : s)))
      // Campaign row: pick up status / current_scene_id / live_session
      // changes (e.g. GM ends a campaign, or starts a live session).
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'narrative_campaigns', filter: `id=eq.${campaignId}` },
        (payload: any) => setCampaign(payload.new as Campaign));
    ch = wireCrud<Clock>(ch, 'narrative_clocks', setClocks, true);
    ch = wireCrud<Character>(ch, 'narrative_characters', setCharacters);
    ch = wireCrud<NPC>(ch, 'narrative_npcs', setNpcs, true);
    ch = wireCrud<Clue>(ch, 'narrative_clues', setClues, true);
    ch = wireCrud<Faction>(ch, 'narrative_factions', setFactions, true);
    ch = wireCrud<Item>(ch, 'narrative_items', setItems, true);
    ch = wireCrud<NarrativeLocation>(ch, 'narrative_locations', setLocations, true);
    ch = wireCrud<CampaignMember>(ch, 'narrative_campaign_members', setMembers);
    ch = ch
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'narrative_ai_suggestions', filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => setAiSuggestions(prev => prev.some(s => s.id === payload.new.id) ? prev : [payload.new as AiSuggestionRow, ...prev]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'narrative_ai_suggestions', filter: `campaign_id=eq.${campaignId}` },
        (payload: any) => setAiSuggestions(prev => prev.map(s => s.id === payload.new.id ? payload.new as AiSuggestionRow : s)))
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [campaignId, flashChange]);

  /* ── Derived ─────────────────────────────────────────────── */

  const myRole: 'game_master' | 'player' | 'spectator' | null = useMemo(() => {
    if (!user) return null;
    if (campaign?.gm_id === user.id) return 'game_master';
    const m = members.find(m => m.user_id === user.id && m.status === 'active');
    return (m?.role ?? null) as any;
  }, [user, campaign?.gm_id, members]);

  const isGm = myRole === 'game_master';

  // ─── Backfill: ensure the campaign's world has been seeded from its
  // template. Older Flamingo Protocol campaigns created before the
  // seeder shipped will have empty World tabs; this fires once after
  // data loads and idempotently fills in any missing starter content.
  //
  // Guards:
  //   • Only the GM, the campaign creator, or a club admin can write
  //     to the world tables; for everyone else this is a no-op (the
  //     RLS-protected inserts would fail anyway).
  //   • Skipped for blank-template campaigns (seeder short-circuits
  //     when there's nothing to seed).
  //   • Skipped once we've seen a successful pass during this mount.
  //   • Refreshes the local data once after a successful repair so
  //     the new rows hydrate the UI immediately.
  useEffect(() => {
    if (seedAttemptedRef.current) return;
    if (loading) return;
    if (!campaign || !user) return;
    const canWrite =
      isGm
      || campaign.gm_id === user.id
      || campaign.created_by === user.id
      || (campaign as any).proposed_gm_id === user.id;
    if (!canWrite) return;
    seedAttemptedRef.current = true;
    (async () => {
      // Auto-repair runs metadata-only (tone_profile + canon_locks).
      // We intentionally don't pass includeStarterAssets:true here —
      // existing campaigns shouldn't be surprised by 28 new rows on
      // next load. Starter assets are an explicit opt-in via the
      // GM onboarding sheet.
      const report = await ensureCampaignWorldSeeded(campaign.id, campaign.template_key, {});
      if (report.changed) {
        await refresh();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, campaign?.id, isGm]);

  const myCharacter = useMemo(
    () => characters.find(c => c.owner_id === user?.id && !c.is_retired) ?? null,
    [characters, user?.id],
  );

  const currentScene = useMemo(
    () => scenes.find(s => s.id === campaign?.current_scene_id)
        ?? scenes.find(s => s.status === 'active')
        ?? null,
    [scenes, campaign?.current_scene_id],
  );

  /* ── Mutators: messages ──────────────────────────────────── */

  const postMessage = useCallback(async (input: PostMessageInput): Promise<Message | null> => {
    if (!user || !campaignId) return null;
    const row = {
      campaign_id: campaignId,
      scene_id: input.scene_id ?? currentScene?.id ?? null,
      sender_id: user.id,
      character_id: input.character_id ?? null,
      message_type: input.message_type,
      body: input.body,
      visibility: input.visibility ?? 'public',
      metadata: input.metadata ?? {},
    };
    const { data, error: err } = await (supabase as any)
      .from('narrative_messages').insert(row).select('*').single();
    if (err) { setError(err.message); return null; }
    return data as Message;
  }, [user, campaignId, currentScene?.id]);

  const rollDice = useCallback(async (input: RollDiceInput): Promise<Message | null> => {
    if (!user || !campaignId) return null;
    const result = rollChronicle({
      stat: input.stat,
      statValue: input.statValue,
      modifier: input.modifier ?? 0,
      difficulty: input.difficulty ?? 0,
      advantage: input.advantage ?? 'none',
    });
    // 1. Insert message of type dice_roll with metadata payload
    const messageRow = {
      campaign_id: campaignId,
      scene_id: input.scene_id ?? currentScene?.id ?? null,
      sender_id: user.id,
      character_id: input.character_id ?? null,
      message_type: 'dice_roll' as MessageType,
      body: input.reason ?? null,
      visibility: input.visibility ?? 'public',
      metadata: {
        stat: input.stat,
        stat_value: input.statValue,
        modifier: input.modifier ?? 0,
        difficulty: input.difficulty ?? 0,
        advantage: input.advantage ?? 'none',
        d20: result.d20,
        secondary_d20: result.secondaryD20 ?? null,
        total: result.total,
        outcome: result.outcome,
        outcome_label: result.outcomeLabel,
      },
    };
    const { data: msg, error: msgErr } = await (supabase as any)
      .from('narrative_messages').insert(messageRow).select('*').single();
    if (msgErr || !msg) { setError(msgErr?.message ?? 'roll failed'); return null; }
    // 2. Insert dedicated roll row for analytics
    await (supabase as any).from('narrative_rolls').insert({
      campaign_id: campaignId,
      scene_id: messageRow.scene_id,
      message_id: msg.id,
      roller_id: user.id,
      character_id: input.character_id ?? null,
      stat: input.stat,
      modifier: input.modifier ?? 0,
      difficulty: input.difficulty ?? 0,
      advantage: input.advantage ?? 'none',
      d20: result.d20,
      total: result.total,
      outcome: result.outcome,
      reason: input.reason ?? null,
      visibility: input.visibility ?? 'public',
    });
    return msg as Message;
  }, [user, campaignId, currentScene?.id]);

  /* ── Mutators: character ─────────────────────────────────── */

  const createCharacter = useCallback(async (c: Omit<Character, 'id' | 'created_at' | 'updated_at' | 'campaign_id' | 'owner_id' | 'is_retired'>): Promise<Character | null> => {
    if (!user || !campaignId) return null;
    const row = { ...c, campaign_id: campaignId, owner_id: user.id, is_retired: false };
    const { data, error: err } = await (supabase as any)
      .from('narrative_characters').insert(row).select('*').single();
    if (err) { setError(err.message); return null; }
    await refresh();
    return data as Character;
  }, [user, campaignId, refresh]);

  const updateCharacter = useCallback(async (id: string, patch: Partial<Character>): Promise<boolean> => {
    const { error: err } = await (supabase as any)
      .from('narrative_characters').update(patch).eq('id', id);
    if (err) { setError(err.message); return false; }
    await refresh();
    return true;
  }, [refresh]);

  /* ── Mutators: GM ────────────────────────────────────────── */

  const createScene = useCallback(async (input: Parameters<UseNarrativeCampaignResult['createScene']>[0]) => {
    if (!user || !campaignId) return null;
    const { data, error: err } = await (supabase as any)
      .from('narrative_scenes').insert({
        campaign_id: campaignId,
        title: input.title,
        location: input.location ?? null,
        stakes: input.stakes ?? null,
        objective: input.objective ?? null,
        public_notes: input.public_notes ?? null,
        gm_notes: input.gm_notes ?? null,
        status: 'active',
        position: scenes.length,
        created_by: user.id,
      }).select('*').single();
    if (err || !data) { setError(err?.message ?? 'scene create failed'); return null; }
    // Make it the current scene
    await (supabase as any).from('narrative_campaigns')
      .update({ current_scene_id: data.id }).eq('id', campaignId);
    // System message
    await (supabase as any).from('narrative_messages').insert({
      campaign_id: campaignId,
      scene_id: data.id,
      sender_id: user.id,
      message_type: 'scene_card',
      body: input.title,
      visibility: 'public',
      metadata: { location: input.location ?? null, objective: input.objective ?? null, stakes: input.stakes ?? null },
    });
    await refresh();
    return data as Scene;
  }, [user, campaignId, scenes.length, refresh]);

  const endScene = useCallback(async (sceneId: string): Promise<boolean> => {
    const { error: err } = await (supabase as any).from('narrative_scenes')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', sceneId);
    if (err) { setError(err.message); return false; }
    await refresh();
    return true;
  }, [refresh]);

  const advanceClock = useCallback(async (clockId: string, delta: number, note?: string): Promise<boolean> => {
    if (!campaignId) return false;
    const clock = clocks.find(c => c.id === clockId);
    if (!clock) return false;
    // Atomic clamp + history append via RPC so concurrent advances
    // accumulate correctly. The RPC enforces GM/admin authorization
    // server-side.
    const { data, error: err } = await (supabase as any).rpc('advance_narrative_clock', {
      _campaign_id: campaignId,
      _clock_id:    clockId,
      _delta:       delta,
      _note:        note ?? null,
    });
    if (err) { setError(err.message); return false; }
    // RPC returns the updated row (or array of one) depending on
    // supabase-js codegen — normalize.
    const updated = Array.isArray(data) ? data[0] : data;
    const next = (updated?.current_value ?? clock.current_value) as number;
    // Public clocks emit a system message; gm_only stay silent.
    // Suppress the system message when the clamped advance was a no-op
    // (clock was already at the boundary).
    if (clock.visibility === 'public' && user && next !== clock.current_value) {
      await (supabase as any).from('narrative_messages').insert({
        campaign_id: campaignId,
        scene_id: currentScene?.id ?? null,
        sender_id: user.id,
        message_type: 'clock_update',
        body: `${clock.name}: ${next}/${clock.max_value}`,
        visibility: 'public',
        metadata: { clock_id: clockId, from: clock.current_value, to: next, note: note ?? null },
      });
    }
    return true;
  }, [clocks, campaignId, user, currentScene?.id]);

  const createClock = useCallback(async (input: Parameters<UseNarrativeCampaignResult['createClock']>[0]) => {
    if (!user || !campaignId) return null;
    const { data, error: err } = await (supabase as any).from('narrative_clocks').insert({
      campaign_id: campaignId,
      name: input.name,
      description: input.description ?? null,
      current_value: 0,
      max_value: input.max_value,
      clock_type: input.clock_type,
      visibility: input.visibility,
      created_by: user.id,
    }).select('*').single();
    if (err) { setError(err.message); return null; }
    await refresh();
    return data as Clock;
  }, [user, campaignId, refresh]);

  // Generic helper for the simple "create row" GM ops below.
  const createInTable = useCallback(async <T extends { id?: string }>(table: string, payload: Record<string, unknown>): Promise<T | null> => {
    if (!campaignId) return null;
    const { data, error: err } = await (supabase as any).from(table)
      .insert({ campaign_id: campaignId, ...payload })
      .select('*').single();
    if (err) { setError(err.message); return null; }
    await refresh();
    return data as T;
  }, [campaignId, refresh]);

  const setWaitingOn = useCallback(async (next: { mode: 'all' | 'specific' | null; player_ids?: string[]; required?: boolean }): Promise<boolean> => {
    if (!campaignId) return false;
    // Build the jsonb payload. When clearing, write an empty object so
    // computeCampaignStatus falls through to the heuristic. When
    // setting, stamp `since` so the UI can show "waiting since 4h ago".
    const payload = next.mode === null
      ? {}
      : {
          mode: next.mode,
          player_ids: next.mode === 'specific' ? (next.player_ids ?? []) : [],
          required: next.required ?? true,
          since: new Date().toISOString(),
        };
    const { error: err } = await (supabase as any)
      .from('narrative_campaigns')
      .update({ waiting_on_state: payload })
      .eq('id', campaignId);
    if (err) { setError(err.message); return false; }
    // Realtime UPDATE subscription on narrative_campaigns will catch
    // this and refresh the campaign row for every viewer.
    return true;
  }, [campaignId]);

  const createNpc      = useCallback((i: Partial<NPC> & { name: string })      => createInTable<NPC>('narrative_npcs', i),                              [createInTable]);
  const createClue     = useCallback((i: Partial<Clue> & { name: string })     => createInTable<Clue>('narrative_clues', i),                            [createInTable]);
  const createFaction  = useCallback((i: Partial<Faction> & { name: string })  => createInTable<Faction>('narrative_factions', i),                      [createInTable]);
  const createItem     = useCallback((i: Partial<Item> & { name: string })     => createInTable<Item>('narrative_items', i),                            [createInTable]);
  const createLocation = useCallback((i: Partial<NarrativeLocation> & { name: string }) => createInTable<NarrativeLocation>('narrative_locations', i), [createInTable]);

  return {
    campaign, myRole, isGm,
    members, characters, myCharacter, currentScene, scenes,
    messages, npcs, factions, clocks, clues, items, locations,
    aiSuggestions,
    recentlyChanged,
    loading, error, refresh,
    postMessage, rollDice,
    createCharacter, updateCharacter,
    createScene, endScene, advanceClock, createClock,
    createNpc, createClue, createFaction, createItem, createLocation,
    setWaitingOn,
  };
}
