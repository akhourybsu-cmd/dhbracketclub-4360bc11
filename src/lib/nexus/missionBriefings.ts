// Nexus Defense — Mission Briefings
//
// Adds narrative + tactical metadata on top of the existing MissionDef. Pure
// data; safe to extend. Used by NexusMissionsPage cards and the Loadout
// MissionBriefingCard so each mission feels like a distinct deployment, not
// a row in a list.
//
// Adding a new briefing: append an entry keyed by mission id. If a mission
// has no entry, callers fall back to defaults derived from the MissionDef
// itself (see getBriefing()).

import type { MapLayoutId } from './mapLayouts';
import { ENDLESS_MISSION_ID } from './endless';

export type DifficultyTier = 1 | 2 | 3 | 4 | 5;

/**
 * Display-layer rewards for a mission. These describe what a successful clear
 * earns at the screen level — actual core grants and sigil rolls happen in
 * the existing engine + reward pipeline (mission.rewardCores, NexusRewardsPanel,
 * etc.). New fields here are purely for "what will I get if I win" UX.
 *
 * Adding persistent unlocks (XP, badges, cosmetics) is a future DB pass.
 */
export interface MissionRewards {
  /** Core reward (mirrors MissionDef.rewardCores; duplicated here for the briefing). */
  cores: number;
  /** Optional badge slug — display only; persistence comes later. */
  badge?: string;
  /** Short reward note shown on the briefing/result strip ("First Sigil drop", etc.). */
  note?: string;
  /** Whether this mission grants a sigil reward (bool flag — actual roll lives elsewhere). */
  sigilDrop?: boolean;
}

export interface MissionBriefing {
  /** Mission id. */
  missionId: number;
  /**
   * Map layout this mission deploys on. Drives both the briefing/result
   * visuals and the engine's path variant via `getEnginePathVariant()` —
   * single-source layouts get their own routing; multi-source layouts route
   * through the canonical path until multi-spawn engine support lands.
   */
  layoutId: MapLayoutId;
  /** Deployment one-liner shown on the campaign card. */
  tagline: string;
  /** Full briefing copy used in the briefing card. */
  briefing: string;
  /** Primary objective line. */
  objective: string;
  /** Enemy theme — short fluff string for the briefing. */
  enemyTheme: string;
  /** Difficulty tier 1–5; drives the difficulty dots. */
  difficulty: DifficultyTier;
  /** Optional codename / sigil shown beside the mission number. */
  codename?: string;
  /** Display-layer reward metadata. */
  rewards?: MissionRewards;
}

