// Nexus Defense — Endless / Co-op mission generator
//
// Builds the long-form mission used by the cooperative Operation. Same
// engine, towers, abilities, and grid as solo play — only the wave list
// (and a per-wave enemy scaling layer in the engine) differs.
//
// REBALANCE 2026-04-30 — Simulator (12 runs/strategy) showed competent
// players (balanced / optimizer / distracted) cleared every wave with
// 28/28 base HP. That is not a "tower defense" — it's a cinematic. This
// pass:
//   • Expands the mission to 30 waves (was 20).
//   • Tightens early economy (less starting energy, less wave reward).
//   • Adds 6 boss waves (5 / 10 / 15 / 20 / 25 / 30) — the 30 wave is a
//     dual-boss finisher.
//   • Layers a wave-tier enemy scaling curve (HP / shield / speed) that
//     the engine applies at spawn time (see endlessWaveScaling()). This
//     keeps the wave list readable while making wave 25 enemies legitimately
//     scarier than wave 5 enemies of the same kind.
//
// Pacing target on mobile (10 ticks/sec engine):
//   - Bad run (waves 1–5):       ~3 min, dies before boss #1
//   - Average run (waves 6–15):  ~6–9 min, kills 1–2 bosses
//   - Strong run (waves 16–25):  ~11–14 min, kills 3–5 bosses
//   - Mythic (waves 26–30):      ~16–20 min, full clear is rare

import { MissionDef, Wave, EnemyKind } from './types';

export const ENDLESS_MISSION_ID = 100;

interface SpawnTemplate {
  enemy: EnemyKind;
  count: number;
  intervalMs: number;
  delayMs?: number;
}

function wave(index: number, rewardEnergy: number, spawns: SpawnTemplate[]): Wave {
  return { index, rewardEnergy, spawns };
}

