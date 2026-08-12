// Nexus Defense — Map Layout Catalog
//
// Visual / metadata layer for the mission selection, briefing, and hub screens.
// Each layout supplies:
//   • a stylised mini-map (rendered by <MapLayoutPreview/> as inline SVG)
//   • a short tactical description used in briefing cards
//   • a category (solo / endless / coop) so screens can filter
//   • an accent palette so the preview reads at a glance
//
// IMPORTANT: Single-source layouts (single spawn, single core) drive the
// engine's actual path routing via `getEnginePathVariant()` below — pick the
// engine variant that matches the visual shape. Multi-source layouts keep
// their visual identity but currently fall back to the canonical engine
// path; multi-spawn / multi-core engine routing is a separate future pass.

export type MapLayoutCategory = 'solo' | 'endless' | 'coop';

export type MapLayoutId =
  // Solo campaign
  | 'tutorial_outpost'
  | 'broken_corridor'
  | 'central_nexus'
  | 'twin_gate'
  | 'reactor_ring'
  | 'final_stand'
  // Endless
  | 'classic_lane'
  | 'split_path'
  | 'spiral_core'
  | 'crossfire_grid'
  | 'outer_rim'
  | 'dual_nexus'
  // Co-op
  | 'dual_core'
  | 'north_south'
  | 'four_gate'
  | 'shared_reactor'
  | 'partner_lanes'
  | 'nexus_siege';

export interface MapLayout {
  id: MapLayoutId;
  name: string;
  /** One-liner for cards & lists. */
  tagline: string;
  /** Longer briefing copy used inside MissionBriefingCard. */
  description: string;
  category: MapLayoutCategory;
  /** Difficulty tier (1–5) — drives the difficulty dots on cards. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Visual style hints used by MapLayoutPreview. */
  preview: {
    /** Primary accent (HSL string). */
    accent: string;
    /** Secondary accent for highlights. */
    accent2?: string;
    /** Path shape — see MapLayoutPreview for the renderer. */
    shape:
      | 'lane'           // single horizontal lane
      | 'split'          // two diverging lanes
      | 'spiral'         // inward spiral toward core
      | 'cross'          // 4-direction cross intersection
      | 'rim'            // arcs around the nexus
      | 'dual'           // two parallel lanes feeding two cores
      | 'outpost'        // simple bend toward small core
      | 'corridor'       // narrow zig-zag
      | 'cardinal'       // 4 entries, central nexus
      | 'twingate'       // 2 entries top, single core
      | 'ring'           // circular path around reactor
      | 'standoff'       // converging tri-lane
      | 'fourgate'       // 4 outer gates, single shared core
      | 'shared'         // U-shape feeding shared reactor
      | 'partner'        // two stacked lanes (one per ally)
      | 'siege';         // funnel into nexus core
    /** Number of enemy spawn points. */
    spawns: number;
    /** Number of nexus cores to defend. */
    cores: number;
  };
  /** Short tags for chips. */
  tags: string[];
}

