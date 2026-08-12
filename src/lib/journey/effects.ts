// Effect engine — client mirror of public.journey_apply_effects().
//
// The server is authoritative for real runs. This module powers Studio
// previews, combat resolution previews, tests and optimistic UI. Keep the
// two implementations behaviourally identical.

import type { Effect, RunState } from './types';
import { EMPTY_RUN_STATE } from './types';

const num = (v: unknown, fallback = 1): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

const pushUnique = (arr: string[] | undefined, v: string) =>
  (arr ?? []).includes(v) ? (arr ?? []) : [...(arr ?? []), v];

/** Pure: returns a new state; never mutates the input. */
export function applyEffects(effects: Effect[] | null | undefined, state: RunState): RunState {
  if (!effects || effects.length === 0) return state;
  const s: RunState = {
    ...EMPTY_RUN_STATE,
    ...state,
    flags: { ...(state.flags ?? {}) },
    variables: { ...(state.variables ?? {}) },
    inventory: { ...(state.inventory ?? {}) },
    relationships: { ...(state.relationships ?? {}) },
    factions: { ...(state.factions ?? {}) },
    quests: { ...(state.quests ?? {}) },
    npc_status: { ...(state.npc_status ?? {}) },
    world: { ...(state.world ?? {}) },
    stats: { ...(state.stats ?? {}) },
    codex: [...(state.codex ?? [])],
    locations: [...(state.locations ?? [])],
    visited_locations: [...(state.visited_locations ?? [])],
    choices_made: [...(state.choices_made ?? [])],
    traits: [...(state.traits ?? [])],
    abilities: [...(state.abilities ?? [])],
  };

  for (const e of effects) {
    const k = e.key ?? '';
    const amount = num(e.value, 1);
    switch (e.type) {
      case 'set_flag':      s.flags[k] = e.value === undefined ? true : e.value; break;
      case 'unset_flag':    s.flags[k] = false; break;
      case 'set_variable':  s.variables[k] = e.value ?? 0; break;
      case 'increment_variable': s.variables[k] = num(s.variables[k], 0) + amount; break;
      case 'decrement_variable': s.variables[k] = num(s.variables[k], 0) - amount; break;
      case 'add_item':      s.inventory[k] = num(s.inventory[k], 0) + amount; break;
      case 'remove_item':   s.inventory[k] = Math.max(num(s.inventory[k], 0) - amount, 0); break;
      case 'gain_gold':     s.gold = num(s.gold, 0) + amount; break;
      case 'lose_gold':     s.gold = Math.max(num(s.gold, 0) - amount, 0); break;
      case 'gain_xp':       s.xp = num(s.xp, 0) + amount; break;
      case 'increase_stat': s.stats[k] = num(s.stats[k], 0) + amount; break;
      case 'decrease_stat': s.stats[k] = num(s.stats[k], 0) - amount; break;
      case 'increase_relationship': s.relationships[k] = num(s.relationships[k], 0) + amount; break;
      case 'decrease_relationship': s.relationships[k] = num(s.relationships[k], 0) - amount; break;
      case 'set_relationship':      s.relationships[k] = amount; break;
      case 'increase_faction_reputation': s.factions[k] = num(s.factions[k], 0) + amount; break;
      case 'decrease_faction_reputation': s.factions[k] = num(s.factions[k], 0) - amount; break;
      case 'start_quest':
      case 'advance_quest': s.quests[k] = { status: 'active', step: e.step ?? '1' }; break;
      case 'complete_quest': s.quests[k] = { status: 'completed', step: e.step ?? '' }; break;
      case 'fail_quest':     s.quests[k] = { status: 'failed', step: e.step ?? '' }; break;
      case 'unlock_codex':   s.codex = pushUnique(s.codex, k); break;
      case 'unlock_location': s.locations = pushUnique(s.locations, k); break;
      case 'visit_location': s.visited_locations = pushUnique(s.visited_locations, k); break;
      case 'unlock_trait':   s.traits = pushUnique(s.traits, k); break;
      case 'unlock_ability': s.abilities = pushUnique(s.abilities, k); break;
      case 'damage_player':  s.health = Math.max(num(s.health, 0) - amount, 0); break;
      case 'heal_player':    s.health = Math.min(num(s.health, 0) + amount, num(s.max_health, 9999)); break;
      case 'change_world_state': s.world[k] = String(e.value ?? ''); break;
      case 'character_alive': s.npc_status[k] = 'alive'; break;
      case 'character_dead':  s.npc_status[k] = 'dead'; break;
      default: break; // forward compatible
    }
  }
  return s;
}

/** Player-facing notices for the subtle system toasts. */
export function effectNotices(effects: Effect[] | null | undefined): string[] {
  if (!effects) return [];
  const out: string[] = [];
  for (const e of effects) {
    if (e.notice) { out.push(e.notice); continue; }
    switch (e.type) {
      case 'add_item':      out.push('Item acquired'); break;
      case 'unlock_codex':  out.push('Codex entry unlocked'); break;
      case 'unlock_location': out.push('New location discovered'); break;
      case 'start_quest':   out.push('Journal updated'); break;
      case 'complete_quest': out.push('Quest completed'); break;
      case 'fail_quest':    out.push('Quest failed'); break;
      case 'unlock_trait':  out.push('New trait learned'); break;
      case 'unlock_ability': out.push('New ability learned'); break;
      default: break;
    }
  }
  return Array.from(new Set(out));
}
