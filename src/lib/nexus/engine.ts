import { ABILITIES } from './abilities';
import { ENEMIES } from './enemies';
import { distanceCells, getGridLayout, type PathVariantId } from './grid';
import { MISSIONS, getMission } from './missions';
import { TOWERS, towerDamageAt, towerFireRateAt, towerRangeAt, towerSellValue, towerUpgradeCost } from './towers';
import { aggregateModifiers, emptyAggregated, resolveModifiers } from './modifiers';
import { isEndlessMission } from './endless';
// Use the live-draft-aware scaling resolver so admin overrides take effect on
// new runs without rearchitecting the engine. Falls back to the hardcoded
// curve when no live endless draft exists.
import { liveEndlessWaveScaling } from './missionDrafts';
import {
  AbilityKind, ActiveEnemy, BattleEvent, BattleState, EnemyKind, MissionDef, PlacedTower, TowerKind,
} from './types';

const TICK_MS = 100; // 10 ticks/sec
const BETWEEN_WAVE_MS = 5000;
const EVENT_TTL_MS = 350;

let idCounter = 0;
const nextId = (p: string) => `${p}_${++idCounter}_${Date.now().toString(36).slice(-3)}`;

// ---------- INIT ----------

export interface InitBattleOptions {
  /** Pre-resolved mission (with calibration already applied). Required when given. */
  mission?: MissionDef;
  enemyHpMult?: Partial<Record<EnemyKind, number>>;
  enemyShieldMult?: Partial<Record<EnemyKind, number>>;
  enemySpeedMult?: number;
  /** Engine path variant for this run. Defaults to 'default' (canonical S-curve). */
  pathVariantId?: PathVariantId;
  /** Active pre-run boost. Effects parsed from the catalog row. */
  boost?: {
    code: string;
    towerDamageMult?: number;
    buildCostMult?: number;
    durationMs?: number;
    hpMult?: number;
    energyRegenMult?: number;
    opPointsMult?: number;
    coresMult?: number;
    reconWaves?: number;
  };
}

export function initBattle(missionId: number, abilities: AbilityKind[], opts: InitBattleOptions = {}): BattleState {
  const mission = opts.mission ?? getMission(missionId);
  if (!mission) throw new Error('Mission not found');
  const zeroTowers = { pulse: 0, arc: 0, cryo: 0, rail: 0 } as Record<TowerKind, number>;
  const zeroAbilities = { orbital: 0, emp: 0 } as Record<AbilityKind, number>;
  const oneEnemies: Record<EnemyKind, number> = { drone: 1, walker: 1, shielded: 1, stealth: 1, boss: 1 };
  const hpMult: Record<EnemyKind, number> = { ...oneEnemies, ...(opts.enemyHpMult ?? {}) };
  const shieldMult: Record<EnemyKind, number> = { ...oneEnemies, ...(opts.enemyShieldMult ?? {}) };

  // Resolve mission modifiers (compose on top of calibration).
  const modDefs = resolveModifiers(mission.modifierIds);
  const mods = modDefs.length ? aggregateModifiers(modDefs) : emptyAggregated();

  // Apply boost-driven base adjustments
  const boost = opts.boost;
  const hpMultBoost = boost?.hpMult ?? 1;
  const baseHp = Math.max(1, Math.round(mission.baseHp * hpMultBoost));

  return {
    tickMs: TICK_MS,
    elapsedMs: 0,
    energy: Math.max(0, mission.startEnergy + mods.startEnergyDelta),
    baseHp,
    baseHpMax: baseHp,
    waveIndex: -1,
    totalWaves: mission.waves.length,
    waveTimeMs: 0,
    spawnQueues: [],
    enemies: [],
    towers: [],
    abilities: abilities.map(k => ({ kind: k, cooldownMs: 0 })),
    status: 'pre',
    betweenWaveMs: 0,
    score: 0,
    killedThisRun: 0,
    events: [],
    towerBuilds: { ...zeroTowers },
    towerUpgrades: { ...zeroTowers },
    towerSells: { ...zeroTowers },
    abilityUses: { ...zeroAbilities },
    energyStarvedMs: 0,
    leaks: 0,
    bossDamageDealt: 0,
    enemyHpMult: hpMult,
    enemyShieldMult: shieldMult,
    enemySpeedMult: opts.enemySpeedMult ?? 1,
    modifierIds: mission.modifierIds ?? [],
    modEnemyHpMult: mods.enemyHpMult,
    modEnemyShieldMult: mods.enemyShieldMult,
    modEnemySpeedMult: mods.enemySpeedMult,
    modBountyMult: mods.bountyMult,
    modTowerCostMult: mods.towerCostMult,
    modTowerDamageMult: mods.towerDamageMult,
    modAbilityCooldownMult: mods.abilityCooldownMult,
    modShieldRegen: mods.shieldRegen,
    modBossHpMult: mods.bossHpMult,
    // boost fields
    boostCode: boost?.code ?? null,
    boostTowerDamageMult: boost?.towerDamageMult,
    boostBuildCostMult: boost?.buildCostMult,
    boostEnergyRegenMult: boost?.energyRegenMult ?? 1,
    boostOpPointsMult: boost?.opPointsMult ?? 1,
    boostCoresMult: boost?.coresMult ?? 1,
    boostReconWaves: boost?.reconWaves ?? 0,
    boostExpiresAtMs: boost?.durationMs ? boost.durationMs : undefined,
    pathVariantId: opts.pathVariantId ?? 'default',
  };
}