export const MAP_LAYOUTS: Record<MapLayoutId, MapLayout> = {
  // ──────────────────────────────────────────────────────────────────
  // SOLO CAMPAIGN — distinct feel per mission tier
  // ──────────────────────────────────────────────────────────────────
  tutorial_outpost: {
    id: 'tutorial_outpost',
    name: 'Tutorial Outpost',
    tagline: 'A single bend leading into a small forward outpost.',
    description: 'Frontline outpost on the edge of friendly space. One approach lane bends toward the core — perfect for learning placement and ability rhythm.',
    category: 'solo',
    difficulty: 1,
    preview: { accent: 'hsl(150 80% 60%)', accent2: 'hsl(188 92% 56%)', shape: 'outpost', spawns: 1, cores: 1 },
    tags: ['Onboarding', 'Single Lane', 'Linear'],
  },
  broken_corridor: {
    id: 'broken_corridor',
    name: 'Broken Corridor',
    tagline: 'Narrow zig-zag corridor with hard chokepoints.',
    description: 'A collapsed maintenance corridor forces hostiles to weave through tight angles. Stack splash damage on the bends and the swarm thins quickly.',
    category: 'solo',
    difficulty: 2,
    preview: { accent: 'hsl(188 92% 56%)', accent2: 'hsl(38 95% 60%)', shape: 'corridor', spawns: 1, cores: 1 },
    tags: ['Chokepoints', 'AoE Friendly', 'Linear'],
  },
  central_nexus: {
    id: 'central_nexus',
    name: 'Central Nexus',
    tagline: 'Open arena with the core dead-center — pressure from any side.',
    description: 'A round command plaza with the nexus exposed in the middle. Multiple approach vectors mean you can\'t over-commit to one flank.',
    category: 'solo',
    difficulty: 3,
    preview: { accent: 'hsl(265 80% 70%)', accent2: 'hsl(188 92% 56%)', shape: 'cardinal', spawns: 4, cores: 1 },
    tags: ['Open Field', 'Multi-vector', '360°'],
  },
  twin_gate: {
    id: 'twin_gate',
    name: 'Twin Gate Breach',
    tagline: 'Two gates merge into one tight, twisting corridor.',
    description: 'Hostiles pour through twin gates that merge into a single chicane toward the core. The double-backs bunch the swarm up — perfect for splash and slows.',
    category: 'solo',
    difficulty: 3,
    preview: { accent: 'hsl(38 95% 60%)', accent2: 'hsl(188 92% 56%)', shape: 'twingate', spawns: 2, cores: 1 },
    tags: ['Chicane', 'Convergence', 'Chokepoints'],
  },
  reactor_ring: {
    id: 'reactor_ring',
    name: 'Reactor Ring',
    tagline: 'Circular ring path orbits the reactor core.',
    description: 'A massive defensive ring around an exposed reactor. Enemies orbit before angling inward — Cryo on the ring, Rail on the inner radius.',
    category: 'solo',
    difficulty: 4,
    preview: { accent: 'hsl(200 95% 70%)', accent2: 'hsl(38 95% 60%)', shape: 'ring', spawns: 3, cores: 1 },
    tags: ['Ring Path', 'Reactor', 'Layered Defense'],
  },
  final_stand: {
    id: 'final_stand',
    name: 'Final Stand',
    tagline: 'Funnel attack culminating in a Siege Mech assault.',
    description: 'The last sector before the nexus. Three converging lanes feed a shared killbox — survive the swarm waves, then break the Siege Mech.',
    category: 'solo',
    difficulty: 5,
    preview: { accent: 'hsl(350 85% 62%)', accent2: 'hsl(38 95% 60%)', shape: 'standoff', spawns: 3, cores: 1 },
    tags: ['Boss Mission', 'Convergence', 'Final Wave'],
  },

  // ──────────────────────────────────────────────────────────────────
  // ENDLESS — replayable arena layouts
  // ──────────────────────────────────────────────────────────────────
  classic_lane: {
    id: 'classic_lane',
    name: 'Classic Lane Defense',
    tagline: 'The standard horizontal lane — tower defense fundamentals.',
    description: 'The signature single-lane layout. Wave after wave funnels through one corridor — a pure test of efficiency, economy, and upgrade timing.',
    category: 'endless',
    difficulty: 2,
    preview: { accent: 'hsl(38 95% 60%)', shape: 'lane', spawns: 1, cores: 1 },
    tags: ['Single Lane', 'Iconic', 'Tutorial-Friendly'],
  },
  split_path: {
    id: 'split_path',
    name: 'Split Path',
    tagline: 'A lane that splits and rejoins in tight switchbacks.',
    description: 'The corridor breaks into switchbacks that fold back on themselves before rejoining. Towers placed on the ledges rake the lane two or three times over.',
    category: 'endless',
    difficulty: 3,
    preview: { accent: 'hsl(188 92% 56%)', accent2: 'hsl(38 95% 60%)', shape: 'split', spawns: 2, cores: 1 },
    tags: ['Switchbacks', 'Repeat Coverage', 'Adaptive'],
  },
  spiral_core: {
    id: 'spiral_core',
    name: 'Spiral Core',
    tagline: 'Hostiles spiral inward — long path, lots of fire windows.',
    description: 'The path coils around the nexus before reaching the core. Long total length means even mid-tier towers get full value if you place them on the inner spiral.',
    category: 'endless',
    difficulty: 3,
    preview: { accent: 'hsl(265 80% 70%)', accent2: 'hsl(188 92% 56%)', shape: 'spiral', spawns: 1, cores: 1 },
    tags: ['Long Path', 'Inner Coverage', 'Marathon'],
  },
  crossfire_grid: {
    id: 'crossfire_grid',
    name: 'Crossfire Grid',
    tagline: 'The lane crosses back over itself — central towers rule.',
    description: 'A long serpentine that sweeps back across the board three times. A tower stack in the middle catches the swarm on every pass — brutal crossfire value.',
    category: 'endless',
    difficulty: 4,
    preview: { accent: 'hsl(150 80% 60%)', accent2: 'hsl(188 92% 56%)', shape: 'cross', spawns: 4, cores: 1 },
    tags: ['Serpentine', 'Crossfire', 'Volume'],
  },
  outer_rim: {
    id: 'outer_rim',
    name: 'Outer Rim Breach',
    tagline: 'Arc-shaped perimeter — defend the frontier, not the core.',
    description: 'The fight happens on the outer rim of the sector. An arc-shaped path around the nexus rewards range-heavy loadouts.',
    category: 'endless',
    difficulty: 4,
    preview: { accent: 'hsl(200 95% 70%)', accent2: 'hsl(38 95% 60%)', shape: 'rim', spawns: 2, cores: 1 },
    tags: ['Range Meta', 'Perimeter', 'Outer Lane'],
  },
  dual_nexus: {
    id: 'dual_nexus',
    name: 'Overtaxed Core',
    tagline: 'A long funnel dumps the whole assault onto one core.',
    description: 'Every lane converges into a single narrowing funnel to an overtaxed core. The straightest, most punishing route on the board — bring your heaviest hitters.',
    category: 'endless',
    difficulty: 5,
    preview: { accent: 'hsl(350 85% 62%)', accent2: 'hsl(265 80% 70%)', shape: 'siege', spawns: 1, cores: 1 },
    tags: ['Funnel', 'High Pressure', 'Mythic'],
  },

  // ──────────────────────────────────────────────────────────────────
  // CO-OP — team layouts
  // ──────────────────────────────────────────────────────────────────
  dual_core: {
    id: 'dual_core',
    name: 'Dual Core Defense',
    tagline: 'Each ally guards their own core — share resources to survive.',
    description: 'Two adjacent cores, one per ally. Independent boards, shared wave clock. Communication wins this map.',
    category: 'coop',
    difficulty: 3,
    preview: { accent: 'hsl(280 90% 78%)', accent2: 'hsl(188 92% 56%)', shape: 'dual', spawns: 2, cores: 2 },
    tags: ['Per-Player Core', 'Shared Clock', 'Coordinate'],
  },
  north_south: {
    id: 'north_south',
    name: 'North/South Breach',
    tagline: 'Two opposing fronts — cover top and bottom.',
    description: 'Hostiles assault from the north and south simultaneously. Split the team, hold both lines, share emergency abilities.',
    category: 'coop',
    difficulty: 4,
    preview: { accent: 'hsl(280 90% 78%)', accent2: 'hsl(38 95% 60%)', shape: 'split', spawns: 2, cores: 1 },
    tags: ['Two Fronts', 'Role Split', 'Coordinate'],
  },
  four_gate: {
    id: 'four_gate',
    name: 'Four-Gate Assault',
    tagline: 'Four entry gates surround a shared core.',
    description: 'Four cardinal gates converge on a single shared nexus. Up to four allies can each take a gate — or stack two on the heaviest assault vector.',
    category: 'coop',
    difficulty: 4,
    preview: { accent: 'hsl(280 90% 78%)', accent2: 'hsl(150 80% 60%)', shape: 'fourgate', spawns: 4, cores: 1 },
    tags: ['4 Gates', 'Shared Core', 'Squad'],
  },
  shared_reactor: {
    id: 'shared_reactor',
    name: 'Shared Reactor',
    tagline: 'A U-shaped path feeds a shared reactor — overlap your range.',
    description: 'Long U-shape into the reactor. Allies stack ranges on the bend for crushing crossfire — but the path is long, so economy matters.',
    category: 'coop',
    difficulty: 3,
    preview: { accent: 'hsl(280 90% 78%)', accent2: 'hsl(200 95% 70%)', shape: 'shared', spawns: 1, cores: 1 },
    tags: ['Shared Reactor', 'Crossfire', 'Long Path'],
  },
  partner_lanes: {
    id: 'partner_lanes',
    name: 'Partner Lanes',
    tagline: 'Two stacked lanes — one per ally — sharing one core.',
    description: 'Two stacked horizontal lanes. Each ally takes a lane; whoever falls behind drains the shared core HP. Mirror your composition.',
    category: 'coop',
    difficulty: 2,
    preview: { accent: 'hsl(280 90% 78%)', accent2: 'hsl(265 80% 70%)', shape: 'partner', spawns: 2, cores: 1 },
    tags: ['Two Lanes', 'Per-Ally Lane', 'Easy Coordination'],
  },
  nexus_siege: {
    id: 'nexus_siege',
    name: 'Nexus Siege',
    tagline: 'Funnel into the central nexus — the final co-op showdown.',
    description: 'The endgame map. Three converging lanes, one shared nexus, escalating boss spawns. Bring your best loadout — and your best ally.',
    category: 'coop',
    difficulty: 5,
    preview: { accent: 'hsl(350 85% 62%)', accent2: 'hsl(280 90% 78%)', shape: 'siege', spawns: 3, cores: 1 },
    tags: ['Boss Map', 'Endgame', 'Convergence'],
  },
};

