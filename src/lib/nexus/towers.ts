import { TowerDef, TowerKind } from './types';

export const TOWERS: Record<TowerKind, TowerDef> = {
  pulse: {
    kind: 'pulse',
    name: 'Pulse Cannon',
    tagline: 'Reliable single-target damage. The backbone of any grid.',
    cost: 50,
    damage: 18,
    range: 3,
    fireRate: 1.5,
    upgradeCost: 60,
    upgradeMultiplier: 1.6,
    color: 'cyan',
    glyph: 'P',
  },
  arc: {
    kind: 'arc',
    name: 'Arc Tower',
    tagline: 'Lightning chains across grouped enemies. Loves swarms.',
    cost: 80,
    damage: 12,
    range: 2.5,
    fireRate: 1.1,
    chain: 2,
    upgradeCost: 80,
    upgradeMultiplier: 1.5,
    color: 'violet',
    glyph: 'A',
  },
  cryo: {
    kind: 'cryo',
    name: 'Cryo Emitter',
    tagline: 'Slows everything in range. Stacks brutally with damage towers.',
    cost: 70,
    damage: 6,
    range: 2.5,
    fireRate: 1.0,
    slow: 0.55,
    slowDuration: 1.6,
    splash: 1.5,
    upgradeCost: 70,
    upgradeMultiplier: 1.35,
    color: 'sky',
    glyph: 'C',
  },
  rail: {
    kind: 'rail',
    name: 'Rail Battery',
    tagline: 'Long range, armor-piercing. Sees stealth, hits air. Slow fire.',
    cost: 120,
    damage: 65,
    range: 6,
    fireRate: 0.5,
    armorPierce: 8,
    canHitAir: true,
    upgradeCost: 140,
    upgradeMultiplier: 1.7,
    color: 'amber',
    glyph: 'R',
  },
  flak: {
    kind: 'flak',
    name: 'Flak Battery',
    tagline: 'Anti-air specialist. Prioritises flyers, bursts a small cloud.',
    cost: 90,
    damage: 22,
    range: 3.5,
    fireRate: 1.3,
    canHitAir: true,
    splashDamage: 1.1,
    upgradeCost: 90,
    upgradeMultiplier: 1.5,
    color: 'emerald',
    glyph: 'F',
  },
  mortar: {
    kind: 'mortar',
    name: 'Mortar',
    tagline: 'Lobs heavy shells. Huge splash, slow fire. Shreds clusters.',
    cost: 110,
    damage: 55,
    range: 4,
    fireRate: 0.45,
    splashDamage: 1.8,
    upgradeCost: 120,
    upgradeMultiplier: 1.55,
    color: 'rose',
    glyph: 'M',
  },
  amp: {
    kind: 'amp',
    name: 'Amp Node',
    tagline: 'Fires nothing — supercharges adjacent towers’ damage + range.',
    cost: 100,
    damage: 0,
    range: 0,
    fireRate: 0,
    supportAura: { range: 2.2, damageMult: 0.3, rangeBonus: 0.4 },
    upgradeCost: 110,
    upgradeMultiplier: 1.4,
    color: 'fuchsia',
    glyph: '+',
  },
};

export const TOWER_LIST = Object.values(TOWERS);
export const TOWER_KINDS = Object.keys(TOWERS) as TowerKind[];

// Stat scaling per level (level 1 = base, level 2/3 multiply)
export function towerDamageAt(kind: TowerKind, level: number): number {
  const def = TOWERS[kind];
  return Math.round(def.damage * Math.pow(def.upgradeMultiplier, level - 1));
}
export function towerRangeAt(kind: TowerKind, level: number): number {
  const def = TOWERS[kind];
  // mild range gain at L3
  return def.range + (level >= 3 ? 0.5 : 0);
}
export function towerFireRateAt(kind: TowerKind, level: number): number {
  const def = TOWERS[kind];
  return def.fireRate * (level >= 2 ? 1.15 : 1) * (level >= 3 ? 1.15 : 1);
}
export function towerUpgradeCost(kind: TowerKind, currentLevel: number): number {
  const def = TOWERS[kind];
  return Math.round(def.upgradeCost * Math.pow(1.5, currentLevel - 1));
}
export function towerSellValue(kind: TowerKind, level: number): number {
  const def = TOWERS[kind];
  let total = def.cost;
  for (let l = 2; l <= level; l++) total += Math.round(def.upgradeCost * Math.pow(1.5, l - 2));
  return Math.round(total * 0.6);
}