/** 30-wave gauntlet. Bosses on waves 5/10/15/20/25/30. */
function buildWaves(): Wave[] {
  const w: Wave[] = [];

  // ── Tier 1: Onboarding (waves 1–4) ─────────────────────────────────
  // Player learns layout, places 1–2 towers. Almost no pressure.
  w.push(wave(0, 40, [{ enemy: 'drone', count: 10, intervalMs: 800 }]));
  w.push(wave(1, 50, [
    { enemy: 'drone', count: 14, intervalMs: 650 },
    { enemy: 'walker', count: 2, intervalMs: 1400, delayMs: 1500 },
  ]));
  w.push(wave(2, 55, [
    { enemy: 'shielded', count: 4, intervalMs: 1100 },
    { enemy: 'drone', count: 12, intervalMs: 550, delayMs: 1500 },
  ]));
  w.push(wave(3, 65, [
    { enemy: 'shielded', count: 6, intervalMs: 950 },
    { enemy: 'walker', count: 4, intervalMs: 1100, delayMs: 1500 },
  ]));

  // ── Tier 2: First boss (wave 5) — proves Phase 3 contribution is reachable
  w.push(wave(4, 140, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'shielded', count: 4, intervalMs: 1200, delayMs: 3500 },
  ]));

  // ── Tier 3: Pressure rises (waves 6–9) ────────────────────────────
  w.push(wave(5, 80, [
    { enemy: 'stealth', count: 5, intervalMs: 1000 },
    { enemy: 'walker', count: 3, intervalMs: 1200, delayMs: 1500 },
  ]));
  w.push(wave(6, 90, [
    { enemy: 'drone', count: 18, intervalMs: 380 },
    { enemy: 'shielded', count: 6, intervalMs: 950, delayMs: 2000 },
  ]));
  w.push(wave(7, 100, [
    { enemy: 'walker', count: 7, intervalMs: 950 },
    { enemy: 'shielded', count: 6, intervalMs: 950, delayMs: 1500 },
    { enemy: 'stealth', count: 4, intervalMs: 1100, delayMs: 3000 },
  ]));
  w.push(wave(8, 110, [
    { enemy: 'shielded', count: 10, intervalMs: 800 },
    { enemy: 'walker', count: 6, intervalMs: 1000, delayMs: 1500 },
  ]));

  // ── Tier 4: Second boss (wave 10) — first survival check
  w.push(wave(9, 180, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'walker', count: 6, intervalMs: 1000, delayMs: 4000 },
    { enemy: 'shielded', count: 8, intervalMs: 950, delayMs: 7000 },
  ]));

  // ── Tier 5: Mid-game ramp (waves 11–14) — wave-tier mults kick in
  w.push(wave(10, 120, [
    { enemy: 'stealth', count: 10, intervalMs: 800 },
    { enemy: 'shielded', count: 7, intervalMs: 900, delayMs: 1500 },
  ]));
  w.push(wave(11, 130, [
    { enemy: 'walker', count: 11, intervalMs: 800 },
    { enemy: 'drone', count: 24, intervalMs: 280, delayMs: 1500 },
    { enemy: 'runner', count: 14, intervalMs: 240, delayMs: 3000 },
    { enemy: 'flyer', count: 4, intervalMs: 1200, delayMs: 4000 },
  ]));
  w.push(wave(12, 140, [
    { enemy: 'shielded', count: 13, intervalMs: 700 },
    { enemy: 'stealth', count: 8, intervalMs: 900, delayMs: 1500 },
  ]));
  w.push(wave(13, 150, [
    { enemy: 'walker', count: 13, intervalMs: 750 },
    { enemy: 'shielded', count: 9, intervalMs: 850, delayMs: 1500 },
    { enemy: 'stealth', count: 7, intervalMs: 950, delayMs: 4000 },
  ]));

  // ── Tier 6: Third boss (wave 15) — separates strong runs from average
  w.push(wave(14, 220, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'walker', count: 7, intervalMs: 950, delayMs: 4000 },
    { enemy: 'shielded', count: 9, intervalMs: 900, delayMs: 7500 },
  ]));

  // ── Tier 7: Late game (waves 16–19) — heavy mixed
  w.push(wave(15, 170, [
    { enemy: 'walker', count: 16, intervalMs: 700 },
    { enemy: 'stealth', count: 12, intervalMs: 800, delayMs: 1500 },
  ]));
  w.push(wave(16, 180, [
    { enemy: 'drone', count: 34, intervalMs: 230 },
    { enemy: 'shielded', count: 12, intervalMs: 750, delayMs: 1500 },
    { enemy: 'healer', count: 3, intervalMs: 1500, delayMs: 2000 },
    { enemy: 'flyer', count: 6, intervalMs: 1000, delayMs: 3500 },
  ]));
  w.push(wave(17, 190, [
    { enemy: 'shielded', count: 16, intervalMs: 650 },
    { enemy: 'walker', count: 12, intervalMs: 750, delayMs: 1500 },
  ]));
  w.push(wave(18, 200, [
    { enemy: 'stealth', count: 16, intervalMs: 700 },
    { enemy: 'shielded', count: 14, intervalMs: 750, delayMs: 1500 },
    { enemy: 'walker', count: 10, intervalMs: 850, delayMs: 4500 },
  ]));

  // ── Tier 8: Fourth boss (wave 20) — first major wall
  w.push(wave(19, 280, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'walker', count: 12, intervalMs: 800, delayMs: 3000 },
    { enemy: 'shielded', count: 14, intervalMs: 800, delayMs: 6000 },
    { enemy: 'stealth', count: 10, intervalMs: 850, delayMs: 9000 },
  ]));

  // ── Tier 9: Mythic ramp (waves 21–24)
  w.push(wave(20, 220, [
    { enemy: 'walker', count: 18, intervalMs: 650 },
    { enemy: 'stealth', count: 14, intervalMs: 750, delayMs: 1500 },
  ]));
  w.push(wave(21, 230, [
    { enemy: 'drone', count: 40, intervalMs: 200 },
    { enemy: 'shielded', count: 14, intervalMs: 700, delayMs: 1500 },
  ]));
  w.push(wave(22, 240, [
    { enemy: 'shielded', count: 18, intervalMs: 600 },
    { enemy: 'walker', count: 14, intervalMs: 700, delayMs: 1500 },
    { enemy: 'splitter', count: 6, intervalMs: 1100, delayMs: 3000 },
    { enemy: 'brute', count: 2, intervalMs: 2500, delayMs: 5000 },
    { enemy: 'stealth', count: 10, intervalMs: 850, delayMs: 5000 },
  ]));
  w.push(wave(23, 250, [
    { enemy: 'stealth', count: 18, intervalMs: 650 },
    { enemy: 'shielded', count: 16, intervalMs: 700, delayMs: 1500 },
    { enemy: 'walker', count: 12, intervalMs: 800, delayMs: 4500 },
  ]));

  // ── Tier 10: Fifth boss (wave 25) — wall #2
  w.push(wave(24, 320, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'walker', count: 14, intervalMs: 750, delayMs: 3000 },
    { enemy: 'shielded', count: 16, intervalMs: 750, delayMs: 6000 },
    { enemy: 'stealth', count: 12, intervalMs: 800, delayMs: 9000 },
  ]));

  // ── Tier 11: Endgame (waves 26–29) — punishing
  w.push(wave(25, 260, [
    { enemy: 'walker', count: 22, intervalMs: 600 },
    { enemy: 'stealth', count: 16, intervalMs: 700, delayMs: 1500 },
  ]));
  w.push(wave(26, 270, [
    { enemy: 'drone', count: 48, intervalMs: 180 },
    { enemy: 'shielded', count: 18, intervalMs: 650, delayMs: 1500 },
    { enemy: 'walker', count: 12, intervalMs: 800, delayMs: 4500 },
  ]));
  w.push(wave(27, 280, [
    { enemy: 'shielded', count: 22, intervalMs: 550 },
    { enemy: 'stealth', count: 16, intervalMs: 700, delayMs: 1500 },
    { enemy: 'flyer', count: 8, intervalMs: 900, delayMs: 2500 },
    { enemy: 'healer', count: 4, intervalMs: 1400, delayMs: 3000 },
    { enemy: 'walker', count: 14, intervalMs: 800, delayMs: 4500 },
  ]));
  w.push(wave(28, 290, [
    { enemy: 'stealth', count: 22, intervalMs: 600 },
    { enemy: 'shielded', count: 20, intervalMs: 650, delayMs: 1500 },
    { enemy: 'walker', count: 16, intervalMs: 750, delayMs: 4500 },
  ]));

  // ── Tier 12: FINAL — dual boss + heavy escort (wave 30)
  w.push(wave(29, 600, [
    { enemy: 'boss', count: 1, intervalMs: 1000 },
    { enemy: 'brute', count: 3, intervalMs: 2200, delayMs: 3000 },
    { enemy: 'boss', count: 1, intervalMs: 1000, delayMs: 8000 },
    { enemy: 'flyer', count: 10, intervalMs: 800, delayMs: 11000 },
    { enemy: 'splitter', count: 6, intervalMs: 1100, delayMs: 15000 },
    { enemy: 'stealth', count: 14, intervalMs: 800, delayMs: 18000 },
  ]));

  return w;
}

