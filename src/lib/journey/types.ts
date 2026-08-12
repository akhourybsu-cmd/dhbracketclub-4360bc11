// THE SPLENDID JOURNEY of Unimaginable Consequence
// ------------------------------------------------
// Campaign Definition Format (CDF) + runtime state types.
//
// The CDF is the *authoring contract*: a campaign is a plain JSON package
// that can be produced externally (narrative workflows, Claude/Lovable) and
// imported verbatim via the `journey_import_campaign` RPC. The narrative
// engine never needs changes to accept new campaign content.

/* ── Requirements ─────────────────────────────────────────────── */

export type RequirementType =
  | 'flag_equals' | 'flag_exists' | 'flag_not_exists'
  | 'has_item' | 'does_not_have_item'
  | 'stat_minimum' | 'stat_maximum'
  | 'variable_equals' | 'campaign_variable_equals' | 'variable_minimum' | 'variable_maximum'
  | 'relationship_minimum' | 'relationship_maximum'
  | 'faction_reputation_minimum' | 'faction_reputation_maximum'
  | 'quest_status'
  | 'has_trait' | 'has_ability'
  | 'level_minimum'
  | 'previous_choice'
  | 'character_alive' | 'character_dead'
  | 'world_state_equals'
  | 'codex_unlocked' | 'location_visited'
  | 'health_minimum';

export interface LeafRequirement {
  type: RequirementType;
  key?: string;
  value?: string | number | boolean;
  /** Author-facing explanation shown on locked choices. */
  label?: string;
}

export interface GroupRequirement {
  type: 'all' | 'any' | 'not' | 'and' | 'or';
  conditions: Requirement[];
  label?: string;
}

export type Requirement = LeafRequirement | GroupRequirement;

export const GROUP_TYPES = ['all', 'any', 'not', 'and', 'or'] as const;
export function isGroup(r: Requirement): r is GroupRequirement {
  return (GROUP_TYPES as readonly string[]).includes(r.type);
}

/* ── Effects ──────────────────────────────────────────────────── */

export type EffectType =
  | 'set_flag' | 'unset_flag'
  | 'set_variable' | 'increment_variable' | 'decrement_variable'
  | 'add_item' | 'remove_item'
  | 'gain_gold' | 'lose_gold' | 'gain_xp'
  | 'increase_stat' | 'decrease_stat'
  | 'increase_relationship' | 'decrease_relationship' | 'set_relationship'
  | 'increase_faction_reputation' | 'decrease_faction_reputation'
  | 'start_quest' | 'advance_quest' | 'complete_quest' | 'fail_quest'
  | 'unlock_codex' | 'unlock_location' | 'visit_location'
  | 'unlock_trait' | 'unlock_ability'
  | 'damage_player' | 'heal_player'
  | 'change_world_state'
  | 'character_alive' | 'character_dead';

export interface Effect {
  type: EffectType;
  key?: string;
  value?: string | number | boolean;
  step?: string;
  /** Optional player-facing note ("Journal updated"). */
  notice?: string;
}

/* ── Campaign package ─────────────────────────────────────────── */

export type CampaignStatus = 'draft' | 'testing' | 'published' | 'archived';

export type BlockType =
  | 'narration' | 'dialogue' | 'image' | 'location_intro' | 'character_intro'
  | 'discovery' | 'system_message' | 'quest_update' | 'item_received'
  | 'relationship_update' | 'codex_unlock' | 'stat_check' | 'combat'
  | 'divider' | 'transition';

export type ChoiceStyle =
  | 'standard' | 'dialogue' | 'aggressive' | 'compassionate' | 'deceptive'
  | 'investigative' | 'skill' | 'item' | 'relationship' | 'secret' | 'major_decision';

export interface CampaignMetaDef {
  slug: string;
  title: string;
  subtitle?: string;
  description?: string;
  cover_image?: string;
  hero_image?: string;
  status?: CampaignStatus;
  version?: number;
  author?: string;
  estimated_length?: string;
  minimum_level?: number;
  recommended_level?: number;
  starting_scene_key: string;
  content_notes?: string;
  config?: Record<string, unknown>;
  tags?: string[];
  author_notes?: string;
}

