// Nexus Defense — Mission Modifier System
//
// Modifiers are lightweight, declarative rules attached to a mission. They
// layer on top of (do NOT replace) the calibration system: calibration tunes
// baseline difficulty per-mission, modifiers add tactical variety the player
// can read at a glance.
//
// Design rules:
//   • Each modifier has a stable id (used in telemetry).
//   • Pure data: the engine reads MissionDef.modifiers and applies effects.
//   • Multiplicative effects stack with calibration multiplicatively.
//   • Effects that "specialise" per-tower / per-enemy use record fields.
//   • Keep copy short — it has to read on a 360px phone.

import { AbilityKind, EnemyKind, TowerKind } from './types';

export type ModifierCategory =
  | 'enemies'
  | 'economy'
  | 'towers'
  | 'abilities'
  | 'battlefield';

export type ModifierTone = 'threat' | 'boon' | 'neutral';

export interface ModifierEffect {
  /** Multiply spawned enemy HP. Per-kind overrides allowed. */
  enemyHpMult?: number;
  enemyHpMultByKind?: Partial<Record<EnemyKind, number>>;
  /** Multiply enemy speed (global). */
  enemySpeedMult?: number;
  /** Multiply enemy shield amount on spawn. Per-kind allowed. */
  enemyShieldMult?: number;
  enemyShieldMultByKind?: Partial<Record<EnemyKind, number>>;
  /** Adds shield-per-second regen to a specific kind (e.g. 'shielded'). */
  shieldRegenPerSec?: { kind: EnemyKind; amount: number };
  /** Bounty multiplier on kill. */
  bountyMult?: number;
  /** Flat starting energy bonus/penalty (added on init). */
  startEnergyDelta?: number;
  /** Multiply tower placement cost. Per-kind allowed. */
  towerCostMult?: number;
  towerCostMultByKind?: Partial<Record<TowerKind, number>>;
  /** Multiply tower damage. Per-kind allowed (used at fire-time). */
  towerDamageMult?: number;
  towerDamageMultByKind?: Partial<Record<TowerKind, number>>;
  /** Multiply commander ability cooldown (e.g. 0.75 = 25% faster). */
  abilityCooldownMult?: number;
  abilityCooldownMultByKind?: Partial<Record<AbilityKind, number>>;
  /** Boss-only HP scaling. */
  bossHpMult?: number;
  /** Convenience flag: forces all spawns of `forceStealthKind` to behave as stealth. */
  forceStealthKind?: EnemyKind;
}

export interface ModifierDef {
  id: string;
  label: string;          // <= ~22 chars, all-caps in UI
  short: string;          // 1 line, <= ~60 chars, shown in cards/intel pill
  description: string;    // 1-2 sentences for loadout intel
  category: ModifierCategory;
  tone: ModifierTone;
  glyph: string;          // single emoji/symbol
  effect: ModifierEffect;
}

/* ---------- Registry ---------- */

