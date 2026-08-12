# The Splendid Journey — Campaign Authoring Contract

A campaign is a single JSON package (the **CDF**) pasted into Campaign Studio
(`/journey/studio` → Import). Nothing in the engine needs to change to accept
new content — if it validates, it plays.

Import is **destructive per slug**: re-importing the same `campaign.slug`
replaces all its content. Published releases are snapshotted, so runs already
in progress keep playing the version they started on.

## Package shape

```jsonc
{
  "campaign": {
    "slug": "the-awakening",              // required, stable, kebab-case
    "title": "The Awakening",
    "subtitle": "Book One of Mesoplasia",
    "description": "...",
    "starting_scene_key": "prologue_01",  // required, must exist in scenes
    "author": "...", "estimated_length": "3–4 hours",
    "content_notes": "...", "tags": ["mesoplasia"],
    "config": {}                           // free-form
  },
  "acts":      [{ "act_key": "act_1", "title": "The Ashen Road", "display_order": 1 }],
  "chapters":  [{ "chapter_key": "ch_1", "act_key": "act_1", "title": "...", "intro_text": "...", "display_order": 1 }],
  "scenes":    [ /* see below — the only required array */ ],
  "npcs":      [{ "npc_key": "vessa", "name": "Vessa", "title": "...", "biography": "..." }],
  "items":     [{ "item_key": "brass_key", "name": "Brass Key", "description": "...", "quest_item": true }],
  "quests":    [{ "quest_key": "q_ashes", "title": "...", "quest_type": "main",
                  "objectives": [{ "key": "find_vessa", "text": "Find Vessa" }] }],
  "locations": [{ "location_key": "greyhollow", "name": "Greyhollow", "region": "The Marches" }],
  "codex":     [{ "codex_key": "the_sundering", "title": "The Sundering", "category": "History", "body": "..." }],
  "variables": [{ "variable_key": "suspicion", "value_type": "integer", "default_value": 0 }],
  "factions":  [{ "faction_key": "wardens", "name": "The Wardens" }],
  "enemies":   [{ "enemy_key": "ash_hound", "name": "Ash Hound", "max_health": 12, "attack": 3, "armor": 0 }],
  "endings":   [{ "ending_key": "ashes", "name": "Ashes", "priority": 10,
                  "requirements": { "type": "flag_exists", "key": "burned_the_hall" },
                  "epilogue_blocks": [{ "content": "..." }] }]
}
```

## Scenes

```jsonc
{
  "scene_key": "prologue_01",          // required, unique per campaign
  "chapter_key": "ch_1",
  "scene_type": "narrative",           // narrative|dialogue|exploration|combat|hub|transition|ending
  "title": "The Ashen Road",
  "subtitle": "Dusk, three days out",
  "location_key": "greyhollow",
  "background_asset": "ashen_road",    // drives atmosphere; tags also work
  "tags": ["night", "forest"],
  "entry_effects": [{ "type": "visit_location", "key": "greyhollow" }],
  "entry_conditions": null,            // if unmet, engine uses the fallback chain
  "auto_next_scene_key": null,         // scene with no choices can chain forward
  "is_terminal": false,                // true = run ends here
  "ending_key": null,                  // resolved endings override this
  "display_order": 1,
  "blocks": [...],
  "choices": [...]
}
```

### Blocks (ordered narrative beats)

`block_type`: `narration` · `dialogue` · `image` · `location_intro` ·
`character_intro` · `discovery` · `system_message` · `quest_update` ·
`item_received` · `relationship_update` · `codex_unlock` · `stat_check` ·
`combat` · `divider` · `transition`

```jsonc
{ "block_type": "narration", "display_order": 1, "content": "Two paragraphs\n\nseparated by blank lines." }
{ "block_type": "dialogue",  "display_order": 2, "content": "You are late.",
  "metadata": { "speaker_key": "vessa", "speaker_name": "Vessa", "emotion": "cold", "portrait": "..." } }
{ "block_type": "image",     "metadata": { "src": "...", "alt": "...", "caption": "..." } }
{ "block_type": "combat",    "content": "Ash hounds circle.",
  "metadata": { "enemy_keys": ["ash_hound"], "victory_choice_key": "...", "defeat_choice_key": "..." } }
{ "block_type": "narration", "content": "Only if you carry the key.",
  "conditions": { "type": "has_item", "key": "brass_key" } }
```

Conditional blocks are filtered **server-side** — hidden text never reaches the client.

### Choices

```jsonc
{
  "choice_key": "take_the_road",       // unique within the scene
  "choice_text": "Take the road east.",
  "description": "Faster, but watched.",
  "display_order": 1,
  "next_scene_key": "road_east_01",    // omit only for terminal scenes
  "choice_style": "standard",          // standard|dialogue|aggressive|compassionate|deceptive|investigative|skill|item|relationship|secret|major_decision
  "major_decision": false,
  "confirmation_required": false,
  "once_only": false,
  "hidden_when_unavailable": false,    // false = shown locked with locked_hint
  "locked_hint": "Requires Wits 4",
  "requirements": { "type": "stat_minimum", "key": "wits", "value": 4 },
  "effects": [
    { "type": "set_flag", "key": "took_road", "value": true },
    { "type": "increase_relationship", "key": "vessa", "value": 1, "notice": "Vessa notices." }
  ]
}
```

## Requirements

Leaf: `{ type, key, value, label }`. Group: `{ type: "all"|"any"|"not", conditions: [...] }`.

`flag_equals` `flag_exists` `flag_not_exists` · `has_item` `does_not_have_item` ·
`stat_minimum` `stat_maximum` · `variable_equals` `campaign_variable_equals`
`variable_minimum` `variable_maximum` · `relationship_minimum` `relationship_maximum` ·
`faction_reputation_minimum` `faction_reputation_maximum` · `quest_status` ·
`has_trait` `has_ability` · `level_minimum` · `previous_choice` ·
`character_alive` `character_dead` · `world_state_equals` · `codex_unlocked` ·
`location_visited` · `health_minimum`

## Effects

`set_flag` `unset_flag` · `set_variable` `increment_variable` `decrement_variable` ·
`add_item` `remove_item` · `gain_gold` `lose_gold` `gain_xp` ·
`increase_stat` `decrease_stat` · `increase_relationship` `decrease_relationship`
`set_relationship` · `increase_faction_reputation` `decrease_faction_reputation` ·
`start_quest` `advance_quest` (`step`) `complete_quest` `fail_quest` ·
`unlock_codex` `unlock_location` `visit_location` · `unlock_trait` `unlock_ability` ·
`damage_player` `heal_player` · `change_world_state` · `character_alive` `character_dead`

Add `"notice": "..."` to surface a player-facing line when the effect fires.

## Default character state

`might` `finesse` `wits` `resolve` all start at 2; health 20/20; level 1; gold 0.
Override per-campaign in `campaign.config` or via `entry_effects` on the first scene.

## Validation gates (must pass before publish)

- `starting_scene_key` exists
- every `next_scene_key` / `auto_next_scene_key` resolves to a real scene
- no non-terminal scene without choices and without `auto_next_scene_key` (dead end)
- scene keys and per-scene choice keys are unique

## Authoring tips

- One scene ≈ one screen. 2–5 blocks, 2–4 choices reads best on mobile.
- Prefer `locked_hint` over hiding — visible locks make progression legible.
- Keep keys stable across drafts; renaming a key breaks in-flight runs.
- Ship content in slices (act by act). Import is idempotent per slug.