export interface ActDef { act_key: string; title: string; subtitle?: string; display_order?: number; author_notes?: string }
export interface ChapterDef {
  chapter_key: string; act_key?: string; title: string; subtitle?: string;
  intro_text?: string; artwork?: string; display_order?: number; author_notes?: string;
}

export interface BlockDef {
  block_type: BlockType;
  display_order?: number;
  content?: string;
  /** dialogue: speaker_key / speaker_name / portrait / emotion / style
   *  combat:   enemy_keys[], victory_choice_key, defeat_choice_key, escape_choice_key
   *  image:    src, alt, caption */
  metadata?: Record<string, unknown>;
  conditions?: Requirement | Requirement[] | null;
}

export interface ChoiceDef {
  choice_key: string;
  choice_text: string;
  short_label?: string;
  description?: string;
  display_order?: number;
  next_scene_key?: string;
  choice_style?: ChoiceStyle;
  confirmation_required?: boolean;
  hidden_when_unavailable?: boolean;
  locked_hint?: string;
  major_decision?: boolean;
  once_only?: boolean;
  requirements?: Requirement | Requirement[] | null;
  effects?: Effect[];
  tags?: string[];
  author_notes?: string;
}

export interface SceneDef {
  scene_key: string;
  chapter_key?: string;
  scene_type?: 'narrative' | 'dialogue' | 'exploration' | 'combat' | 'hub' | 'transition' | 'ending';
  title?: string;
  subtitle?: string;
  location_key?: string;
  background_asset?: string;
  ambient_audio?: string;
  music_track?: string;
  entry_effects?: Effect[];
  entry_conditions?: Requirement | Requirement[] | null;
  auto_next_scene_key?: string;
  is_terminal?: boolean;
  ending_key?: string;
  display_order?: number;
  tags?: string[];
  author_notes?: string;
  blocks?: BlockDef[];
  choices?: ChoiceDef[];
}

export interface NpcDef { npc_key: string; name: string; title?: string; description?: string; portrait?: string; faction_key?: string; biography?: string; codex_key?: string; metadata?: Record<string, unknown>; author_notes?: string }
export interface ItemDef { item_key: string; name: string; description?: string; icon?: string; image?: string; item_type?: string; rarity?: string; stackable?: boolean; max_stack?: number; usable?: boolean; quest_item?: boolean; metadata?: Record<string, unknown>; author_notes?: string }
export interface QuestDef { quest_key: string; title: string; description?: string; quest_type?: 'main' | 'side' | 'hidden' | 'companion'; objectives?: { key: string; text: string }[]; rewards?: unknown[]; hidden_until_discovered?: boolean; author_notes?: string }
export interface LocationDef { location_key: string; name: string; region?: string; description?: string; image?: string; ambient_audio?: string; map_position?: Record<string, unknown>; codex_key?: string; metadata?: Record<string, unknown>; author_notes?: string }
export interface CodexDef { codex_key: string; title: string; category?: string; body?: string; image?: string; display_order?: number; author_notes?: string }
export interface VariableDef { variable_key: string; label?: string; value_type?: 'boolean' | 'integer' | 'decimal' | 'string' | 'enum'; default_value?: unknown; enum_values?: string[]; author_notes?: string }
export interface FactionDef { faction_key: string; name: string; description?: string; image?: string; author_notes?: string }
export interface EnemyDef { enemy_key: string; name: string; description?: string; portrait?: string; max_health?: number; armor?: number; attack?: number; abilities?: unknown[]; metadata?: Record<string, unknown>; author_notes?: string }
export interface EndingDef { ending_key: string; name: string; description?: string; priority?: number; requirements?: Requirement | Requirement[] | null; epilogue_blocks?: { requirements?: Requirement | Requirement[] | null; content: string }[]; spoiler_safe_label?: string; author_notes?: string }

