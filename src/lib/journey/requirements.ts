// Requirement engine — the single source of truth on the client.
// Mirrors public.journey_eval_requirements() in SQL exactly. The server
// remains authoritative; this copy powers choice presentation (hidden vs
// locked), block conditions, combat actions, location access and epilogue
// selection so we never grow a second rules system.

import type { Requirement, RunState, LeafRequirement } from './types';
import { isGroup } from './types';

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

function evalLeaf(r: LeafRequirement, s: RunState): boolean {
  const key = r.key ?? '';
  switch (r.type) {
    case 'flag_equals': {
      const expected = r.value === undefined ? true : r.value;
      return (s.flags?.[key] ?? null) === expected;
    }
    case 'flag_exists':
      return Boolean(s.flags?.[key]);
    case 'flag_not_exists':
      return !s.flags?.[key];
    case 'has_item':
      return num(s.inventory?.[key]) >= num(r.value, 1);
    case 'does_not_have_item':
      return num(s.inventory?.[key]) < num(r.value, 1);
    case 'stat_minimum':
      return num(s.stats?.[key]) >= num(r.value);
    case 'stat_maximum':
      return num(s.stats?.[key]) <= num(r.value);
    case 'variable_equals':
    case 'campaign_variable_equals':
      return String(s.variables?.[key] ?? '') === String(r.value ?? '');
    case 'variable_minimum':
      return num(s.variables?.[key]) >= num(r.value);
    case 'variable_maximum':
      return num(s.variables?.[key]) <= num(r.value);
    case 'relationship_minimum':
      return num(s.relationships?.[key]) >= num(r.value);
    case 'relationship_maximum':
      return num(s.relationships?.[key]) <= num(r.value);
    case 'faction_reputation_minimum':
      return num(s.factions?.[key]) >= num(r.value);
    case 'faction_reputation_maximum':
      return num(s.factions?.[key]) <= num(r.value);
    case 'quest_status':
      return (s.quests?.[key]?.status ?? 'not_started') === String(r.value ?? 'active');
    case 'has_trait':
      return (s.traits ?? []).includes(key);
    case 'has_ability':
      return (s.abilities ?? []).includes(key);
    case 'level_minimum':
      return num(s.level, 1) >= num(r.value, 1);
    case 'previous_choice':
      return (s.choices_made ?? []).includes(key);
    case 'character_alive':
      return (s.npc_status?.[key] ?? 'alive') !== 'dead';
    case 'character_dead':
      return (s.npc_status?.[key] ?? 'alive') === 'dead';
    case 'world_state_equals':
      return String(s.world?.[key] ?? '') === String(r.value ?? '');
    case 'codex_unlocked':
      return (s.codex ?? []).includes(key);
    case 'location_visited':
      return (s.visited_locations ?? []).includes(key);
    case 'health_minimum':
      return num(s.health) >= num(r.value);
    default:
      // Unknown requirement types fail closed (same as SQL).
      return false;
  }
}

/** Evaluate one requirement, a group, an array (implicit ALL) or null. */
export function evaluateRequirements(
  req: Requirement | Requirement[] | null | undefined,
  state: RunState,
): boolean {
  if (req == null) return true;
  if (Array.isArray(req)) return req.every((r) => evaluateRequirements(r, state));
  if (isGroup(req)) {
    const conditions = req.conditions ?? [];
    if (req.type === 'all' || req.type === 'and') return conditions.every((c) => evaluateRequirements(c, state));
    if (req.type === 'any' || req.type === 'or') return conditions.some((c) => evaluateRequirements(c, state));
    return !conditions.some((c) => evaluateRequirements(c, state)); // not
  }
  return evalLeaf(req, state);
}

/** Human-readable summary used for locked-choice hints and Studio display. */
export function describeRequirement(req: Requirement | Requirement[] | null | undefined): string {
  if (req == null) return '';
  if (Array.isArray(req)) return req.map(describeRequirement).filter(Boolean).join(' · ');
  if (isGroup(req)) {
    const join = req.type === 'any' || req.type === 'or' ? ' or ' : ' and ';
    const inner = (req.conditions ?? []).map(describeRequirement).filter(Boolean).join(join);
    return req.type === 'not' ? `not (${inner})` : inner;
  }
  if (req.label) return req.label;
  const k = req.key ?? '';
  switch (req.type) {
    case 'stat_minimum':   return `${k} ${req.value}+`;
    case 'has_item':       return `Requires ${k}`;
    case 'relationship_minimum': return `${k} trust ${req.value}+`;
    case 'level_minimum':  return `Level ${req.value}+`;
    case 'flag_exists':    return `Requires ${k}`;
    default:               return `${req.type.replace(/_/g, ' ')} ${k}`.trim();
  }
}
