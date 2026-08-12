// Nexus Defense — unified progression "journey".
//
// Ties the modes into one legible path so a player always knows how far
// they've come and what unlocks next:
//
//   Outer Rim (1–6) → Inner Belt (7–12) → Endless → Co-op Operations
//
// Each stage unlocks the next; Sigils are collected throughout. Pure logic —
// the hook feeds it raw counts, this computes statuses, an overall completion
// %, and an operative rank. No I/O here.

export type StageStatus = 'locked' | 'active' | 'complete';
export type StageKey = 'outer_rim' | 'inner_belt' | 'endless' | 'coop';

export interface JourneyStage {
  key: StageKey;
  name: string;
  blurb: string;
  status: StageStatus;
  to: string;
  /** 0..1 fill for the stage's progress bar. */
  progressPct: number;
  /** Short status line, e.g. "3 / 6 cleared" or "Best: Wave 14". */
  progressLabel: string;
  /** Shown only when locked — how to unlock. */
  unlockHint?: string;
  icon: 'target' | 'orbit' | 'infinity' | 'users';
  accent: string;
}

export interface JourneyRank {
  title: string;
  index: number;      // 0-based
  total: number;
  next: string | null;
  pctToNext: number;  // 0..1 toward the next rank
}

export interface JourneyModel {
  stages: JourneyStage[];
  sigils: { owned: number; total: number };
  overallPct: number; // 0..1 across all objectives
  rank: JourneyRank;
  cores: number;
}

export interface JourneyInputs {
  highestMission: number;   // highest UNLOCKED solo mission (cleared = id < this)
  cores: number;
  endlessBestWave: number;  // best waves_cleared in an endless run (0 = none)
  endlessRuns: number;      // count of endless runs recorded
  opParticipated: boolean;  // contributed to any co-op operation
  sigilsOwned: number;
  sigilsTotal: number;
}

export const SECTOR_I_COUNT = 6;   // Outer Rim: missions 1–6
export const SECTOR_II_COUNT = 6;  // Inner Belt: missions 7–12
export const CAMPAIGN_COUNT = SECTOR_I_COUNT + SECTOR_II_COUNT;
export const ENDLESS_GOAL_WAVE = 30; // full endless clear

const RANKS = ['Recruit', 'Operative', 'Veteran', 'Elite', 'Legend'];
// Lower bound (inclusive) of overall completion for each rank.
const RANK_FLOORS = [0, 0.2, 0.45, 0.7, 0.9];

function clamp01(n: number): number { return Math.max(0, Math.min(1, n)); }

function computeRank(overall: number): JourneyRank {
  let index = 0;
  for (let i = 0; i < RANK_FLOORS.length; i++) if (overall >= RANK_FLOORS[i]) index = i;
  const isMax = index >= RANKS.length - 1;
  const floor = RANK_FLOORS[index];
  const ceil = isMax ? 1 : RANK_FLOORS[index + 1];
  const span = Math.max(1e-6, ceil - floor);
  return {
    title: RANKS[index],
    index,
    total: RANKS.length,
    next: isMax ? null : RANKS[index + 1],
    pctToNext: isMax ? 1 : clamp01((overall - floor) / span),
  };
}

/** Missions cleared in a sector, given highest-unlocked id and the sector's id range. */
function clearedIn(highestMission: number, firstId: number, count: number): number {
  // A mission `id` is cleared when highestMission > id (clearing id advances the
  // unlock pointer past it). Campaign-complete pushes the pointer to CAMPAIGN_COUNT+1.
  return Math.max(0, Math.min(count, highestMission - firstId));
}

export function buildJourney(i: JourneyInputs): JourneyModel {
  const clearedI = clearedIn(i.highestMission, 1, SECTOR_I_COUNT);
  const clearedII = clearedIn(i.highestMission, SECTOR_I_COUNT + 1, SECTOR_II_COUNT);
  const outerDone = clearedI >= SECTOR_I_COUNT;
  const campaignDone = clearedII >= SECTOR_II_COUNT;
  const endlessUnlocked = campaignDone;
  const endlessDone = endlessUnlocked && i.endlessBestWave >= ENDLESS_GOAL_WAVE;
  const coopUnlocked = i.endlessRuns > 0;
  const coopDone = i.opParticipated;

  const stages: JourneyStage[] = [
    {
      key: 'outer_rim',
      name: 'Outer Rim',
      blurb: 'Sector I — learn the towers, meet the swarm.',
      status: outerDone ? 'complete' : 'active',
      to: '/nexus/missions',
      progressPct: clearedI / SECTOR_I_COUNT,
      progressLabel: `${clearedI} / ${SECTOR_I_COUNT} missions cleared`,
      icon: 'target',
      accent: 'hsl(var(--nx-cyan))',
    },
    {
      key: 'inner_belt',
      name: 'Inner Belt',
      blurb: 'Sector II — air, healers, splitters, twin-boss finale.',
      status: !outerDone ? 'locked' : campaignDone ? 'complete' : 'active',
      to: '/nexus/missions',
      progressPct: clearedII / SECTOR_II_COUNT,
      progressLabel: campaignDone
        ? 'Campaign complete'
        : outerDone ? `${clearedII} / ${SECTOR_II_COUNT} missions cleared` : 'Locked',
      unlockHint: !outerDone ? 'Clear Outer Rim to unlock' : undefined,
      icon: 'orbit',
      accent: 'hsl(300 85% 68%)',
    },
    {
      key: 'endless',
      name: 'Endless Defense',
      blurb: 'Prove your mastery — survive as long as you can.',
      status: !endlessUnlocked ? 'locked' : endlessDone ? 'complete' : 'active',
      to: '/nexus/loadout/100',
      progressPct: endlessUnlocked ? clamp01(i.endlessBestWave / ENDLESS_GOAL_WAVE) : 0,
      progressLabel: !endlessUnlocked
        ? 'Locked'
        : i.endlessBestWave > 0 ? `Best: Wave ${i.endlessBestWave} / ${ENDLESS_GOAL_WAVE}` : 'Not yet attempted',
      unlockHint: !endlessUnlocked ? 'Complete the campaign to unlock' : undefined,
      icon: 'infinity',
      accent: 'hsl(var(--nx-amber))',
    },
    {
      key: 'coop',
      name: 'Co-op Operations',
      blurb: 'The club endgame — push a shared operation with your allies.',
      status: !coopUnlocked ? 'locked' : coopDone ? 'complete' : 'active',
      to: '/nexus/operation',
      progressPct: coopDone ? 1 : 0,
      progressLabel: !coopUnlocked ? 'Locked' : coopDone ? 'Contributing to operations' : 'Join an operation',
      unlockHint: !coopUnlocked ? 'Run Endless Defense to unlock' : undefined,
      icon: 'users',
      accent: 'hsl(280 90% 78%)',
    },
  ];

  const campaignFrac = clamp01((i.highestMission - 1) / CAMPAIGN_COUNT);
  const endlessFrac = clamp01(i.endlessBestWave / ENDLESS_GOAL_WAVE);
  const coopFrac = coopDone ? 1 : 0;
  const sigilFrac = i.sigilsTotal > 0 ? clamp01(i.sigilsOwned / i.sigilsTotal) : 0;
  const overallPct = clamp01(
    campaignFrac * 0.55 + endlessFrac * 0.25 + coopFrac * 0.1 + sigilFrac * 0.1,
  );

  return {
    stages,
    sigils: { owned: i.sigilsOwned, total: i.sigilsTotal },
    overallPct,
    rank: computeRank(overallPct),
    cores: i.cores,
  };
}