// ---------- TICK ----------

export function tick(state: BattleState, mission: MissionDef): BattleState {
  if (state.status === 'victory' || state.status === 'defeat') return state;

  const s: BattleState = {
    ...state,
    enemies: state.enemies.map(e => ({ ...e })),
    towers: state.towers.map(t => ({ ...t })),
    abilities: state.abilities.map(a => ({ ...a })),
    spawnQueues: state.spawnQueues.map(q => ({ ...q })),
    events: state.events.filter(ev => state.elapsedMs - ev.t < EVENT_TTL_MS),
  };
  // Resolve the active grid layout for this run. Defensive lookup — any
  // missing/unknown variant collapses to the canonical default.
  const { PATH, pathToXY } = getGridLayout(s.pathVariantId);
  s.elapsedMs += TICK_MS;
  s.abilities.forEach(a => { a.cooldownMs = Math.max(0, a.cooldownMs - TICK_MS); });

  // Passive energy trickle: 1 energy every 1.5s during waves, 0.75s between waves.
  // Boosted runs may slow this to 90% (Reinforced Plating trade-off) by stretching the interval.
  if (s.status === 'in_wave' || s.status === 'between') {
    const baseInterval = s.status === 'in_wave' ? 1500 : 750;
    const regenMult = s.boostEnergyRegenMult ?? 1;
    const intervalMs = Math.max(100, Math.round(baseInterval / regenMult));
    if (Math.floor(s.elapsedMs / intervalMs) > Math.floor((s.elapsedMs - TICK_MS) / intervalMs)) {
      s.energy += 1;
    }
  }

  // --- Wave control ---
  if (s.status === 'between') {
    s.betweenWaveMs -= TICK_MS;
    if (s.betweenWaveMs <= 0) startNextWave(s, mission);
  }

  // --- Spawning ---
  if (s.status === 'in_wave') {
    s.waveTimeMs += TICK_MS;
    for (const q of s.spawnQueues) {
      if (q.remaining <= 0) continue;
      q.nextSpawnIn -= TICK_MS;
      while (q.nextSpawnIn <= 0 && q.remaining > 0) {
        spawnEnemy(s, q.enemy, mission);
        q.remaining -= 1;
        q.nextSpawnIn += q.intervalMs;
      }
    }
  }

  // --- Move enemies ---
  const leakers: ActiveEnemy[] = [];
  for (const e of s.enemies) {
    if (e.stunnedMs > 0) {
      e.stunnedMs = Math.max(0, e.stunnedMs - TICK_MS);
      continue;
    }
    const def = ENEMIES[e.kind];
    const slowFactor = e.slowMs > 0 ? (1 - e.slowFactor) : 1;
    const cellsThisTick = (def.speed * (e.speedMult ?? 1) * (s.enemySpeedMult ?? 1) * (s.modEnemySpeedMult ?? 1) * slowFactor) * (TICK_MS / 1000);
    let progress = e.progress + cellsThisTick;
    while (progress >= 1 && e.pathIndex < PATH.length - 1) {
      progress -= 1;
      e.pathIndex += 1;
    }
    e.progress = Math.min(progress, 1);
    if (e.slowMs > 0) e.slowMs = Math.max(0, e.slowMs - TICK_MS);
    if (e.pathIndex >= PATH.length - 1) {
      // leaked
      s.baseHp = Math.max(0, s.baseHp - def.damage);
      s.events.push({ type: 'leak', t: s.elapsedMs });
      s.leaks += 1;
      leakers.push(e);
    }
  }
  s.enemies = s.enemies.filter(e => !leakers.includes(e));

  // --- Energy starvation tracking (during waves only) ---
  if (s.status === 'in_wave') {
    const cheapest = Math.min(TOWERS.pulse.cost, TOWERS.arc.cost, TOWERS.cryo.cost, TOWERS.rail.cost);
    if (s.energy < cheapest) s.energyStarvedMs += TICK_MS;
  }

  if (s.baseHp <= 0) {
    s.status = 'defeat';
    return s;
  }

  // --- Tower fire ---
  for (const t of s.towers) {
    t.cooldownMs = Math.max(0, t.cooldownMs - TICK_MS);
    if (t.cooldownMs > 0) continue;
    const tDef = TOWERS[t.kind];
    const range = towerRangeAt(t.kind, t.level);
    const baseDamage = towerDamageAt(t.kind, t.level);
    const dmgMod = s.modTowerDamageMult?.[t.kind] ?? 1;
    // Boost: timed-window tower damage uplift (Overcharge Coil)
    const boostActive = !!s.boostExpiresAtMs && s.elapsedMs <= s.boostExpiresAtMs;
    const boostDmg = boostActive && s.boostTowerDamageMult ? s.boostTowerDamageMult : 1;
    const damage = Math.max(1, Math.round(baseDamage * dmgMod * boostDmg));
    const fr = towerFireRateAt(t.kind, t.level);
    const cooldown = Math.max(80, Math.round(1000 / fr));

    // gather visible targets
    const visible = s.enemies.filter(e => {
      const def = ENEMIES[e.kind];
      if (def.stealth && t.kind !== 'rail') return false;
      const pos = pathToXY(e.pathIndex, e.progress);
      const d = distanceCells(t.cell.col + 0.5, t.cell.row + 0.5, pos.x + 0.5, pos.y + 0.5);
      return d <= range;
    });
    if (visible.length === 0) continue;

    // pick the primary target per the tower's targeting priority (player agency)
    const primary = pickPrimary(visible, t, pathToXY);

    const primaryPos = pathToXY(primary.pathIndex, primary.progress);
    s.events.push({ type: 'shot', from: { col: t.cell.col, row: t.cell.row }, to: primaryPos, tower: t.kind, t: s.elapsedMs });

    if (t.kind === 'cryo') {
      // AoE slow + small damage around primary
      const radius = tDef.splash ?? 1.5;
      for (const e of visible) {
        const pos = pathToXY(e.pathIndex, e.progress);
        const d = distanceCells(primaryPos.x, primaryPos.y, pos.x, pos.y);
        if (d <= radius) {
          applyDamage(e, damage, 0, t, s);
          e.slowMs = Math.max(e.slowMs, (tDef.slowDuration ?? 1.5) * 1000);
          e.slowFactor = Math.max(e.slowFactor, tDef.slow ?? 0.5);
        }
      }
    } else if (t.kind === 'arc') {
      // chain to N additional nearest visible enemies
      const chain = tDef.chain ?? 2;
      const hit = new Set<string>([primary.id]);
      let last = primary;
      applyDamage(primary, damage, 0, t, s);
      for (let i = 0; i < chain; i++) {
        const lastPos = pathToXY(last.pathIndex, last.progress);
        const next = visible
          .filter(e => !hit.has(e.id))
          .sort((a, b) => {
            const ap = pathToXY(a.pathIndex, a.progress);
            const bp = pathToXY(b.pathIndex, b.progress);
            return distanceCells(lastPos.x, lastPos.y, ap.x, ap.y) - distanceCells(lastPos.x, lastPos.y, bp.x, bp.y);
          })[0];
        if (!next) break;
        const dmg = Math.round(damage * Math.pow(0.7, i + 1));
        applyDamage(next, dmg, 0, t, s);
        hit.add(next.id);
        last = next;
      }
    } else {
      applyDamage(primary, damage, tDef.armorPierce ?? 0, t, s);
    }
    t.cooldownMs = cooldown;
  }

  // --- Cleanup dead enemies + bounty ---
  const survivors: ActiveEnemy[] = [];
  for (const e of s.enemies) {
    if (e.hp <= 0) {
      const def = ENEMIES[e.kind];
      const bounty = Math.max(0, Math.round(def.bounty * (s.modBountyMult ?? 1)));
      s.energy += bounty;
      s.score += bounty;
      s.killedThisRun += 1;
      // Credit the kill to the tower that landed the killing blow (if any).
      // Ability-based kills (orbital / EMP-then-leak) won't have lastHitBy
      // and simply don't credit a tower — that's correct.
      if (e.lastHitBy) {
        const killer = s.towers.find(t => t.id === e.lastHitBy);
        if (killer) killer.kills += 1;
      }
      const pos = pathToXY(e.pathIndex, e.progress);
      s.events.push({ type: 'kill', at: pos, t: s.elapsedMs });
    } else {
      survivors.push(e);
    }
  }
  s.enemies = survivors;

  // Modifier-driven shield regen (e.g. Shielded Vanguard).
  if (s.modShieldRegen) {
    for (const e of s.enemies) {
      const rate = s.modShieldRegen[e.kind];
      if (!rate) continue;
      const baseShield = ENEMIES[e.kind].shield ?? 0;
      const maxShield = baseShield * (s.modEnemyShieldMult?.[e.kind] ?? 1) * (s.enemyShieldMult?.[e.kind] ?? 1);
      if (maxShield <= 0) continue;
      e.shield = Math.min(maxShield, e.shield + (rate * TICK_MS) / 1000);
    }
  }

  // --- Check wave completion ---
  if (s.status === 'in_wave') {
    const allDone = s.spawnQueues.every(q => q.remaining <= 0) && s.enemies.length === 0;
    if (allDone) {
      const wave = mission.waves[s.waveIndex];
      s.energy += wave.rewardEnergy;
      s.score += wave.rewardEnergy * 2;
      if (s.waveIndex >= mission.waves.length - 1) {
        s.status = 'victory';
        // bonus for remaining base hp
        s.score += s.baseHp * 25;
      } else {
        s.status = 'between';
        s.betweenWaveMs = BETWEEN_WAVE_MS;
      }
    }
  }

  return s;
}

