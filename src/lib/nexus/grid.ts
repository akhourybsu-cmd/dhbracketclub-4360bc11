// Nexus Defense — Grid & Path Layouts
//
// Battlefield is a 7×9 grid with a single enemy traversal path. Multiple path
// variants are supported so different missions / endless selections can route
// hostiles along visually distinct shapes.
//
// Each variant must:
//   • Stay inside the 7×9 grid
//   • Use a single contiguous orthogonal path (no diagonals, no branches)
//   • End at a single nexus cell
//
// Every reachable UI map layout now routes to a distinct real path variant
// (see LAYOUT_TO_PATH_VARIANT in mapLayouts.ts). The engine is still
// single-spawn / single-core; layouts whose art shows multiple entries are
// framed as lanes that CONVERGE into one corridor. True multi-source routing
// remains a separate future engine pass.
//
// Backwards compat: `PATH`, `BUILD_TILES`, `NEXUS_CELL`, `isPath`, `isBuildable`,
// and `pathToXY` are still exported as the canonical-layout helpers for any
// caller that doesn't yet thread a layout id (the simulator, tests, etc.).

export const GRID_COLS = 7;
export const GRID_ROWS = 9;

export interface Cell { col: number; row: number; }

/* ─── Path variants ──────────────────────────────────────────────────
   Keep cell counts within ±2 of the default (23) to preserve balance.
   Each path is single-spawn → single-nexus. */

const PATH_DEFAULT: Cell[] = [
  // Original S-curve (left-top → bottom-right). Used as the canonical
  // routing for every mission/layout that doesn't ship its own variant.
  { col: 0, row: 0 },
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 3, row: 0 },
  { col: 3, row: 1 },
  { col: 3, row: 2 },
  { col: 4, row: 2 },
  { col: 5, row: 2 },
  { col: 5, row: 3 },
  { col: 5, row: 4 },
  { col: 4, row: 4 },
  { col: 3, row: 4 },
  { col: 2, row: 4 },
  { col: 1, row: 4 },
  { col: 1, row: 5 },
  { col: 1, row: 6 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  { col: 5, row: 7 },
  { col: 5, row: 8 },
  { col: 6, row: 8 },
];

const PATH_BEND: Cell[] = [
  // Single bend — simple, used for the tutorial / classic-lane endless.
  // Enters top-left, runs across, drops down the right column.
  { col: 0, row: 0 },
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 3, row: 0 },
  { col: 4, row: 0 },
  { col: 5, row: 0 },
  { col: 6, row: 0 },
  { col: 6, row: 1 },
  { col: 6, row: 2 },
  { col: 6, row: 3 },
  { col: 6, row: 4 },
  { col: 6, row: 5 },
  { col: 6, row: 6 },
  { col: 6, row: 7 },
  { col: 6, row: 8 },
];

const PATH_ZIGZAG: Cell[] = [
  // Multi-bend zig-zag corridor. Heavy chokepoints reward splash towers.
  { col: 0, row: 0 },
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 2, row: 1 },
  { col: 2, row: 2 },
  { col: 3, row: 2 },
  { col: 4, row: 2 },
  { col: 4, row: 3 },
  { col: 4, row: 4 },
  { col: 3, row: 4 },
  { col: 2, row: 4 },
  { col: 2, row: 5 },
  { col: 2, row: 6 },
  { col: 3, row: 6 },
  { col: 4, row: 6 },
  { col: 5, row: 6 },
  { col: 6, row: 6 },
  { col: 6, row: 7 },
  { col: 6, row: 8 },
];

const PATH_SPIRAL: Cell[] = [
  // Inward spiral — long path, lots of fire windows on the inner coil.
  { col: 0, row: 0 },
  { col: 1, row: 0 },
  { col: 2, row: 0 },
  { col: 3, row: 0 },
  { col: 4, row: 0 },
  { col: 5, row: 0 },
  { col: 6, row: 0 },
  { col: 6, row: 1 },
  { col: 6, row: 2 },
  { col: 6, row: 3 },
  { col: 6, row: 4 },
  { col: 6, row: 5 },
  { col: 6, row: 6 },
  { col: 5, row: 6 },
  { col: 4, row: 6 },
  { col: 3, row: 6 },
  { col: 3, row: 5 },
  { col: 3, row: 4 },
  { col: 4, row: 4 },
  { col: 5, row: 4 },
  { col: 5, row: 5 },
  { col: 5, row: 6 },
  { col: 5, row: 7 },
  { col: 5, row: 8 },
  { col: 6, row: 8 },
];