/** The Endless / Co-op mission. Tighter economy + 30 waves + scaling layer. */
export const ENDLESS_MISSION: MissionDef = {
  id: ENDLESS_MISSION_ID,
  name: 'Sector Defense',
  sector: 'Co-op Operation',
  startEnergy: 220,           // was 260 — fewer free turrets up front
  baseHp: 24,                 // was 28 — leaks matter more
  rewardCores: 0,
  modifier: {
    label: 'Endless gauntlet',
    description:
      '30 escalating waves with 6 boss encounters (waves 5/10/15/20/25/30). Enemies grow stronger every wave — kills, score, waves and boss damage all feed the active Operation.',
  },
  modifierIds: ['mixed_assault', 'bonus_bounty'],
  waves: buildWaves(),
};

export function isEndlessMission(missionId: number): boolean {
  return missionId === ENDLESS_MISSION_ID;
}

/**
 * Per-wave enemy stat scaling for the Endless mission. Applied at spawn-time
 * by the engine (see `spawnEnemy` in engine.ts). Returns multipliers that
 * stack ON TOP of the base enemy stats and any active calibration / modifier
 * multipliers.
 *
 * Curve goals:
 *   • Waves 1–3: no scaling (1.0×) — fair onboarding.
 *   • Waves 4–10: gentle HP creep (~+8%/wave) and minimal speed change.
 *   • Waves 11–20: stronger HP curve (+10%/wave), shield grows (+5%/wave),
 *     speed begins (+1%/wave).
 *   • Waves 21–30: brutal scaling — HP +12%/wave, shield +6%/wave, speed
 *     capped at +30% so frame-rate / pathing doesn't break.
 *
 * Bosses get a smaller HP curve (+5%/wave from boss #1) so they remain
 * roughly killable per their boss wave; Phase 3 (boss damage) stays meaningful.
 */
export function endlessWaveScaling(waveIndex: number, kind: EnemyKind): {
  hp: number;
  shield: number;
  speed: number;
} {
  const w = Math.max(0, waveIndex); // 0-indexed
  if (kind === 'boss') {
    // Boss HP grows meaningfully — wave 25/30 bosses must threaten optimizers.
    const hp = 1 + Math.min(1.0, w * 0.04); // up to +100% by wave 25+
    return { hp, shield: 1, speed: 1 };
  }
  let hp = 1;
  let shield = 1;
  let speed = 1;
  // HP curve in 3 segments — steeper than the first pass after sim showed
  // optimizers cleared 30/30 with zero damage.
  if (w >= 3 && w < 10) hp = 1 + (w - 2) * 0.10;        // up to ~1.7× by wave 9
  else if (w >= 10 && w < 20) hp = 1.7 + (w - 9) * 0.15; // up to ~3.2× by wave 19
  else if (w >= 20) hp = 3.2 + (w - 19) * 0.22;          // up to ~5.6× by wave 30
  // Shield curve — only relevant for shielded units, but we apply to all.
  if (w >= 8 && w < 20) shield = 1 + (w - 7) * 0.08;     // up to ~2.0× by wave 19
  else if (w >= 20) shield = 2.0 + (w - 19) * 0.10;      // up to ~3.1× by wave 30
  // Speed curve — capped to avoid pathing weirdness.
  if (w >= 7) speed = Math.min(1.40, 1 + (w - 6) * 0.018);
  return { hp, shield, speed };
}