/** The complete machine-readable campaign package. */
export interface CampaignPackage {
  campaign: CampaignMetaDef;
  acts?: ActDef[];
  chapters?: ChapterDef[];
  scenes: SceneDef[];
  npcs?: NpcDef[];
  items?: ItemDef[];
  quests?: QuestDef[];
  locations?: LocationDef[];
  codex?: CodexDef[];
  variables?: VariableDef[];
  factions?: FactionDef[];
  enemies?: EnemyDef[];
  endings?: EndingDef[];
}

/* ── Runtime state ────────────────────────────────────────────── */

export interface QuestState { status: 'not_started' | 'active' | 'completed' | 'failed' | 'abandoned'; step?: string }

export interface RunState {
  flags: Record<string, unknown>;
  variables: Record<string, unknown>;
  inventory: Record<string, number>;
  relationships: Record<string, number>;
  factions: Record<string, number>;
  quests: Record<string, QuestState>;
  codex: string[];
  locations: string[];
  visited_locations: string[];
  npc_status: Record<string, string>;
  world: Record<string, string>;
  choices_made: string[];
  traits: string[];
  abilities: string[];
  stats: Record<string, number>;
  health: number;
  max_health: number;
  xp: number;
  level: number;
  gold: number;
  hero_name?: string;
}

export const EMPTY_RUN_STATE: RunState = {
  flags: {}, variables: {}, inventory: {}, relationships: {}, factions: {}, quests: {},
  codex: [], locations: [], visited_locations: [], npc_status: {}, world: {},
  choices_made: [], traits: [], abilities: [],
  stats: { might: 2, finesse: 2, wits: 2, resolve: 2 },
  health: 20, max_health: 20, xp: 0, level: 1, gold: 0,
};

/* ── DB row shapes (hand-typed until generated types exist) ───── */

export interface CampaignRow extends CampaignMetaDef {
  id: string;
  status: CampaignStatus;
  version: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SceneRow {
  id: string; campaign_id: string; chapter_id: string | null; scene_key: string;
  scene_type: string; title: string | null; subtitle: string | null; location_key: string | null;
  background_asset: string | null; ambient_audio: string | null; music_track: string | null;
  entry_effects: Effect[]; entry_conditions: Requirement | null; auto_next_scene_key: string | null;
  is_terminal: boolean; ending_key: string | null; display_order: number; tags: string[]; author_notes: string | null;
}

export interface BlockRow {
  id: string; scene_id: string; block_type: BlockType; display_order: number;
  content: string | null; metadata: Record<string, unknown>; conditions: Requirement | null;
}

export interface ChoiceRow {
  id: string; campaign_id: string; scene_id: string; choice_key: string; choice_text: string;
  short_label: string | null; description: string | null; display_order: number;
  next_scene_key: string | null; choice_style: ChoiceStyle; confirmation_required: boolean;
  hidden_when_unavailable: boolean; locked_hint: string | null; major_decision: boolean;
  once_only: boolean; requirements: Requirement | null; effects: Effect[]; tags: string[]; author_notes: string | null;
}

export interface RunRow {
  id: string; user_id: string; campaign_id: string; campaign_version: number;
  character_id: string | null; current_scene_key: string | null; current_chapter_key: string | null;
  status: 'active' | 'completed' | 'abandoned' | 'archived';
  is_test_run: boolean; state: RunState; ending_key: string | null;
  playtime_seconds: number; run_number: number;
  started_at: string; last_played_at: string; completed_at: string | null;
}

export interface HeroRow {
  id: string; user_id: string; name: string; portrait: string | null; pronouns: string | null;
  origin: string | null; background: string | null; level: number; xp: number;
  stats: Record<string, number>; traits: string[]; abilities: string[];
  health: number; max_health: number; currency: number; equipment: Record<string, unknown>;
  created_at: string; updated_at: string;
}