const PATH_SERPENTINE: Cell[] = [
  // Big three-sweep S — long boustrophedon across the whole board.
  { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 }, { col: 4, row: 0 }, { col: 5, row: 0 }, { col: 6, row: 0 },
  { col: 6, row: 1 }, { col: 6, row: 2 }, { col: 6, row: 3 },
  { col: 5, row: 3 }, { col: 4, row: 3 }, { col: 3, row: 3 }, { col: 2, row: 3 }, { col: 1, row: 3 }, { col: 0, row: 3 },
  { col: 0, row: 4 }, { col: 0, row: 5 }, { col: 0, row: 6 },
  { col: 1, row: 6 }, { col: 2, row: 6 }, { col: 3, row: 6 }, { col: 4, row: 6 }, { col: 5, row: 6 }, { col: 6, row: 6 },
  { col: 6, row: 7 }, { col: 6, row: 8 },
];

const PATH_HORSESHOE: Cell[] = [
  // U-shape: down the left wall, across the bottom, up the right wall.
  { col: 0, row: 0 }, { col: 0, row: 1 }, { col: 0, row: 2 }, { col: 0, row: 3 }, { col: 0, row: 4 },
  { col: 0, row: 5 }, { col: 0, row: 6 }, { col: 0, row: 7 }, { col: 0, row: 8 },
  { col: 1, row: 8 }, { col: 2, row: 8 }, { col: 3, row: 8 }, { col: 4, row: 8 }, { col: 5, row: 8 }, { col: 6, row: 8 },
  { col: 6, row: 7 }, { col: 6, row: 6 }, { col: 6, row: 5 }, { col: 6, row: 4 }, { col: 6, row: 3 }, { col: 6, row: 2 }, { col: 6, row: 1 }, { col: 6, row: 0 },
];

const PATH_CHICANE: Cell[] = [
  // Tight top-down chicane with sharp double-backs to the centre core.
  { col: 3, row: 0 }, { col: 3, row: 1 }, { col: 3, row: 2 },
  { col: 2, row: 2 }, { col: 1, row: 2 },
  { col: 1, row: 3 }, { col: 1, row: 4 },
  { col: 2, row: 4 }, { col: 3, row: 4 }, { col: 4, row: 4 }, { col: 5, row: 4 },
  { col: 5, row: 5 }, { col: 5, row: 6 },
  { col: 4, row: 6 }, { col: 3, row: 6 },
  { col: 3, row: 7 }, { col: 3, row: 8 },
];

const PATH_SWITCHBACK: Cell[] = [
  // Descending switchbacks — alternating right/left ledges down the board.
  { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 }, { col: 4, row: 0 }, { col: 5, row: 0 }, { col: 6, row: 0 },
  { col: 6, row: 1 }, { col: 6, row: 2 },
  { col: 5, row: 2 }, { col: 4, row: 2 },
  { col: 4, row: 3 }, { col: 4, row: 4 },
  { col: 5, row: 4 }, { col: 6, row: 4 },
  { col: 6, row: 5 }, { col: 6, row: 6 },
  { col: 5, row: 6 }, { col: 4, row: 6 }, { col: 3, row: 6 },
  { col: 3, row: 7 }, { col: 3, row: 8 },
];

const PATH_FUNNEL: Cell[] = [
  // A long approach that narrows into a straight central killbox at the nexus.
  { col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }, { col: 3, row: 0 },
  { col: 3, row: 1 }, { col: 3, row: 2 },
  { col: 4, row: 2 }, { col: 5, row: 2 }, { col: 6, row: 2 },
  { col: 6, row: 3 }, { col: 6, row: 4 },
  { col: 5, row: 4 }, { col: 4, row: 4 }, { col: 3, row: 4 },
  { col: 3, row: 5 }, { col: 3, row: 6 }, { col: 3, row: 7 }, { col: 3, row: 8 },
];

