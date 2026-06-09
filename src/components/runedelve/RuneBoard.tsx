import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RuneCell } from './RuneCell';
import { BOARD_SIZE, type RuneType } from '@/lib/runedelve/dungeonGenerator';
import { isAdjacent, cellKey, type Cell } from '@/lib/runedelve/boardEngine';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { cn } from '@/lib/utils';

const RUNE_PREVIEW: Record<RuneType, { glyph: string; label: string; effect: (n: number) => string }> = {
  red: { glyph: '⚔', label: 'Attack', effect: (n) => `${n * 8} dmg` },
  blue: { glyph: '✦', label: 'Mana', effect: (n) => `+${n >= 5 ? 2 : 1} orb${n >= 5 ? 's' : ''}` },
  green: { glyph: '❀', label: 'Heal', effect: (n) => `+${n * 6} HP` },
  gold: { glyph: '◈', label: 'Guard', effect: (n) => `+${1 + Math.floor(n / 3)} shield` },
};

interface Props {
  grid: RuneType[][];
  disabled?: boolean;
  onChainComplete: (chain: Cell[]) => void;
  /** Set of `${r}-${c}` keys that are currently sealed and uninteractable. */
  seals?: Set<string>;
  /** Set of `${r}-${c}` keys that are corrupted (chain-able but costly). */
  corruptedCells?: Set<string>;
  /** Subset of `corruptedCells` that are active spreaders. */
  corruptionSources?: Set<string>;
  /** Eclipsed cells — cannot START a chain, can extend one. */
  eclipsedCells?: Set<string>;
  /** Linked-pair cells — show 🔗 indicator. */
  linkedCells?: Set<string>;
  /** Column index that drifts each turn (Shifting Runes mechanic). -1 = none. */
  shiftingColumn?: number;
  /** Optional per-rune effect override (keyed by RuneType). When present,
   *  replaces the default static preview so it can reflect class multipliers
   *  (Warrior 1.25× red, Mage 2 mana on blue, Cleric 1.5× green) and chain
   *  tier bonuses (chain 6/7/8+). */
  effectOverride?: Partial<Record<RuneType, (n: number) => string>>;
  /** Treasure cells from the chamber's layout — chaining through them
   *  pays bonus score + shards. Rendered as a gold sparkle overlay. */
  treasureCells?: Set<string>;
  /** Hazard cells from the chamber's layout — chaining through them
   *  costs HP. Rendered as a red glow overlay. */
  hazardCells?: Set<string>;
}