const SOLO_BRIEFINGS: Record<number, MissionBriefing> = {
  1: {
    missionId: 1,
    layoutId: 'tutorial_outpost',
    codename: 'PROBE',
    tagline: 'A scouting fleet on the edge of friendly space — easy first contact.',
    briefing:
      'Listening posts on the rim picked up a small recon flight angling toward our outpost. Numbers are low and the approach is linear — perfect to calibrate your loadout before the real assault begins.',
    objective: 'Hold the outpost through 3 reconnaissance waves.',
    enemyTheme: 'Drone scouts · light walker probe',
    difficulty: 1,
    rewards: { cores: 25, badge: 'first-contact', note: 'First sector clearance' },
  },
  2: {
    missionId: 2,
    layoutId: 'broken_corridor',
    codename: 'HARDPOINT',
    tagline: 'Reinforced walkers test our line — pack splash damage.',
    briefing:
      'Hostiles have committed armored Walkers to the corridor. They take heavy hits but their hulls funnel cleanly through the chokepoints. Stack splash on the bends and they\'ll stagger before reaching the core.',
    objective: 'Survive 4 escalating waves of mixed armor.',
    enemyTheme: 'Reinforced walkers · drone interlopers',
    difficulty: 2,
    rewards: { cores: 35, badge: 'hardpoint', note: 'Splash damage milestone' },
  },
  3: {
    missionId: 3,
    layoutId: 'central_nexus',
    codename: 'BULWARK',
    tagline: 'Shielded vanguard advances on the central plaza.',
    briefing:
      'The enemy is pushing Shielded Troopers along an open plaza. Their shields regenerate if you give them breathing room — break through fast or layer Arc chains to bleed multiple targets at once.',
    objective: 'Hold the central nexus across 4 mixed waves.',
    enemyTheme: 'Shielded vanguard · drone harassers · walker support',
    difficulty: 3,
    rewards: { cores: 45, badge: 'bulwark', note: 'Shield-breaker recognition' },
  },
  4: {
    missionId: 4,
    layoutId: 'twin_gate',
    codename: 'GHOST',
    tagline: 'Stealth units approach — only Rail Battery can lock on.',
    briefing:
      'Cloaked infiltrators are pushing both gates. Standard targeting can\'t paint them — only the Rail Battery\'s spectral sweep will reveal their vector. Build at least one early, or the gates will fall before you see them.',
    objective: 'Detect & neutralize stealth units across 4 waves.',
    enemyTheme: 'Stealth infiltrators · shielded support',
    difficulty: 3,
    rewards: { cores: 55, badge: 'ghost-hunter', note: 'Counter-stealth tactics certified' },
  },
  5: {
    missionId: 5,
    layoutId: 'reactor_ring',
    codename: 'CONVERGENCE',
    tagline: 'Every enemy class at once — combined arms required.',
    briefing:
      'Recon pulled clean — they\'re sending everything: drone swarm, walker phalanx, shielded vanguard, and stealth runners. The reactor ring layout gives you long fire windows but every tower kind has a job. No single-tower runs survive this.',
    objective: 'Survive a 4-wave combined-arms assault.',
    enemyTheme: 'Mixed assault · all unit classes',
    difficulty: 4,
    rewards: { cores: 70, badge: 'convergence', note: 'Combined-arms ribbon', sigilDrop: true },
  },
  6: {
    missionId: 6,
    layoutId: 'final_stand',
    codename: 'SIEGE-MECH',
    tagline: 'Final stand — Siege Mech inbound on Wave 4.',
    briefing:
      'Sector command has cleared you to engage the Siege Mech. The first three waves soften your defenses; on the fourth, the boss drops with shielded escort and walker support. Every credit, every upgrade, every ability — they all matter on this run.',
    objective: 'Survive 3 swarm waves, then break the Siege Mech.',
    enemyTheme: 'Boss · Siege Mech · escort screen',
    difficulty: 5,
    rewards: { cores: 120, badge: 'sector-i-cleared', note: 'Sector I cleared · Inner Belt unlocked', sigilDrop: true },
  },

  // ── Sector II · Inner Belt ──
  7: {
    missionId: 7,
    layoutId: 'belt_gauntlet',
    codename: 'SKYFALL',
    tagline: 'Gunships take the sky — build anti-air or the lane leaks.',
    briefing:
      'The Inner Belt opens with an air assault. Gunships fly straight over your ground towers — only Flak Batteries and Rail Batteries can touch them. Get one up early or the swarm walks in under the guns.',
    objective: 'Clear 4 waves of mixed air-and-ground assault.',
    enemyTheme: 'Gunships · sprint drones · walker support',
    difficulty: 3,
    rewards: { cores: 90, badge: 'skyfall', note: 'Anti-air proficiency' },
  },
  8: {
    missionId: 8,
    layoutId: 'belt_horseshoe',
    codename: 'MENDER',
    tagline: 'Field medics keep the brutes alive — kill the healers first.',
    briefing:
      'Siege Brutes soak enormous punishment, and Menders trailing them top up any damage you deal. Focus the healers down or the heavies will never fall. Set your towers to target Strongest and let the snipers work.',
    objective: 'Survive 4 waves of healer-backed heavies.',
    enemyTheme: 'Siege brutes · menders · shielded line',
    difficulty: 4,
    rewards: { cores: 100, badge: 'mender', note: 'Focus-fire discipline' },
  },
  9: {
    missionId: 9,
    layoutId: 'belt_serpent',
    codename: 'FRACTURE',
    tagline: 'Splitters burst into runners — splash damage is king.',
    briefing:
      'Splitters fracture into a spray of sprint drones the moment they die. On the serpentine, a Mortar or Cryo on the middle sweep catches both the parent and the spawn. Single-target towers will drown here.',
    objective: 'Hold the serpent lane through 4 swarming waves.',
    enemyTheme: 'Splitters · runner floods · drone swarm',
    difficulty: 4,
    rewards: { cores: 110, badge: 'fracture', note: 'Crowd-control ribbon' },
  },
  10: {
    missionId: 10,
    layoutId: 'belt_maze',
    codename: 'BLACKOUT',
    tagline: 'Cloaked and airborne at once — Rail sees both.',
    briefing:
      'Comms are jammed in the maze and the enemy knows it. Stealth infiltrators and gunships push the chicane together — the Rail Battery is the only tower that can paint stealth AND reach the sky. Layer Flak behind it.',
    objective: 'Detect and hold across 4 dark-corridor waves.',
    enemyTheme: 'Stealth · gunships · shielded support',
    difficulty: 5,
    rewards: { cores: 130, badge: 'blackout', note: 'All-detection certification' },
  },
  11: {
    missionId: 11,
    layoutId: 'belt_funnel',
    codename: 'ONSLAUGHT',
    tagline: 'Every class at once — and the energy is rationed.',
    briefing:
      'Supply lines are stretched: you start rich but the trickle is thin. Every enemy class pours the funnel. This is the ultimate combined-arms exam — Amp Nodes to squeeze value, splash for the swarm, snipers for the heavies.',
    objective: 'Survive a 4-wave, all-class onslaught on a tight economy.',
    enemyTheme: 'All classes · tight economy',
    difficulty: 5,
    rewards: { cores: 150, badge: 'onslaught', note: 'Combined-arms mastery', sigilDrop: true },
  },
  12: {
    missionId: 12,
    layoutId: 'belt_core',
    codename: 'LEVIATHAN',
    tagline: 'Twin Siege Mechs anchor the belt — the campaign finale.',
    briefing:
      'The heart of the Inner Belt. Three brutal swarm waves soften your grid, then TWIN Siege Mechs drop with a brute-and-gunship escort — with their hulls hardened. Everything you\'ve learned comes down to this run.',
    objective: 'Survive the swarm, then break both Siege Mechs.',
    enemyTheme: 'Twin bosses · hardened · full escort',
    difficulty: 5,
    rewards: { cores: 250, badge: 'inner-belt-cleared', note: 'Inner Belt cleared · campaign complete', sigilDrop: true },
  },
};