/** Choose a tower's primary target honoring its targeting priority. */
function pickPrimary(
  visible: ActiveEnemy[],
  t: PlacedTower,
  pathToXY: (i: number, p: number) => { x: number; y: number },
): ActiveEnemy {
  const mode = t.targetPriority ?? 'first';
  const prog = (e: ActiveEnemy) => e.pathIndex + e.progress;
  if (mode === 'strong') {
    return visible.reduce((best, cur) => ((cur.hp + cur.shield) > (best.hp + best.shield) ? cur : best));
  }
  if (mode === 'close') {
    const tx = t.cell.col + 0.5, ty = t.cell.row + 0.5;
    return visible.reduce((best, cur) => {
      const bp = pathToXY(best.pathIndex, best.progress);
      const cp = pathToXY(cur.pathIndex, cur.progress);
      return distanceCells(tx, ty, cp.x + 0.5, cp.y + 0.5) < distanceCells(tx, ty, bp.x + 0.5, bp.y + 0.5) ? cur : best;
    });
  }
  if (mode === 'last') {
    return visible.reduce((best, cur) => (prog(cur) < prog(best) ? cur : best));
  }
  // 'first' — most path progress (the classic default)
  return visible.reduce((best, cur) => (prog(cur) > prog(best) ? cur : best));
}