/* ─── Selectors ─────────────────────────────────────────────────────── */

export function getLayout(id: MapLayoutId | undefined | null): MapLayout | undefined {
  if (!id) return undefined;
  return MAP_LAYOUTS[id];
}

export function getLayoutsByCategory(category: MapLayoutCategory): MapLayout[] {
  return Object.values(MAP_LAYOUTS).filter(l => l.category === category);
}

export const SOLO_LAYOUTS = getLayoutsByCategory('solo');
export const ENDLESS_LAYOUTS = getLayoutsByCategory('endless');
export const COOP_LAYOUTS = getLayoutsByCategory('coop');

/** Default layout used when a mission has no explicit assignment. */
export const DEFAULT_SOLO_LAYOUT: MapLayoutId = 'tutorial_outpost';
export const DEFAULT_ENDLESS_LAYOUT: MapLayoutId = 'classic_lane';
export const DEFAULT_COOP_LAYOUT: MapLayoutId = 'shared_reactor';

/**
 * Map a UI-level layout id to the engine path variant the battle engine
 * actually routes through. Multi-spawn / multi-core layouts (twin_gate,
 * crossfire_grid, dual_nexus, the entire coop set) intentionally fall back
 * to 'default' — the engine is single-spawn / single-core, so the visual
 * identity is preserved on briefings but routing collapses to the canonical
 * S-curve for those.
 */
