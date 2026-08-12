// NON-CANON ENGINE TEST CONTENT
// -----------------------------
// Placeholder content whose only job is to exercise every engine system:
// narration, dialogue, three choices (one hidden, one locked by a
// requirement), a flag, an item, a relationship change, a quest update, a
// combat encounter, a reconverging branch and two endings.
//
// Nothing here is Mesoplasia canon. Delete this file and re-import to remove.

import type { CampaignPackage } from './types';

export const ENGINE_TEST_SLUG = 'engine-test-non-canon';

export const ENGINE_TEST_CAMPAIGN: CampaignPackage = {
  campaign: {
    slug: ENGINE_TEST_SLUG,
    title: 'Engine Test',
    subtitle: 'NON-CANON DEVELOPMENT CONTENT',
    description: 'A tiny placeholder scenario used to verify the narrative engine. Not part of Mesoplasia canon.',
    status: 'published',
    version: 1,
    author: 'Development',
    estimated_length: '5 minutes',
    starting_scene_key: 'test_start',
    content_notes: 'Development asset. Safe to delete.',
    tags: ['non_canon', 'engine_test'],
  },
  acts: [{ act_key: 'test_act_1', title: 'Test Act', display_order: 0 }],
  chapters: [{ chapter_key: 'test_ch_1', act_key: 'test_act_1', title: 'Chapter I', subtitle: 'Test Chapter', display_order: 0 }],
  locations: [{ location_key: 'test_ruins', name: 'Test Ruins', region: 'Test Region', description: 'A placeholder location used for engine verification.' }],
  npcs: [{ npc_key: 'test_companion', name: 'Test Companion', title: 'Placeholder Ally', description: 'A placeholder NPC.' }],
  items: [{ item_key: 'test_key', name: 'Test Key', description: 'A placeholder item.', item_type: 'key', quest_item: true }],
  quests: [{
    quest_key: 'test_quest', title: 'Test Quest', quest_type: 'main',
    description: 'Placeholder quest used to verify quest state.',
    objectives: [{ key: 'step_1', text: 'Enter the Test Ruins' }, { key: 'step_2', text: 'Resolve the test encounter' }],
  }],
  codex: [{ codex_key: 'test_lore', title: 'Test Lore Entry', category: 'lore', body: 'Placeholder codex text.' }],
  variables: [{ variable_key: 'test_counter', label: 'Test Counter', value_type: 'integer', default_value: 0 }],
  factions: [{ faction_key: 'test_faction', name: 'Test Faction' }],
  enemies: [{ enemy_key: 'test_construct', name: 'Test Construct', max_health: 12, armor: 1, attack: 3, description: 'A placeholder opponent.' }],
  endings: [
    { ending_key: 'test_ending_a', name: 'Test Ending A', priority: 10, spoiler_safe_label: 'Ending A', description: 'Reached by cooperating with the placeholder NPC.' },
    { ending_key: 'test_ending_b', name: 'Test Ending B', priority: 5, spoiler_safe_label: 'Ending B', description: 'Reached by refusing the placeholder NPC.' },
  ],
  scenes: [
    {
      scene_key: 'test_start',
      chapter_key: 'test_ch_1',
      title: 'Test Ruins',
      subtitle: 'NON-CANON TEST CONTENT',
      location_key: 'test_ruins',
      display_order: 0,
      entry_effects: [
        { type: 'visit_location', key: 'test_ruins' },
        { type: 'start_quest', key: 'test_quest', step: 'step_1', notice: 'Journal updated' },
      ],
      blocks: [
        { block_type: 'location_intro', display_order: 0, content: 'Test Ruins', metadata: { region: 'Test Region' } },
        { block_type: 'narration', display_order: 1, content: 'Placeholder narration block. The engine renders authored prose here, one paragraph at a time.\n\nThis scene exists only to verify that narration, dialogue, choices, requirements and effects behave correctly.' },
        { block_type: 'dialogue', display_order: 2, content: 'Placeholder dialogue line. Take the key, or leave it.', metadata: { speaker_key: 'test_companion', speaker_name: 'Test Companion', emotion: 'neutral' } },
      ],
      choices: [
        {
          choice_key: 'test_take_key', display_order: 0, choice_style: 'investigative',
          choice_text: 'Take the test key.',
          description: 'Grants an item, a flag and a relationship change.',
          next_scene_key: 'test_branch_a',
          effects: [
            { type: 'add_item', key: 'test_key', value: 1, notice: 'Item acquired' },
            { type: 'set_flag', key: 'took_test_key', value: true },
            { type: 'increase_relationship', key: 'test_companion', value: 2 },
            { type: 'advance_quest', key: 'test_quest', step: 'step_2' },
          ],
        },
        {
          choice_key: 'test_leave_key', display_order: 1, choice_style: 'standard',
          choice_text: 'Leave the test key where it lies.',
          next_scene_key: 'test_branch_b',
          effects: [
            { type: 'set_flag', key: 'refused_test_key', value: true },
            { type: 'decrease_relationship', key: 'test_companion', value: 1 },
            { type: 'increment_variable', key: 'test_counter', value: 1 },
          ],
        },
        {
          // LOCKED example — visible but unavailable until the stat is met.
          choice_key: 'test_force_door', display_order: 2, choice_style: 'skill',
          choice_text: 'Force the sealed door.',
          locked_hint: 'Might 4 required',
          hidden_when_unavailable: false,
          requirements: { type: 'stat_minimum', key: 'might', value: 4, label: 'Might 4' },
          next_scene_key: 'test_converge',
          effects: [{ type: 'gain_xp', key: 'xp', value: 10 }],
        },
        {
          // HIDDEN example — never shown unless the flag exists.
          choice_key: 'test_secret', display_order: 3, choice_style: 'secret',
          choice_text: 'Speak the hidden phrase.',
          hidden_when_unavailable: true,
          requirements: { type: 'flag_exists', key: 'knows_test_phrase' },
          next_scene_key: 'test_converge',
          effects: [{ type: 'unlock_codex', key: 'test_lore' }],
        },
      ],
    },
    {
      scene_key: 'test_branch_a',
      chapter_key: 'test_ch_1',
      title: 'Test Branch A',
      display_order: 1,
      blocks: [
        { block_type: 'narration', display_order: 0, content: 'Placeholder branch A narration. This path required the test key.' },
        { block_type: 'system_message', display_order: 1, content: 'Codex entry unlocked: Test Lore Entry.', conditions: { type: 'has_item', key: 'test_key' } },
      ],
      entry_effects: [{ type: 'unlock_codex', key: 'test_lore' }],
      choices: [
        { choice_key: 'test_a_continue', display_order: 0, choice_text: 'Continue toward the test encounter.', next_scene_key: 'test_converge' },
      ],
    },
    {
      scene_key: 'test_branch_b',
      chapter_key: 'test_ch_1',
      title: 'Test Branch B',
      display_order: 2,
      blocks: [
        { block_type: 'narration', display_order: 0, content: 'Placeholder branch B narration. This path skipped the test key.' },
      ],
      choices: [
        { choice_key: 'test_b_continue', display_order: 0, choice_text: 'Continue toward the test encounter.', next_scene_key: 'test_converge' },
      ],
    },
    {
      // Reconvergence point — both branches arrive here.
      scene_key: 'test_converge',
      chapter_key: 'test_ch_1',
      title: 'Test Encounter',
      scene_type: 'combat',
      display_order: 3,
      blocks: [
        { block_type: 'narration', display_order: 0, content: 'Placeholder reconvergence narration. Both branches arrive here.' },
        {
          block_type: 'combat', display_order: 1, content: 'A Test Construct blocks the corridor.',
          metadata: {
            enemy_keys: ['test_construct'],
            victory_choice_key: 'test_combat_victory',
            defeat_choice_key: 'test_combat_defeat',
            narrative_actions: [
              { label: 'Use the Test Key', requirements: { type: 'has_item', key: 'test_key' }, damage: 12, description: 'The key disrupts the construct instantly.' },
            ],
          },
        },
      ],
      choices: [
        {
          choice_key: 'test_combat_victory', display_order: 0, choice_text: 'The construct falls.',
          next_scene_key: 'test_ending_scene_a',
          requirements: { type: 'relationship_minimum', key: 'test_companion', value: 1 },
          hidden_when_unavailable: true,
          effects: [{ type: 'gain_xp', key: 'xp', value: 25 }, { type: 'complete_quest', key: 'test_quest' }],
        },
        {
          choice_key: 'test_combat_defeat', display_order: 1, choice_text: 'You are driven back.',
          next_scene_key: 'test_ending_scene_b',
          hidden_when_unavailable: true,
          effects: [{ type: 'damage_player', key: 'health', value: 5 }, { type: 'fail_quest', key: 'test_quest' }],
        },
        {
          choice_key: 'test_walk_away', display_order: 2, choice_text: 'Walk away from the encounter.',
          next_scene_key: 'test_ending_scene_b',
          effects: [{ type: 'set_flag', key: 'test_walked_away', value: true }],
        },
      ],
    },
    {
      scene_key: 'test_ending_scene_a',
      chapter_key: 'test_ch_1',
      title: 'Test Ending A',
      scene_type: 'ending',
      is_terminal: true,
      ending_key: 'test_ending_a',
      display_order: 4,
      blocks: [{ block_type: 'narration', display_order: 0, content: 'Placeholder ending A. The engine recorded every decision along the way.' }],
    },
    {
      scene_key: 'test_ending_scene_b',
      chapter_key: 'test_ch_1',
      title: 'Test Ending B',
      scene_type: 'ending',
      is_terminal: true,
      ending_key: 'test_ending_b',
      display_order: 5,
      blocks: [{ block_type: 'narration', display_order: 0, content: 'Placeholder ending B. A different path, a different outcome.' }],
    },
  ],
};