function startNextWave(s: BattleState, mission: MissionDef) {
  s.waveIndex += 1;
  const wave = mission.waves[s.waveIndex];
  s.waveTimeMs = 0;
  s.status = 'in_wave';
  s.spawnQueues = wave.spawns.map(sp => ({
    enemy: sp.enemy,
    remaining: sp.count,
    nextSpawnIn: sp.delayMs ?? 0,
    intervalMs: sp.intervalMs,
  }));
}

function spawnEnemy(s: BattleState, kind: EnemyKind, mission: MissionDef) {
  const def = ENEMIES[kind];
  let hp = def.hp;
  // Apply calibration multipliers (default 1× = no change), then modifier mults.
  const hpMult = (s.enemyHpMult?.[kind] ?? 1) * (s.modEnemyHpMult?.[kind] ?? 1);
  const shieldMult = (s.enemyShieldMult?.[kind] ?? 1) * (s.modEnemyShieldMult?.[kind] ?? 1);
  // Endless mode adds a per-wave-tier scaling layer that grows enemies with the wave index.
  const endlessScale = isEndlessMission(mission.id)
    ? liveEndlessWaveScaling(s.waveIndex, kind)
    : { hp: 1, shield: 1, speed: 1 };
  hp = Math.max(1, Math.round(hp * hpMult * endlessScale.hp));
  if (kind === 'boss') hp = Math.max(1, Math.round(hp * (s.modBossHpMult ?? 1)));
  const shield = Math.max(0, Math.round((def.shield ?? 0) * shieldMult * endlessScale.shield));
  s.enemies.push({
    id: nextId('e'),
    kind,
    hp,
    shield,
    pathIndex: 0,
    progress: 0,
    slowMs: 0,
    slowFactor: 0,
    stunnedMs: 0,
    speedMult: endlessScale.speed,
  });
}