export type EnginePathVariantId =
  | 'default' | 'bend' | 'zigzag' | 'spiral'
  | 'serpentine' | 'horseshoe' | 'chicane' | 'switchback' | 'funnel';

// Every layout now routes to a DISTINCT real path so each battlefield plays
// differently — no more silent collapse to the default S-curve.
const LAYOUT_TO_PATH_VARIANT: Record<MapLayoutId, EnginePathVariantId> = {
  // Solo campaign
  tutorial_outpost: 'bend',
  broken_corridor: 'zigzag',
  central_nexus: 'serpentine',
  twin_gate: 'chicane',
  reactor_ring: 'spiral',
  final_stand: 'funnel',
  // Endless
  classic_lane: 'bend',
  split_path: 'switchback',
  spiral_core: 'spiral',
  crossfire_grid: 'serpentine',
  outer_rim: 'horseshoe',
  dual_nexus: 'funnel',
  // Co-op
  dual_core: 'horseshoe',
  north_south: 'switchback',
  four_gate: 'serpentine',
  shared_reactor: 'default',
  partner_lanes: 'chicane',
  nexus_siege: 'funnel',
};

export function getEnginePathVariant(layoutId: MapLayoutId | undefined | null): EnginePathVariantId {
  if (!layoutId) return 'default';
  return LAYOUT_TO_PATH_VARIANT[layoutId] ?? 'default';
}