// Mobile-first rune board with pointer-driven chain selection.
export function RuneBoard({ grid, disabled, onChainComplete, seals, corruptedCells, corruptionSources, eclipsedCells, linkedCells, shiftingColumn, effectOverride, treasureCells, hazardCells }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [chain, setChain] = useState<Cell[]>([]);
  const draggingRef = useRef(false);
  const { play } = useSoundEffect();

  // Compute cell size from container width — keeps board crisp on any phone.
  const [cellSize, setCellSize] = useState(56);
  useEffect(() => {
    const update = () => {
      const w = containerRef.current?.clientWidth ?? 320;
      const gap = 8;
      const usable = w - gap * (BOARD_SIZE - 1) - 16; // minus padding
      // Touch-target minimum 44px for accessible drag input on small phones.
      setCellSize(Math.max(44, Math.floor(usable / BOARD_SIZE)));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const chainSet = useMemo(() => new Set(chain.map(cellKey)), [chain]);
  const chainType = chain.length ? grid[chain[0].r]?.[chain[0].c] : null;

  const tryAddCell = useCallback((target: Cell) => {
    if (disabled) return;
    if (seals?.has(cellKey(target))) return;
    setChain(prev => {
      if (!prev.length) {
        // Eclipse Tiles: can't START on an eclipsed cell.
        if (eclipsedCells?.has(cellKey(target))) {
          toast('🌑 Eclipsed runes can\'t start a chain', { duration: 1400 });
          return prev;
        }
        return [target];
      }
      const key = cellKey(target);
      // Allow backtracking by one step.
      if (prev.length >= 2 && cellKey(prev[prev.length - 2]) === key) {
        return prev.slice(0, -1);
      }
      if (prev.some(c => cellKey(c) === key)) return prev;
      const last = prev[prev.length - 1];
      if (!isAdjacent(last, target)) return prev;
      const startType = grid[prev[0].r]?.[prev[0].c];
      if (grid[target.r]?.[target.c] !== startType) return prev;
      // light haptic + audio feedback on add
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try { (navigator as any).vibrate?.(12); } catch {}
      }
      play('tap');
      return [...prev, target];
    });
  }, [disabled, grid, play, seals, eclipsedCells]);

  const cellFromPoint = (x: number, y: number): Cell | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const node = el.closest('[data-rune-cell]') as HTMLElement | null;
    if (!node) return null;
    const r = Number(node.dataset.r);
    const c = Number(node.dataset.c);
    if (Number.isNaN(r) || Number.isNaN(c)) return null;
    return { r, c };
  };

  const handlePointerDown = (r: number, c: number) => (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    draggingRef.current = true;
    // Do NOT setPointerCapture — capturing on the first cell prevents
    // pointermove from reporting the correct elementFromPoint for sibling cells on iOS.
    setChain([{ r, c }]);
  };

  // Use document-level move so dragging across cells works reliably on iOS Safari.
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (!draggingRef.current || disabled) return;
      const cell = cellFromPoint(e.clientX, e.clientY);
      if (cell) tryAddCell(cell);
    };
    const handleUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setChain(prev => {
        if (prev.length >= 3) {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try { (navigator as any).vibrate?.(25); } catch {}
          }
          play('success');
          onChainComplete(prev);
        } else if (prev.length > 0) {
          toast('Need 3+ runes to chain', { duration: 1500 });
        }
        return [];
      });
    };
    window.addEventListener('pointermove', handleMove, { passive: true });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [disabled, onChainComplete, tryAddCell]);

  return (
    <div className="w-full flex flex-col items-center">
      <div
        ref={containerRef}
        className={cn(
          'w-full max-w-[400px] p-2.5 rounded-2xl select-none rd-board-frame',
        )}
        style={{
          touchAction: 'none',
        }}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${BOARD_SIZE}, ${cellSize}px)`,
            gridAutoRows: `${cellSize}px`,
            gap: 8,
            justifyContent: 'center',
          }}
        >
          {grid.map((row, r) =>
            row.map((rune, c) => {
              const isSel = chainSet.has(`${r}-${c}`);
              const k = `${r}-${c}`;
              const isSealed = seals?.has(k) ?? false;
              const isCorrupted = corruptedCells?.has(k) ?? false;
              const isSource = corruptionSources?.has(k) ?? false;
              const isEclipsed = eclipsedCells?.has(k) ?? false;
              const isLinked = linkedCells?.has(k) ?? false;
              const isShifting = (shiftingColumn ?? -1) === c;
              const isTreasure = treasureCells?.has(k) ?? false;
              const isHazard = hazardCells?.has(k) ?? false;
              return (
                <RuneCell
                  key={`${r}-${c}`}
                  dataR={r}
                  dataC={c}
                  type={rune}
                  size={cellSize}
                  selected={isSel}
                  sealed={isSealed}
                  corrupted={isCorrupted}
                  corruptionSource={isSource}
                  eclipsed={isEclipsed}
                  linked={isLinked}
                  shifting={isShifting}
                  treasure={isTreasure}
                  hazard={isHazard}
                  onPointerDown={handlePointerDown(r, c)}
                />
              );
            })
          )}
        </div>
      </div>
      {chain.length > 0 && chainType && (
        <div className="mt-3 flex items-center gap-2 text-[12px] font-bold tabular-nums">
          <span className="text-base">{RUNE_PREVIEW[chainType].glyph}</span>
          <span>{RUNE_PREVIEW[chainType].label}</span>
          <span className="text-muted-foreground">·</span>
          <span className={cn(chain.length >= 3 ? 'text-primary' : 'text-muted-foreground')}>
            {chain.length >= 3
              ? (effectOverride?.[chainType] ?? RUNE_PREVIEW[chainType].effect)(chain.length)
              : `${chain.length}/3`}
          </span>
        </div>
      )}
    </div>
  );
}
