import { Fragment, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ABILITIES } from '@/lib/nexus/abilities';
import { ENEMIES } from '@/lib/nexus/enemies';
import { TOWERS, towerDamageAt, towerRangeAt, towerSellValue, towerUpgradeCost } from '@/lib/nexus/towers';
import { GRID_COLS, GRID_ROWS, getGridLayout } from '@/lib/nexus/grid';
import { BattleState, TargetMode, TowerKind } from '@/lib/nexus/types';
import { cn } from '@/lib/utils';
import { Heart, ChevronUp, X, Crosshair } from 'lucide-react';
import { TowerIcon } from './TowerIcon';
import { EnemyMarker, getEnemyAccent } from './EnemyMarker';

// hsl strings for SVG/inline use — anchored to nx tokens conceptually but
// resolved here so they render reliably inside framer-motion wrappers.
const TOWER_HSL: Record<TowerKind, { c: string; cDim: string; bg: string; text: string }> = {
  pulse: { c: 'hsl(188 92% 56%)', cDim: 'hsl(188 92% 56% / 0.18)', bg: 'hsl(188 92% 56% / 0.14)', text: 'hsl(188 92% 78%)' },
  arc:   { c: 'hsl(265 80% 70%)', cDim: 'hsl(265 80% 70% / 0.18)', bg: 'hsl(265 80% 70% / 0.14)', text: 'hsl(265 80% 84%)' },
  cryo:  { c: 'hsl(200 95% 70%)', cDim: 'hsl(200 95% 70% / 0.18)', bg: 'hsl(200 95% 70% / 0.14)', text: 'hsl(200 95% 84%)' },
  rail:  { c: 'hsl(38 95% 60%)',  cDim: 'hsl(38 95% 60% / 0.18)',  bg: 'hsl(38 95% 60% / 0.14)',  text: 'hsl(38 95% 78%)' },
};

interface Props {
  state: BattleState;
  selectedTowerKind: TowerKind | null;
  selectedTowerId: string | null;
  onSelectKind: (k: TowerKind | null) => void;
  onPlace: (col: number, row: number) => void;
  onSelectTower: (id: string | null) => void;
  onUpgrade: (id: string) => void;
  onSell: (id: string) => void;
  onSetPriority: (id: string, mode: TargetMode) => void;
  onCastAbility: (kind: 'orbital' | 'emp') => void;
  onStartWave: () => void;
}

const TARGET_MODES: { mode: TargetMode; label: string }[] = [
  { mode: 'first', label: 'FIRST' },
  { mode: 'last', label: 'LAST' },
  { mode: 'strong', label: 'STRONG' },
  { mode: 'close', label: 'CLOSE' },
];