function applyDamage(e: ActiveEnemy, dmg: number, pierce: number, tower: PlacedTower, s: BattleState) {
  let remaining = dmg;
  // Shields absorb first (full damage, no armor)
  if (e.shield > 0) {
    const absorbed = Math.min(e.shield, remaining);
    e.shield -= absorbed;
    remaining -= absorbed;
    if (e.kind === 'boss') s.bossDamageDealt += absorbed;
  }
  if (remaining <= 0) return;
  const def = ENEMIES[e.kind];
  const effectiveArmor = Math.max(0, def.armor - pierce);
  const final = Math.max(1, remaining - effectiveArmor);
  e.hp -= final;
  e.lastHitBy = tower.id;
  tower.totalDamage += final;
  if (e.kind === 'boss') s.bossDamageDealt += final;
}

// ---------- ACTIONS ----------

export function startWave(state: BattleState, mission: MissionDef): BattleState {
  if (state.status !== 'pre' && state.status !== 'between') return state;
  const s = { ...state, towers: state.towers.map(t => ({ ...t })), enemies: state.enemies.map(e => ({ ...e })) };
  startNextWave(s, mission);
  return s;
}

export function placeTower(state: BattleState, kind: TowerKind, col: number, row: number): { state: BattleState; ok: boolean; reason?: string } {
  // Buildability depends on the run's path variant — every layout has its
  // own set of path-adjacent build tiles.
  const { isBuildable } = getGridLayout(state.pathVariantId);
  if (!isBuildable(col, row)) return { state, ok: false, reason: 'Not a build tile' };
  if (state.towers.some(t => t.cell.col === col && t.cell.row === row)) return { state, ok: false, reason: 'Occupied' };
  const cost = Math.max(1, Math.round(TOWERS[kind].cost * (state.modTowerCostMult?.[kind] ?? 1)));
  if (state.energy < cost) return { state, ok: false, reason: 'Not enough energy' };
  const tower: PlacedTower = {
    id: nextId('t'),
    kind,
    level: 1,
    cell: { col, row },
    cooldownMs: 0,
    totalDamage: 0,
    kills: 0,
  };
  return {
    state: {
      ...state,
      towers: [...state.towers, tower],
      energy: state.energy - cost,
      towerBuilds: { ...state.towerBuilds, [kind]: state.towerBuilds[kind] + 1 },
    },
    ok: true,
  };
}