export const MODIFIERS: Record<string, ModifierDef> = {
  reinforced_hulls: {
    id: 'reinforced_hulls',
    label: 'Reinforced Hulls',
    short: 'Walkers +25% HP',
    description: 'Walker chassis are armoured. Bring sustained DPS or pierce.',
    category: 'enemies',
    tone: 'threat',
    glyph: '◈',
    effect: { enemyHpMultByKind: { walker: 1.25 } },
  },
  swarm_protocol: {
    id: 'swarm_protocol',
    label: 'Swarm Protocol',
    short: 'All enemies +15% speed',
    description: 'Hostile pack tactics. Every contact moves faster — slows and AoE matter more than ever.',
    category: 'enemies',
    tone: 'threat',
    glyph: '⟫',
    effect: { enemySpeedMult: 1.15 },
  },
  shielded_vanguard: {
    id: 'shielded_vanguard',
    label: 'Shielded Vanguard',
    short: 'Shielded regen +10/s',
    description: 'Shielded Troopers regenerate shielding. EMP and Rail thrive.',
    category: 'enemies',
    tone: 'threat',
    glyph: '⛨',
    effect: { shieldRegenPerSec: { kind: 'shielded', amount: 10 } },
  },
  cloaked_approach: {
    id: 'cloaked_approach',
    label: 'Cloaked Approach',
    short: 'Stealth-heavy assault',
    description: 'Stealth units lead the assault — only Rail Battery can target them. Bring at least one Rail.',
    category: 'enemies',
    tone: 'threat',
    glyph: '◐',
    effect: {},
  },
  bonus_bounty: {
    id: 'bonus_bounty',
    label: 'Salvage Op',
    short: 'Kills give +25% energy',
    description: 'Wreckage yields more salvage. Fuel an aggressive build.',
    category: 'economy',
    tone: 'boon',
    glyph: '⚡',
    effect: { bountyMult: 1.25 },
  },
  emergency_reserves: {
    id: 'emergency_reserves',
    label: 'Emergency Reserves',
    short: 'Start with +60⚡',
    description: 'A pre-deployed energy cache. Open with a stronger early grid.',
    category: 'economy',
    tone: 'boon',
    glyph: '◉',
    effect: { startEnergyDelta: 60 },
  },
  supply_drought: {
    id: 'supply_drought',
    label: 'Supply Drought',
    short: 'Towers cost +15%',
    description: 'Logistics lag the front line. Place fewer, smarter towers.',
    category: 'economy',
    tone: 'threat',
    glyph: '◌',
    effect: { towerCostMult: 1.15 },
  },
  pulse_overdrive: {
    id: 'pulse_overdrive',
    label: 'Pulse Overdrive',
    short: 'Pulse Cannons +20% dmg',
    description: 'Pulse coils run hotter than spec. Build a Pulse-led grid.',
    category: 'towers',
    tone: 'boon',
    glyph: 'P',
    effect: { towerDamageMultByKind: { pulse: 1.2 } },
  },
  cryo_calibration: {
    id: 'cryo_calibration',
    label: 'Cryo Calibration',
    short: 'Cryo cost −20%',
    description: 'Cryo emitters are mass-produced this op. Slow the wave open.',
    category: 'towers',
    tone: 'boon',
    glyph: 'C',
    effect: { towerCostMultByKind: { cryo: 0.8 } },
  },
  arc_resonance: {
    id: 'arc_resonance',
    label: 'Arc Resonance',
    short: 'Arc Towers +25% dmg',
    description: 'Atmospheric ionisation amplifies arc chains.',
    category: 'towers',
    tone: 'boon',
    glyph: 'A',
    effect: { towerDamageMultByKind: { arc: 1.25 } },
  },
  rapid_command: {
    id: 'rapid_command',
    label: 'Rapid Command',
    short: 'Abilities −25% CD',
    description: 'Command uplink is hot. Orbital and EMP recharge faster.',
    category: 'abilities',
    tone: 'boon',
    glyph: '◎',
    effect: { abilityCooldownMult: 0.75 },
  },
  comms_jammed: {
    id: 'comms_jammed',
    label: 'Comms Jammed',
    short: 'Abilities +30% CD',
    description: 'Hostile jamming slows command uplink. Lean on towers.',
    category: 'abilities',
    tone: 'threat',
    glyph: '⌧',
    effect: { abilityCooldownMult: 1.3 },
  },
  hardened_boss: {
    id: 'hardened_boss',
    label: 'Hardened Mech',
    short: 'Boss +30% HP',
    description: 'The Siege Mech is plated for total breach. Save your trumps.',
    category: 'enemies',
    tone: 'threat',
    glyph: '☠',
    effect: { bossHpMult: 1.3 },
  },
  mixed_assault: {
    id: 'mixed_assault',
    label: 'Mixed Assault',
    short: 'All enemy types',
    description: 'The full roster attacks. Build a versatile defensive grid.',
    category: 'enemies',
    tone: 'neutral',
    glyph: '✦',
    effect: {},
  },
};

export const ALL_MODIFIERS: ModifierDef[] = Object.values(MODIFIERS);

export function getModifier(id: string): ModifierDef | undefined {
  return MODIFIERS[id];
}

export function resolveModifiers(ids: string[] | undefined): ModifierDef[] {
  if (!ids?.length) return [];
  const out: ModifierDef[] = [];
  for (const id of ids) {
    const m = MODIFIERS[id];
    if (m) out.push(m);
  }
  return out;
}

/* ---------- Aggregation helpers (engine consumes these) ---------- */

// Sourced from the definition maps so new towers/enemies/abilities are
// automatically covered by global (non-per-kind) modifier multipliers.
import { ENEMY_KINDS } from './enemies';
import { TOWER_KINDS } from './towers';
import { ABILITY_KINDS } from './abilities';

export interface AggregatedModifierEffects {
  enemyHpMult: Record<EnemyKind, number>;
  enemyShieldMult: Record<EnemyKind, number>;
  enemySpeedMult: number;
  bountyMult: number;
  startEnergyDelta: number;
  towerCostMult: Record<TowerKind, number>;
  towerDamageMult: Record<TowerKind, number>;
  abilityCooldownMult: Record<AbilityKind, number>;
  shieldRegen: Partial<Record<EnemyKind, number>>; // amount/sec per kind
  bossHpMult: number;
}