export function NexusBattleScreen({
  state, selectedTowerKind, selectedTowerId,
  onSelectKind, onPlace, onSelectTower, onUpgrade, onSell, onSetPriority, onCastAbility, onStartWave,
}: Props) {
  // Layout-aware grid helpers — every render reads the path/build tiles for
  // the run's active variant. Cached per variantId by getGridLayout().
  const layout = useMemo(() => getGridLayout(state.pathVariantId), [state.pathVariantId]);
  const { isPath, isBuildable, NEXUS_CELL, pathToXY } = layout;
  // SVG polyline points for the path (centers of each cell). Recomputed when
  // the variant changes — cheap, stable for the lifetime of the run.
  const PATH_POINTS = useMemo(
    () => layout.PATH.map((c) => `${(c.col + 0.5) * (100 / GRID_COLS)},${(c.row + 0.5) * (100 / GRID_ROWS)}`).join(' '),
    [layout],
  );
  const cells = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) cells.push({ c, r });
  }
  const selectedTower = selectedTowerId ? state.towers.find(t => t.id === selectedTowerId) : null;
  const hpPctBase = state.baseHp / state.baseHpMax;
  const hpColor = hpPctBase > 0.5 ? 'hsl(150 80% 60%)' : hpPctBase > 0.25 ? 'hsl(38 95% 60%)' : 'hsl(350 85% 62%)';

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto select-none">
      {/* ───── Unified command HUD rail ───── */}
      <div
        className="relative px-3 py-2"
        style={{
          background:
            'linear-gradient(180deg, hsl(var(--nx-panel) / 0.96), hsl(var(--nx-panel) / 0.55))',
          borderBottom: '1px solid hsl(var(--nx-cyan) / 0.3)',
          boxShadow:
            '0 1px 0 hsl(var(--nx-cyan) / 0.18), 0 8px 16px -10px hsl(var(--nx-cyan) / 0.35)',
        }}
      >
        {/* Corner brackets — make whole HUD feel like one panel */}
        <span aria-hidden className="absolute top-1 left-1 w-2 h-2 border-l border-t" style={{ borderColor: 'hsl(var(--nx-cyan) / 0.7)' }} />
        <span aria-hidden className="absolute top-1 right-1 w-2 h-2 border-r border-t" style={{ borderColor: 'hsl(var(--nx-cyan) / 0.7)' }} />
        <div className="flex items-stretch gap-3">
          {/* HP block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <Heart className="w-2.5 h-2.5" style={{ color: hpColor }} />
              <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.14em' }}>NEXUS</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums leading-none" style={{ color: hpColor, textShadow: `0 0 8px ${hpColor}` }}>{state.baseHp}</span>
              <span className="text-[9px] font-bold tabular-nums" style={{ color: 'hsl(0 0% 100% / 0.4)' }}>/{state.baseHpMax}</span>
            </div>
            <div className="mt-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'hsl(0 0% 100% / 0.06)' }}>
              <div className="h-full transition-all" style={{ width: `${Math.max(0, hpPctBase * 100)}%`, background: hpColor, boxShadow: `0 0 6px ${hpColor}` }} />
            </div>
          </div>

          {/* Vertical divider */}
          <div className="w-px self-stretch" style={{ background: 'linear-gradient(180deg, transparent, hsl(var(--nx-cyan) / 0.35), transparent)' }} />

          {/* Energy block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] leading-none" style={{ color: 'hsl(var(--nx-amber))' }}>⚡</span>
              <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.14em' }}>ENERGY</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums leading-none" style={{ color: 'hsl(var(--nx-amber))', textShadow: '0 0 8px hsl(var(--nx-amber) / 0.7)' }}>{state.energy}</span>
            </div>
            <div className="mt-1 h-[3px] rounded-full overflow-hidden nx-scan-bar" style={{ background: 'hsl(var(--nx-amber) / 0.15)' }}>
              <div className="h-full" style={{ width: `100%`, background: 'linear-gradient(90deg, hsl(var(--nx-amber) / 0.55), hsl(var(--nx-amber)))' }} />
            </div>
          </div>

          {/* Vertical divider */}
          <div className="w-px self-stretch" style={{ background: 'linear-gradient(180deg, transparent, hsl(var(--nx-cyan) / 0.35), transparent)' }} />

          {/* Wave block */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[10px] leading-none" style={{ color: 'hsl(var(--nx-cyan))' }}>◫</span>
              <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.14em' }}>WAVE</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black tabular-nums leading-none" style={{ color: 'hsl(var(--nx-cyan))', textShadow: '0 0 8px hsl(var(--nx-cyan) / 0.7)' }}>{Math.max(0, state.waveIndex + 1)}</span>
              <span className="text-[9px] font-bold tabular-nums" style={{ color: 'hsl(0 0% 100% / 0.4)' }}>/{state.totalWaves ?? '·'}</span>
            </div>
            <div className="mt-1 flex gap-[2px]">
              {Array.from({ length: state.totalWaves || 0 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 h-[3px] rounded-sm"
                  style={{
                    background: i <= state.waveIndex
                      ? 'hsl(var(--nx-cyan))'
                      : 'hsl(var(--nx-cyan) / 0.18)',
                    boxShadow: i <= state.waveIndex ? '0 0 4px hsl(var(--nx-cyan))' : undefined,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ───── Battle grid ───── */}
      <div className="relative flex-1 flex items-center justify-center p-2 overflow-hidden">
        <div
          className="relative grid w-full max-w-[420px] overflow-hidden nx-clip"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
            aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`,
            background:
              'radial-gradient(ellipse 80% 60% at 50% 40%, hsl(218 50% 9%), hsl(220 60% 4%) 75%)',
            border: '1px solid hsl(var(--nx-cyan) / 0.35)',
            boxShadow:
              'inset 0 0 24px hsl(var(--nx-cyan) / 0.12), 0 0 28px -8px hsl(var(--nx-cyan) / 0.45)',
          }}
        >
          {/* Subtle background grid */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-[0.18]"
            style={{
              backgroundImage:
                'linear-gradient(hsl(var(--nx-cyan) / 0.6) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--nx-cyan) / 0.6) 1px, transparent 1px)',
              backgroundSize: `${100 / GRID_COLS}% ${100 / GRID_ROWS}%`,
            }}
          />

          {/* Energy corridor (path) — SVG glow + scan dashes + arrows */}
          <svg
            aria-hidden
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <marker
                id="nx-path-arrow"
                viewBox="0 0 10 10"
                refX="6"
                refY="5"
                markerWidth="3.5"
                markerHeight="3.5"
                orient="auto-start-reverse"
              >
                <path d="M0 1 L8 5 L0 9 Z" fill="hsl(188 95% 88%)" opacity="0.95" />
              </marker>
            </defs>
            {/* Outer glow */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 92% 56% / 0.28)"
              strokeWidth="11"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'blur(2.5px)' }}
            />
            {/* Lane fill */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 92% 60% / 0.45)"
              strokeWidth="6.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* Inner bright core */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 95% 92%)"
              strokeWidth="0.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              opacity="0.85"
              markerMid="url(#nx-path-arrow)"
            />
            {/* Running scan dashes — energy moving toward the nexus */}
            <polyline
              points={PATH_POINTS}
              fill="none"
              stroke="hsl(188 95% 92%)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="2.5 9"
              opacity="0.85"
            >
              <animate attributeName="stroke-dashoffset" from="0" to="-23" dur="1.4s" repeatCount="indefinite" />
            </polyline>
          </svg>

          {/* Cell grid (interaction layer) */}
          {cells.map(({ c, r }) => {
            const onPath = isPath(c, r);
            const buildable = isBuildable(c, r);
            const isNexus = c === NEXUS_CELL.col && r === NEXUS_CELL.row;
            const placed = state.towers.find(t => t.cell.col === c && t.cell.row === r);
            const canPlaceHere = !!selectedTowerKind && buildable && !placed && state.energy >= TOWERS[selectedTowerKind].cost;
            return (
              <button
                key={`${c}-${r}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (placed) {
                    onSelectTower(placed.id);
                    onSelectKind(null);
                  } else if (selectedTowerKind && buildable) {
                    onPlace(c, r);
                  } else {
                    onSelectTower(null);
                  }
                }}
                className={cn(
                  'relative transition-colors',
                  buildable && !placed && !canPlaceHere && 'hover:bg-cyan-400/10',
                  canPlaceHere && 'bg-emerald-400/25',
                )}
                style={
                  canPlaceHere
                    ? {
                        boxShadow:
                          'inset 0 0 0 1.5px hsl(150 80% 60% / 0.85), inset 0 0 10px hsl(150 80% 55% / 0.25)',
                      }
                    : buildable && !placed
                      ? {
                          background:
                            'linear-gradient(145deg, hsl(218 45% 12% / 0.55), hsl(218 55% 6% / 0.85))',
                          boxShadow:
                            'inset 0 0 0 1px hsl(var(--nx-cyan) / 0.12), inset 0 1px 0 hsl(0 0% 100% / 0.04), inset 0 -2px 3px hsl(0 0% 0% / 0.35)',
                        }
                      : !buildable && !onPath && !isNexus
                        ? {
                            background:
                              'linear-gradient(145deg, hsl(218 50% 8%), hsl(220 60% 4%))',
                            boxShadow:
                              'inset 0 0 0 1px hsl(0 0% 100% / 0.025), inset 0 1px 0 hsl(0 0% 100% / 0.03)',
                          }
                        : undefined
                }
              >
                {/* Nexus core */}
                {isNexus && (
                  <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                    <span
                      className="nx-reactor-glow absolute inset-1 rounded-full"
                      style={{
                        background:
                          'radial-gradient(circle, hsl(var(--nx-amber) / 0.6), hsl(var(--nx-amber) / 0.15) 60%, transparent 75%)',
                      }}
                    />
                    <span
                      className="relative w-[68%] h-[68%] rounded-full flex items-center justify-center"
                      style={{
                        background:
                          'radial-gradient(circle at 35% 30%, hsl(38 95% 75%), hsl(38 95% 50%) 55%, hsl(20 70% 30%) 90%)',
                        boxShadow:
                          '0 0 10px hsl(var(--nx-amber) / 0.7), inset 0 0 6px hsl(0 0% 100% / 0.4), inset 0 -2px 4px hsl(0 0% 0% / 0.4)',
                        border: '1px solid hsl(38 95% 80% / 0.7)',
                      }}
                    >
                      <span className="text-[7px] font-black" style={{ color: 'hsl(20 60% 18%)' }}>◉</span>
                    </span>
                  </span>
                )}

                {/* Hardpoint dot on empty buildable tiles */}
                {buildable && !placed && !canPlaceHere && (
                  <span aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 nx-hardpoint" />
                )}

                {/* Path waypoint nodes (subtle) */}
                {onPath && !isNexus && (
                  <span
                    aria-hidden
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full"
                    style={{ background: 'hsl(188 92% 75% / 0.35)' }}
                  />
                )}

                {/* Placed tower */}
                {placed && (
                  <div
                    className={cn(
                      'absolute inset-[3px] rounded-md flex items-center justify-center',
                      selectedTowerId === placed.id && 'ring-2',
                    )}
                    style={{
                      background: TOWER_HSL[placed.kind].bg,
                      border: `1.5px solid ${TOWER_HSL[placed.kind].c}`,
                      boxShadow: `0 0 8px ${TOWER_HSL[placed.kind].cDim}, inset 0 0 6px hsl(0 0% 100% / 0.06)`,
                      color: TOWER_HSL[placed.kind].c,
                      // @ts-expect-error css var
                      '--tw-ring-color': 'hsl(150 80% 60% / 0.85)',
                    }}
                  >
                    <TowerIcon kind={placed.kind} size={20} />
                    <span
                      className="absolute -top-[5px] -right-[5px] text-[7px] font-black px-[3px] py-[1px] rounded-sm leading-none"
                      style={{
                        background: 'hsl(218 50% 8%)',
                        color: TOWER_HSL[placed.kind].text,
                        border: `1px solid ${TOWER_HSL[placed.kind].c}`,
                      }}
                    >
                      L{placed.level}
                    </span>
                  </div>
                )}
              </button>
            );
          })}

          {/* Enemies overlay — distinct silhouettes per type */}
          <div className="absolute inset-0 pointer-events-none">
            {state.enemies.map(e => {
              const def = ENEMIES[e.kind];
              const accent = getEnemyAccent(e.kind);
              const pos = pathToXY(e.pathIndex, e.progress);
              const left = ((pos.x + 0.5) / GRID_COLS) * 100;
              const top = ((pos.y + 0.5) / GRID_ROWS) * 100;
              const hpPct = Math.max(0, e.hp / def.hp);
              const size = e.kind === 'boss' ? 30 : e.kind === 'walker' ? 22 : 17;
              const barW = e.kind === 'boss' ? 22 : 14;
              return (
                <div
                  key={e.id}
                  className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-100"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  {/* Boss aura — extra threat presence */}
                  {e.kind === 'boss' && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full nx-reactor-glow"
                      style={{
                        width: size + 14,
                        height: size + 14,
                        background: `radial-gradient(circle, ${accent.glow}, transparent 70%)`,
                      }}
                    />
                  )}

                  {/* Stealth cloak ring (dashed) */}
                  {def.stealth && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: size + 6,
                        height: size + 6,
                        border: `1px dashed ${accent.edge}`,
                        opacity: 0.55,
                      }}
                    />
                  )}

                  {/* Shield bubble */}
                  {e.shield > 0 && (
                    <span
                      aria-hidden
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{
                        width: size + 8,
                        height: size + 8,
                        background: 'radial-gradient(circle, hsl(200 95% 70% / 0.18), transparent 70%)',
                        border: '1px solid hsl(200 95% 75% / 0.85)',
                        boxShadow: '0 0 6px hsl(200 95% 70% / 0.7), inset 0 0 4px hsl(200 95% 80% / 0.4)',
                      }}
                    />
                  )}

                  <div
                    className={cn('relative flex items-center justify-center', def.stealth && 'opacity-75')}
                    style={{ width: size, height: size }}
                  >
                    <EnemyMarker kind={e.kind} size={size} />
                  </div>

                  {/* HP bar */}
                  <div
                    className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-[2px] rounded overflow-hidden"
                    style={{ width: barW, background: 'hsl(0 0% 0% / 0.7)', border: '0.5px solid hsl(0 0% 100% / 0.15)' }}
                  >
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${hpPct * 100}%`,
                        background: hpPct > 0.5 ? 'hsl(150 85% 60%)' : hpPct > 0.25 ? 'hsl(38 95% 60%)' : 'hsl(350 90% 62%)',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Range circle for selected placed tower */}
          {selectedTower && (
            <div
              className="absolute pointer-events-none rounded-full"
              style={{
                left: `${((selectedTower.cell.col + 0.5) / GRID_COLS) * 100}%`,
                top: `${((selectedTower.cell.row + 0.5) / GRID_ROWS) * 100}%`,
                width: `${(towerRangeAt(selectedTower.kind, selectedTower.level) * 2 / GRID_COLS) * 100}%`,
                height: `${(towerRangeAt(selectedTower.kind, selectedTower.level) * 2 / GRID_ROWS) * 100}%`,
                transform: 'translate(-50%, -50%)',
                border: '1px dashed hsl(150 80% 60% / 0.7)',
                background: 'hsl(150 80% 60% / 0.05)',
                boxShadow: 'inset 0 0 12px hsl(150 80% 60% / 0.18)',
              }}
            />
          )}

          {/* Shot effects */}
          <div className="absolute inset-0 pointer-events-none">
            <AnimatePresence>
              {state.events.filter(ev => ev.type === 'shot').map((ev, i) => {
                if (ev.type !== 'shot') return null;
                const x1 = ((ev.from.col + 0.5) / GRID_COLS) * 100;
                const y1 = ((ev.from.row + 0.5) / GRID_ROWS) * 100;
                const x2 = ((ev.to.x + 0.5) / GRID_COLS) * 100;
                const y2 = ((ev.to.y + 0.5) / GRID_ROWS) * 100;
                const stroke = ev.tower === 'pulse' ? '#22d3ee'
                  : ev.tower === 'arc' ? '#a78bfa'
                  : ev.tower === 'cryo' ? '#7dd3fc'
                  : '#fbbf24';
                return (
                  <motion.svg
                    key={`${ev.t}-${i}`}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={ev.tower === 'rail' ? 0.6 : 0.35} />
                  </motion.svg>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Traveling projectiles + impact flashes — gives shots weight */}
          <div className="absolute inset-0 pointer-events-none">
            <AnimatePresence>
              {state.events.filter(ev => ev.type === 'shot').map((ev, i) => {
                if (ev.type !== 'shot') return null;
                const sx = ((ev.from.col + 0.5) / GRID_COLS) * 100;
                const sy = ((ev.from.row + 0.5) / GRID_ROWS) * 100;
                const tx = ((ev.to.x + 0.5) / GRID_COLS) * 100;
                const ty = ((ev.to.y + 0.5) / GRID_ROWS) * 100;
                const col = ev.tower === 'pulse' ? '#22d3ee' : ev.tower === 'arc' ? '#a78bfa' : ev.tower === 'cryo' ? '#7dd3fc' : '#fbbf24';
                const travels = ev.tower === 'pulse' || ev.tower === 'rail';
                const travelDur = ev.tower === 'rail' ? 0.08 : 0.14;
                return (
                  <Fragment key={`proj-${ev.t}-${i}`}>
                    {travels && (
                      <motion.span
                        aria-hidden
                        className="absolute rounded-full"
                        initial={{ left: `${sx}%`, top: `${sy}%`, opacity: 1 }}
                        animate={{ left: `${tx}%`, top: `${ty}%`, opacity: 1 }}
                        transition={{ duration: travelDur, ease: 'linear' }}
                        style={{ width: ev.tower === 'rail' ? 5 : 4, height: ev.tower === 'rail' ? 5 : 4, transform: 'translate(-50%,-50%)', background: col, boxShadow: `0 0 8px ${col}, 0 0 14px ${col}` }}
                      />
                    )}
                    <motion.span
                      aria-hidden
                      className="absolute rounded-full"
                      initial={{ opacity: 0.9, scale: 0.3 }}
                      animate={{ opacity: 0, scale: 1.35 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.28, delay: travels ? travelDur : 0, ease: 'easeOut' }}
                      style={{ left: `${tx}%`, top: `${ty}%`, width: 12, height: 12, transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${col}, transparent 70%)` }}
                    />
                  </Fragment>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Kill bursts — quick energy disintegration at the death position */}
          <div className="absolute inset-0 pointer-events-none">
            <AnimatePresence>
              {state.events.filter(ev => ev.type === 'kill').map((ev, i) => {
                if (ev.type !== 'kill') return null;
                const left = ((ev.at.x + 0.5) / GRID_COLS) * 100;
                const top = ((ev.at.y + 0.5) / GRID_ROWS) * 100;
                return (
                  <motion.span
                    key={`kill-${ev.t}-${i}`}
                    aria-hidden
                    initial={{ opacity: 0.95, scale: 0.35 }}
                    animate={{ opacity: 0, scale: 1.6 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className="absolute rounded-full"
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      width: 26,
                      height: 26,
                      transform: 'translate(-50%, -50%)',
                      background:
                        'radial-gradient(circle, hsl(38 95% 80% / 0.95), hsl(188 92% 70% / 0.55) 45%, transparent 75%)',
                      boxShadow:
                        '0 0 14px hsl(38 95% 70% / 0.7), 0 0 22px hsl(188 92% 60% / 0.45)',
                      filter: 'blur(0.4px)',
                    }}
                  />
                );
              })}
            </AnimatePresence>
          </div>

          {/* Ability flash — orbital impact / EMP suppression ring */}
          <div className="absolute inset-0 pointer-events-none">
            <AnimatePresence>
              {state.events.filter(ev => ev.type === 'ability').map((ev, i) => {
                if (ev.type !== 'ability') return null;
                const isOrbital = ev.ability === 'orbital';
                return (
                  <motion.span
                    key={`ab-${ev.t}-${i}`}
                    aria-hidden
                    initial={{ opacity: 0.85, scale: 0.4 }}
                    animate={{ opacity: 0, scale: 2.4 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="absolute top-1/2 left-1/2 rounded-full"
                    style={{
                      width: '70%',
                      height: '70%',
                      transform: 'translate(-50%, -50%)',
                      border: isOrbital
                        ? '2px solid hsl(38 95% 70% / 0.85)'
                        : '2px solid hsl(265 80% 75% / 0.85)',
                      background: isOrbital
                        ? 'radial-gradient(circle, hsl(38 95% 70% / 0.35), transparent 65%)'
                        : 'radial-gradient(circle, hsl(265 80% 70% / 0.30), transparent 65%)',
                      boxShadow: isOrbital
                        ? '0 0 30px hsl(38 95% 60% / 0.7)'
                        : '0 0 30px hsl(265 80% 70% / 0.7)',
                    }}
                  />
                );
              })}
            </AnimatePresence>
          </div>

          {/* Leak / breach flash — red vignette pulse over the battlefield */}
          <AnimatePresence>
            {state.events.some(ev => ev.type === 'leak') && (
              <motion.span
                key={`leak-${state.events.find(ev => ev.type === 'leak')?.t ?? 0}`}
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.55, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 100%, hsl(350 85% 55% / 0.55), transparent 65%)',
                  mixBlendMode: 'screen',
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Start wave / status overlay */}
        {(state.status === 'pre' || state.status === 'between') && (
          <button
            onClick={onStartWave}
            className="absolute bottom-3 left-3 right-3 nx-clip-sm py-3 font-black text-sm active:scale-95 transition nx-title"
            style={{
              background: 'linear-gradient(180deg, hsl(150 80% 55%), hsl(150 80% 42%))',
              color: 'hsl(150 30% 8%)',
              boxShadow: '0 0 18px hsl(150 80% 55% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.35)',
            }}
          >
            {state.status === 'pre'
              ? `▶  DEPLOY WAVE 01 / ${String(state.totalWaves).padStart(2, '0')}`
              : `▶  WAVE ${String(state.waveIndex + 2).padStart(2, '0')} / ${String(state.totalWaves).padStart(2, '0')}  ·  ${Math.ceil(state.betweenWaveMs / 1000)}s  ·  TAP TO RUSH`}
          </button>
        )}
      </div>

      {/* ───── Selected tower panel ───── */}
      {selectedTower && (
        <div className="px-3 pb-2 space-y-1.5">
          <div
            className="nx-clip-sm p-2 flex items-center gap-2"
            style={{
              background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 8%))',
              border: '1px solid hsl(150 80% 55% / 0.5)',
              boxShadow: '0 0 12px -4px hsl(150 80% 55% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.05)',
            }}
          >
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
              style={{
                background: TOWER_HSL[selectedTower.kind].bg,
                border: `1.5px solid ${TOWER_HSL[selectedTower.kind].c}`,
                color: TOWER_HSL[selectedTower.kind].c,
                boxShadow: `0 0 10px ${TOWER_HSL[selectedTower.kind].cDim}`,
              }}
            >
              <TowerIcon kind={selectedTower.kind} size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-black truncate">
                {TOWERS[selectedTower.kind].name}
                <span className="ml-1.5 text-[9px] font-bold nx-title" style={{ color: TOWER_HSL[selectedTower.kind].text }}>L{selectedTower.level}</span>
              </div>
              <div className="text-[10px] text-foreground/65 nx-title">
                DMG <span className="text-foreground">{towerDamageAt(selectedTower.kind, selectedTower.level)}</span> · RNG <span className="text-foreground">{towerRangeAt(selectedTower.kind, selectedTower.level).toFixed(1)}</span>
              </div>
            </div>
            <button
              onClick={() => onUpgrade(selectedTower.id)}
              disabled={selectedTower.level >= 3 || state.energy < towerUpgradeCost(selectedTower.kind, selectedTower.level)}
              className="px-2.5 py-2 rounded-md text-[11px] font-black disabled:opacity-40 active:scale-95 nx-title"
              style={{
                background: 'hsl(150 80% 55% / 0.18)',
                color: 'hsl(150 80% 70%)',
                border: '1px solid hsl(150 80% 55% / 0.5)',
              }}
            >
              <ChevronUp className="w-3 h-3 inline" /> {selectedTower.level >= 3 ? 'MAX' : towerUpgradeCost(selectedTower.kind, selectedTower.level)}
            </button>
            <button
              onClick={() => onSell(selectedTower.id)}
              className="px-2.5 py-2 rounded-md text-[11px] font-black active:scale-95 nx-title"
              style={{
                background: 'hsl(350 85% 62% / 0.14)',
                color: 'hsl(350 85% 78%)',
                border: '1px solid hsl(350 85% 62% / 0.4)',
              }}
            >
              <X className="w-3 h-3 inline" /> {towerSellValue(selectedTower.kind, selectedTower.level)}
            </button>
          </div>

          {/* Targeting priority — live agency over what this tower shoots */}
          <div
            className="nx-clip-sm px-2 py-1.5 flex items-center gap-1.5"
            style={{
              background: 'linear-gradient(180deg, hsl(218 40% 10%), hsl(218 42% 7%))',
              border: '1px solid hsl(var(--nx-cyan) / 0.35)',
            }}
          >
            <span className="flex items-center gap-1 shrink-0 nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.14em' }}>
              <Crosshair className="w-3 h-3" style={{ color: 'hsl(var(--nx-cyan))' }} /> TARGET
            </span>
            <div className="flex-1 grid grid-cols-4 gap-1">
              {TARGET_MODES.map(({ mode, label }) => {
                const active = (selectedTower.targetPriority ?? 'first') === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => onSetPriority(selectedTower.id, mode)}
                    className="py-1 rounded-sm text-[8px] font-black nx-title active:scale-95 transition"
                    style={{
                      background: active ? 'hsl(var(--nx-cyan) / 0.22)' : 'hsl(0 0% 100% / 0.04)',
                      border: `1px solid ${active ? 'hsl(var(--nx-cyan) / 0.8)' : 'hsl(0 0% 100% / 0.1)'}`,
                      color: active ? 'hsl(var(--nx-cyan))' : 'hsl(0 0% 100% / 0.55)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ───── Command deck: tower cards + ability bar ───── */}
      <div
        className="relative px-2 pb-2 pt-1.5"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--nx-panel) / 0.55), hsl(var(--nx-panel) / 0.97))',
          borderTop: '1px solid hsl(var(--nx-cyan) / 0.3)',
          boxShadow: '0 -1px 0 hsl(var(--nx-cyan) / 0.18), 0 -8px 16px -10px hsl(var(--nx-cyan) / 0.3)',
        }}
      >
        {/* Tower cards — distinct framed slots with letter badge + icon */}
        <div className="grid grid-cols-4 gap-1.5 mb-2">
          {(['pulse','arc','cryo','rail'] as TowerKind[]).map((kind) => {
            const def = TOWERS[kind];
            const selected = selectedTowerKind === kind;
            const affordable = state.energy >= def.cost;
            const shortName = kind === 'pulse' ? 'PULSE' : kind === 'arc' ? 'ARC' : kind === 'cryo' ? 'CRYO' : 'RAIL';
            const letter = kind === 'pulse' ? 'P' : kind === 'arc' ? 'A' : kind === 'cryo' ? 'C' : 'R';
            const c = TOWER_HSL[kind];
            return (
              <button
                key={kind}
                onClick={() => { onSelectKind(selected ? null : kind); onSelectTower(null); }}
                className={cn(
                  'relative min-h-[78px] nx-clip-sm flex flex-col items-stretch justify-between p-1.5 transition active:scale-[0.97]',
                  !affordable && 'opacity-55',
                )}
                style={{
                  background: selected
                    ? `linear-gradient(180deg, ${c.bg}, hsl(218 50% 6% / 0.95))`
                    : 'linear-gradient(180deg, hsl(218 50% 10%), hsl(218 55% 6%))',
                  border: selected ? `1.5px solid ${c.c}` : `1px solid ${c.c.replace(')', ' / 0.4)').replace('hsl(', 'hsl(')}`,
                  boxShadow: selected
                    ? `0 0 14px -2px ${c.c.replace(')', ' / 0.55)').replace('hsl(', 'hsl(')}, inset 0 1px 0 hsl(0 0% 100% / 0.08)`
                    : 'inset 0 1px 0 hsl(0 0% 100% / 0.04)',
                  color: c.c,
                }}
              >
                {/* Top row: letter badge + tower icon */}
                <div className="flex items-center justify-between gap-1">
                  <span
                    className="flex items-center justify-center w-5 h-5 rounded-sm text-[10px] font-black leading-none"
                    style={{
                      background: `${c.bg}`,
                      border: `1px solid ${c.c}`,
                      color: c.c,
                      boxShadow: selected ? `0 0 6px ${c.cDim}` : undefined,
                    }}
                  >
                    {letter}
                  </span>
                  <span style={{ filter: `drop-shadow(0 0 4px ${c.cDim})` }}>
                    <TowerIcon kind={kind} size={22} />
                  </span>
                </div>

                {/* Selected indicator chevron */}
                {selected && (
                  <span
                    aria-hidden
                    className="absolute -top-[1px] left-1/2 -translate-x-1/2 w-0 h-0"
                    style={{
                      borderLeft: '5px solid transparent',
                      borderRight: '5px solid transparent',
                      borderBottom: `5px solid ${c.c}`,
                      filter: `drop-shadow(0 0 4px ${c.c})`,
                    }}
                  />
                )}

                {/* Bottom: name + cost */}
                <div className="flex flex-col items-center mt-1">
                  <span
                    className="nx-title text-[9px] leading-none"
                    style={{ color: selected ? c.text : 'hsl(0 0% 100% / 0.78)', letterSpacing: '0.16em' }}
                  >
                    {shortName}
                  </span>
                  <span
                    className="text-[10px] font-black tabular-nums leading-none mt-1 flex items-center gap-px"
                    style={{ color: affordable ? 'hsl(var(--nx-amber))' : 'hsl(350 80% 65%)' }}
                  >
                    <span style={{ filter: 'drop-shadow(0 0 3px hsl(var(--nx-amber) / 0.7))' }}>⚡</span>
                    {def.cost}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Ability footer: dial · emblem · dial */}
        <div
          className="relative nx-clip-sm flex items-stretch"
          style={{
            background: 'linear-gradient(180deg, hsl(218 50% 9%), hsl(218 55% 5%))',
            border: '1px solid hsl(var(--nx-cyan) / 0.3)',
            boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.05), 0 0 12px -4px hsl(var(--nx-cyan) / 0.35)',
            minHeight: 52,
          }}
        >
          {state.abilities.map((a, idx) => {
            const def = ABILITIES[a.kind];
            const ready = a.cooldownMs <= 0;
            const pct = ready ? 1 : 1 - (a.cooldownMs / def.cooldownMs);
            const remainSec = Math.ceil(a.cooldownMs / 1000);
            const shortKey = a.kind === 'orbital' ? 'O' : 'E';
            const tone = ready ? 'hsl(var(--nx-amber))' : 'hsl(var(--nx-cyan))';
            // Render center divider after the first ability
            return (
              <Fragment key={a.kind}>
                {idx === 1 && (
                  <div
                    key="divider"
                    className="relative flex items-center justify-center px-2"
                    style={{
                      borderLeft: '1px solid hsl(var(--nx-cyan) / 0.25)',
                      borderRight: '1px solid hsl(var(--nx-cyan) / 0.25)',
                    }}
                  >
                    <span
                      aria-hidden
                      className="w-6 h-6 flex items-center justify-center rounded-sm"
                      style={{
                        background: 'hsl(218 60% 6%)',
                        border: '1px solid hsl(var(--nx-cyan) / 0.5)',
                        color: 'hsl(var(--nx-cyan))',
                        boxShadow: '0 0 6px hsl(var(--nx-cyan) / 0.4)',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2 L20 7 V17 L12 22 L4 17 V7 Z" stroke="currentColor" strokeWidth="1.6" />
                      </svg>
                    </span>
                  </div>
                )}
                <button
                  key={a.kind}
                  onClick={() => ready && onCastAbility(a.kind)}
                  disabled={!ready}
                  className="relative flex-1 flex items-center justify-between px-3 py-2 active:scale-[0.97] transition nx-title"
                  style={{ color: ready ? 'hsl(0 0% 98%)' : 'hsl(0 0% 100% / 0.45)' }}
                >
                  {/* Left circular dial: key + glow */}
                  <span className="relative flex items-center justify-center" style={{ width: 30, height: 30 }}>
                    <svg width="30" height="30" viewBox="0 0 30 30" className="absolute inset-0">
                      <circle cx="15" cy="15" r="12" fill="none" stroke="hsl(var(--nx-cyan) / 0.2)" strokeWidth="1.5" />
                      <circle
                        cx="15" cy="15" r="12" fill="none"
                        stroke={tone}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeDasharray={`${pct * 75.4} 75.4`}
                        strokeDashoffset="0"
                        transform="rotate(-90 15 15)"
                        style={{ filter: ready ? `drop-shadow(0 0 4px ${tone})` : undefined }}
                      />
                    </svg>
                    <span
                      className="text-[11px] font-black"
                      style={{ color: ready ? 'hsl(var(--nx-amber))' : 'hsl(0 0% 100% / 0.55)' }}
                    >
                      {shortKey}
                    </span>
                  </span>

                  <span
                    className="text-[10px] font-black flex-1 text-center"
                    style={{
                      letterSpacing: '0.18em',
                      color: ready ? 'hsl(0 0% 98%)' : 'hsl(0 0% 100% / 0.5)',
                    }}
                  >
                    {def.name.toUpperCase()}
                  </span>

                  {/* Right circular dial: countdown / ready */}
                  <span className="relative flex items-center justify-center" style={{ width: 32, height: 32 }}>
                    <svg width="32" height="32" viewBox="0 0 32 32" className="absolute inset-0">
                      <circle cx="16" cy="16" r="13" fill="none" stroke="hsl(var(--nx-cyan) / 0.2)" strokeWidth="1.5" />
                      <circle
                        cx="16" cy="16" r="13" fill="none"
                        stroke={tone}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeDasharray={`${pct * 81.7} 81.7`}
                        transform="rotate(-90 16 16)"
                        style={{ filter: ready ? `drop-shadow(0 0 5px ${tone})` : undefined }}
                      />
                    </svg>
                    <span
                      className="text-[10px] font-black tabular-nums"
                      style={{ color: ready ? 'hsl(var(--nx-amber))' : 'hsl(var(--nx-cyan))' }}
                    >
                      {ready ? `${Math.round(def.cooldownMs / 1000)}s` : `${remainSec}s`}
                    </span>
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