/** Engine-level path variant ids. Adding a new id requires a path entry here. */
export type PathVariantId =
  | 'default' | 'bend' | 'zigzag' | 'spiral'
  | 'serpentine' | 'horseshoe' | 'chicane' | 'switchback' | 'funnel';

const PATHS_BY_VARIANT: Record<PathVariantId, Cell[]> = {
  default: PATH_DEFAULT,
  bend: PATH_BEND,
  zigzag: PATH_ZIGZAG,
  spiral: PATH_SPIRAL,
  serpentine: PATH_SERPENTINE,
  horseshoe: PATH_HORSESHOE,
  chicane: PATH_CHICANE,
  switchback: PATH_SWITCHBACK,
  funnel: PATH_FUNNEL,
};

/* ─── Layout factory ─────────────────────────────────────────────── */

export interface GridLayout {
  variantId: PathVariantId;
  PATH: Cell[];
  BUILD_TILES: Cell[];
  NEXUS_CELL: Cell;
  isPath(col: number, row: number): boolean;
  isBuildable(col: number, row: number): boolean;
  pathToXY(pathIndex: number, progress: number): { x: number; y: number };
}

function buildLayout(variantId: PathVariantId): GridLayout {
  const path = PATHS_BY_VARIANT[variantId];
  const pathSet = new Set(path.map(c => `${c.col},${c.row}`));

  function isPathFn(col: number, row: number): boolean {
    return pathSet.has(`${col},${row}`);
  }

  // Build tiles: every non-path cell that's orthogonally adjacent to a path cell.
  const buildList: Cell[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (isPathFn(c, r)) continue;
      const adj: Array<[number, number]> = [
        [c - 1, r], [c + 1, r], [c, r - 1], [c, r + 1],
      ];
      if (adj.some(([cc, rr]) => isPathFn(cc, rr))) buildList.push({ col: c, row: r });
    }
  }
  const buildSet = new Set(buildList.map(c => `${c.col},${c.row}`));

  return {
    variantId,
    PATH: path,
    BUILD_TILES: buildList,
    NEXUS_CELL: path[path.length - 1],
    isPath: isPathFn,
    isBuildable(col: number, row: number) {
      return buildSet.has(`${col},${row}`);
    },
    pathToXY(pathIndex: number, progress: number) {
      const a = path[Math.min(pathIndex, path.length - 1)];
      const b = path[Math.min(pathIndex + 1, path.length - 1)];
      return {
        x: a.col + (b.col - a.col) * progress,
        y: a.row + (b.row - a.row) * progress,
      };
    },
  };
}

/** Memoised per-variant layout — built lazily on first request. */
const LAYOUT_CACHE = new Map<PathVariantId, GridLayout>();

export function getGridLayout(variantId?: PathVariantId | string | null): GridLayout {
  // Defensive: any unknown id (including legacy saved runs without a variant)
  // collapses to 'default'. Callers should never crash on a bad id.
  const v = (variantId && variantId in PATHS_BY_VARIANT)
    ? (variantId as PathVariantId)
    : 'default';
  let layout = LAYOUT_CACHE.get(v);
  if (!layout) {
    layout = buildLayout(v);
    LAYOUT_CACHE.set(v, layout);
  }
  return layout;
}

/* ─── Default exports (canonical layout) — backwards compat ─────────
   These keep the original public API working: simulator, tests, and any
   caller that doesn't yet thread a layout id will continue to behave
   exactly as before. */

const DEFAULT_LAYOUT = getGridLayout('default');

export const PATH: Cell[] = DEFAULT_LAYOUT.PATH;
export const BUILD_TILES: Cell[] = DEFAULT_LAYOUT.BUILD_TILES;
export const NEXUS_CELL: Cell = DEFAULT_LAYOUT.NEXUS_CELL;
export const isPath = DEFAULT_LAYOUT.isPath;
export const isBuildable = DEFAULT_LAYOUT.isBuildable;
export const pathToXY = DEFAULT_LAYOUT.pathToXY;

/* ─── Math helper (path-independent) ─────────────────────────────── */

export function distanceCells(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