const ENDLESS_BRIEFING: MissionBriefing = {
  missionId: ENDLESS_MISSION_ID,
  layoutId: 'classic_lane',
  codename: 'ENDLESS',
  tagline: 'No win condition. Survive as long as you can. Bosses every 5 waves.',
  briefing:
    'The sector is on indefinite alert. Waves escalate without end — each tier scales hostile HP, shield, and speed. Bosses spawn every 5 waves. Your run ends only when the nexus falls. Run hard, run smart, run again.',
  objective: 'Survive as many waves as possible. Bosses on 5/10/15/20/25/30+.',
  enemyTheme: 'Escalating · all classes · 6+ boss tiers',
  difficulty: 4,
  rewards: { cores: 0, note: 'Sigils + Salvage Tokens scale with waves cleared', sigilDrop: true },
};

/* ─── Selectors ─────────────────────────────────────────────────────── */

export function getBriefing(missionId: number): MissionBriefing | undefined {
  if (missionId === ENDLESS_MISSION_ID) return ENDLESS_BRIEFING;
  return SOLO_BRIEFINGS[missionId];
}

export function getAllSoloBriefings(): MissionBriefing[] {
  return Object.values(SOLO_BRIEFINGS).sort((a, b) => a.missionId - b.missionId);
}

/** Pick a "Featured Operation" deterministically by date — rotates daily. */
export function getFeaturedMissionId(date: Date = new Date()): number {
  const briefings = getAllSoloBriefings();
  if (briefings.length === 0) return 1;
  const dayKey = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
  return briefings[dayKey % briefings.length].missionId;
}