export function upgradeTower(state: BattleState, towerId: string): { state: BattleState; ok: boolean; reason?: string } {
  const t = state.towers.find(t => t.id === towerId);
  if (!t) return { state, ok: false, reason: 'Tower missing' };
  if (t.level >= 3) return { state, ok: false, reason: 'Max level' };
  const baseCost = towerUpgradeCost(t.kind, t.level);
  const cost = Math.max(1, Math.round(baseCost * (state.modTowerCostMult?.[t.kind] ?? 1)));
  if (state.energy < cost) return { state, ok: false, reason: 'Not enough energy' };
  return {
    state: {
      ...state,
      energy: state.energy - cost,
      towers: state.towers.map(x => x.id === towerId ? { ...x, level: x.level + 1 } : x),
      towerUpgrades: { ...state.towerUpgrades, [t.kind]: state.towerUpgrades[t.kind] + 1 },
    },
    ok: true,
  };
}

/** Cycle/set a placed tower's targeting priority (player agency, no cost). */
export function setTowerPriority(state: BattleState, towerId: string, mode: import('./types').TargetMode): BattleState {
  return {
    ...state,
    towers: state.towers.map(t => t.id === towerId ? { ...t, targetPriority: mode } : t),
  };
}

export function sellTower(state: BattleState, towerId: string): BattleState {
  const t = state.towers.find(t => t.id === towerId);
  if (!t) return state;
  const refund = towerSellValue(t.kind, t.level);
  return {
    ...state,
    energy: state.energy + refund,
    towers: state.towers.filter(x => x.id !== towerId),
    towerSells: { ...state.towerSells, [t.kind]: state.towerSells[t.kind] + 1 },
  };
}

export function castAbility(state: BattleState, kind: AbilityKind): { state: BattleState; ok: boolean } {
  const ab = state.abilities.find(a => a.kind === kind);
  if (!ab) return { state, ok: false };
  if (ab.cooldownMs > 0) return { state, ok: false };
  const def = ABILITIES[kind];
  const enemies = state.enemies.map(e => ({ ...e }));
  if (kind === 'orbital') {
    // Damage to leading 6 enemies
    const sorted = [...enemies].sort((a, b) => (b.pathIndex + b.progress) - (a.pathIndex + a.progress)).slice(0, 6);
    sorted.forEach(e => {
      e.shield = Math.max(0, e.shield - 80);
      e.hp -= 220;
    });
  } else if (kind === 'emp') {
    enemies.forEach(e => {
      e.shield = 0;
      e.stunnedMs = 3000;
    });
  }
  const cooldown = Math.max(1000, Math.round(def.cooldownMs * (state.modAbilityCooldownMult?.[kind] ?? 1)));
  return {
    state: {
      ...state,
      enemies,
      abilities: state.abilities.map(a => a.kind === kind ? { ...a, cooldownMs: cooldown } : a),
      events: [...state.events, { type: 'ability', ability: kind, t: state.elapsedMs }],
      abilityUses: { ...state.abilityUses, [kind]: state.abilityUses[kind] + 1 },
    },
    ok: true,
  };
}

export { TICK_MS };