export function aggregateModifiers(defs: ModifierDef[]): AggregatedModifierEffects {
  const enemyHpMult = {} as Record<EnemyKind, number>;
  const enemyShieldMult = {} as Record<EnemyKind, number>;
  for (const k of ENEMY_KINDS) { enemyHpMult[k] = 1; enemyShieldMult[k] = 1; }
  const towerCostMult = {} as Record<TowerKind, number>;
  const towerDamageMult = {} as Record<TowerKind, number>;
  for (const k of TOWER_KINDS) { towerCostMult[k] = 1; towerDamageMult[k] = 1; }
  const abilityCooldownMult = {} as Record<AbilityKind, number>;
  for (const k of ABILITY_KINDS) abilityCooldownMult[k] = 1;

  let enemySpeedMult = 1;
  let bountyMult = 1;
  let startEnergyDelta = 0;
  let bossHpMult = 1;
  const shieldRegen: Partial<Record<EnemyKind, number>> = {};

  for (const def of defs) {
    const e = def.effect;
    if (e.enemyHpMult) for (const k of ENEMY_KINDS) enemyHpMult[k] *= e.enemyHpMult;
    if (e.enemyHpMultByKind) for (const [k, v] of Object.entries(e.enemyHpMultByKind)) {
      if (v) enemyHpMult[k as EnemyKind] *= v;
    }
    if (e.enemyShieldMult) for (const k of ENEMY_KINDS) enemyShieldMult[k] *= e.enemyShieldMult;
    if (e.enemyShieldMultByKind) for (const [k, v] of Object.entries(e.enemyShieldMultByKind)) {
      if (v) enemyShieldMult[k as EnemyKind] *= v;
    }
    if (e.enemySpeedMult) enemySpeedMult *= e.enemySpeedMult;
    if (e.bountyMult) bountyMult *= e.bountyMult;
    if (e.startEnergyDelta) startEnergyDelta += e.startEnergyDelta;
    if (e.towerCostMult) for (const k of TOWER_KINDS) towerCostMult[k] *= e.towerCostMult;
    if (e.towerCostMultByKind) for (const [k, v] of Object.entries(e.towerCostMultByKind)) {
      if (v) towerCostMult[k as TowerKind] *= v;
    }
    if (e.towerDamageMult) for (const k of TOWER_KINDS) towerDamageMult[k] *= e.towerDamageMult;
    if (e.towerDamageMultByKind) for (const [k, v] of Object.entries(e.towerDamageMultByKind)) {
      if (v) towerDamageMult[k as TowerKind] *= v;
    }
    if (e.abilityCooldownMult) for (const k of ABILITY_KINDS) abilityCooldownMult[k] *= e.abilityCooldownMult;
    if (e.abilityCooldownMultByKind) for (const [k, v] of Object.entries(e.abilityCooldownMultByKind)) {
      if (v) abilityCooldownMult[k as AbilityKind] *= v;
    }
    if (e.shieldRegenPerSec) {
      const cur = shieldRegen[e.shieldRegenPerSec.kind] ?? 0;
      shieldRegen[e.shieldRegenPerSec.kind] = cur + e.shieldRegenPerSec.amount;
    }
    if (e.bossHpMult) bossHpMult *= e.bossHpMult;
  }

  return {
    enemyHpMult, enemyShieldMult, enemySpeedMult, bountyMult,
    startEnergyDelta, towerCostMult, towerDamageMult, abilityCooldownMult,
    shieldRegen, bossHpMult,
  };
}

export function emptyAggregated(): AggregatedModifierEffects {
  return aggregateModifiers([]);
}

/** UI helper. */
export function modifierTone(tone: ModifierTone): { fg: string; bg: string; border: string } {
  if (tone === 'threat') return {
    fg: 'hsl(350 90% 78%)',
    bg: 'hsl(350 85% 55% / 0.14)',
    border: 'hsl(350 85% 62% / 0.5)',
  };
  if (tone === 'boon') return {
    fg: 'hsl(150 80% 78%)',
    bg: 'hsl(150 80% 55% / 0.14)',
    border: 'hsl(150 80% 55% / 0.5)',
  };
  return {
    fg: 'hsl(var(--nx-amber))',
    bg: 'hsl(var(--nx-amber) / 0.12)',
    border: 'hsl(var(--nx-amber) / 0.45)',
  };
}
