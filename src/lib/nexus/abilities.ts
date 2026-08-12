import { AbilityDef, AbilityKind } from './types';

export const ABILITIES: Record<AbilityKind, AbilityDef> = {
  orbital: {
    kind: 'orbital',
    name: 'Orbital Strike',
    tagline: 'Massive AoE damage on the leading enemy cluster.',
    cooldownMs: 25_000,
    glyph: '◎',
    color: 'amber',
  },
  emp: {
    kind: 'emp',
    name: 'EMP Pulse',
    tagline: 'Stuns all enemies for 3s and strips shields.',
    cooldownMs: 30_000,
    glyph: 'E',
    color: 'cyan',
  },
  overclock: {
    kind: 'overclock',
    name: 'Overclock',
    tagline: 'All towers fire faster and hit harder for 6s.',
    cooldownMs: 28_000,
    glyph: '⚡',
    color: 'amber',
  },
  repair: {
    kind: 'repair',
    name: 'Nanite Repair',
    tagline: 'Restores a chunk of Nexus integrity. Your panic button.',
    cooldownMs: 45_000,
    glyph: '✚',
    color: 'emerald',
  },
};

export const ABILITY_LIST = Object.values(ABILITIES);
export const ABILITY_KINDS = Object.keys(ABILITIES) as AbilityKind[];
