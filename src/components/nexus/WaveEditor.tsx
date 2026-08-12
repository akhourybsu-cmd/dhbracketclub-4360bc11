// Nexus Defense — Mission Workshop wave editor
//
// Mobile-first editor for an endless / draft mission's wave list. Edits the
// wave array in-place via onChange — no DB calls, no engine touches.
//
// Each wave is a collapsible card showing its spawn groups. Per group you can
// tune: enemy kind, count, interval, delay. Per wave: reward, add/remove
// groups, duplicate, delete, reorder. A pressure chip gives a quick read on
// how punishing the wave will feel before applying live.

import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Copy, ArrowUp, ArrowDown, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnemyKind, Wave, WaveSpawn } from '@/lib/nexus/types';
import { emptySpawn, emptyWave, estimateWavePressure } from '@/lib/nexus/missionDrafts';
import { ENEMIES, ENEMY_KINDS as ALL_ENEMY_KINDS } from '@/lib/nexus/enemies';

const ENEMY_KINDS: EnemyKind[] = ALL_ENEMY_KINDS;

const ENEMY_LABEL = Object.fromEntries(
  ALL_ENEMY_KINDS.map((k) => [k, ENEMIES[k]?.name ?? k]),
) as Record<EnemyKind, string>;

const ENEMY_COLOR_PALETTE = [
  'text-sky-300 border-sky-500/40 bg-sky-500/10',
  'text-amber-200 border-amber-500/40 bg-amber-500/10',
  'text-violet-200 border-violet-500/40 bg-violet-500/10',
  'text-fuchsia-200 border-fuchsia-500/40 bg-fuchsia-500/10',
  'text-rose-200 border-rose-500/40 bg-rose-500/10',
  'text-emerald-200 border-emerald-500/40 bg-emerald-500/10',
  'text-cyan-200 border-cyan-500/40 bg-cyan-500/10',
  'text-lime-200 border-lime-500/40 bg-lime-500/10',
  'text-orange-200 border-orange-500/40 bg-orange-500/10',
  'text-indigo-200 border-indigo-500/40 bg-indigo-500/10',
];

const ENEMY_COLOR = Object.fromEntries(
  ALL_ENEMY_KINDS.map((k, i) => [k, ENEMY_COLOR_PALETTE[i % ENEMY_COLOR_PALETTE.length]]),
) as Record<EnemyKind, string>;

const PRESSURE_COLOR = {
  Light: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  Moderate: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40',
  Heavy: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  Punishing: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
};

interface Props {
  waves: Wave[];
  onChange: (waves: Wave[]) => void;
}

export function WaveEditor({ waves, onChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const reindex = (ws: Wave[]): Wave[] => ws.map((w, i) => ({ ...w, index: i }));

  const updateWave = (i: number, patch: Partial<Wave>) => {
    const next = waves.slice();
    next[i] = { ...next[i], ...patch };
    onChange(reindex(next));
  };

  const updateSpawn = (waveIdx: number, spawnIdx: number, patch: Partial<WaveSpawn>) => {
    const w = waves[waveIdx];
    const spawns = w.spawns.slice();
    spawns[spawnIdx] = { ...spawns[spawnIdx], ...patch };
    updateWave(waveIdx, { spawns });
  };

  const addSpawn = (waveIdx: number) => {
    const w = waves[waveIdx];
    updateWave(waveIdx, { spawns: [...w.spawns, emptySpawn('drone')] });
  };

  const removeSpawn = (waveIdx: number, spawnIdx: number) => {
    const w = waves[waveIdx];
    if (w.spawns.length <= 1) return; // keep at least one
    const spawns = w.spawns.filter((_, i) => i !== spawnIdx);
    updateWave(waveIdx, { spawns });
  };

  const addWave = () => {
    const next = [...waves, emptyWave(waves.length)];
    onChange(reindex(next));
    setOpenIdx(next.length - 1);
  };

  const duplicateWave = (i: number) => {
    const src = waves[i];
    const copy: Wave = {
      ...src,
      spawns: src.spawns.map(s => ({ ...s })),
    };
    const next = [...waves.slice(0, i + 1), copy, ...waves.slice(i + 1)];
    onChange(reindex(next));
    setOpenIdx(i + 1);
  };

  const removeWave = (i: number) => {
    if (waves.length <= 1) return;
    if (!confirm(`Delete Wave ${i + 1}?`)) return;
    const next = waves.filter((_, k) => k !== i);
    onChange(reindex(next));
    setOpenIdx(null);
  };

  const moveWave = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= waves.length) return;
    const next = waves.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(reindex(next));
    setOpenIdx(j);
  };

  return (
    <div className="space-y-2">
      {waves.map((w, i) => {
        const open = openIdx === i;
        const totalEnemies = w.spawns.reduce((a, s) => a + s.count, 0);
        const pressure = estimateWavePressure(w);
        const totalDurationMs = Math.max(
          ...w.spawns.map(s => (s.delayMs ?? 0) + s.intervalMs * Math.max(0, s.count - 1)),
          0,
        );
        return (
          <div key={i} className={cn('rounded-xl border overflow-hidden', open ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border/60 bg-background/40')}>
            <button
              type="button"
              onClick={() => setOpenIdx(open ? null : i)}
              className="w-full px-3 py-2.5 flex items-center justify-between gap-2 active:bg-muted/30"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-muted/40 border border-border/60 flex items-center justify-center text-xs font-bold tabular-nums">{i + 1}</div>
                <div className="text-left min-w-0">
                  <div className="text-sm font-semibold truncate">Wave {i + 1}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {totalEnemies} enemies · {(totalDurationMs / 1000).toFixed(1)}s · +{w.rewardEnergy}E
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-semibold border', PRESSURE_COLOR[pressure.label])}>
                  <Zap className="w-2.5 h-2.5 inline -mt-0.5 mr-0.5" />
                  {pressure.label}
                </span>
                {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            {open && (
              <div className="px-3 pb-3 space-y-3 border-t border-border/40 pt-3">
                {/* Wave-level: reward + actions */}
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Reward energy</label>
                    <input
                      type="number"
                      min={0}
                      max={2000}
                      value={w.rewardEnergy}
                      onChange={e => updateWave(i, { rewardEnergy: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                      className="w-full mt-0.5 px-2 py-1.5 rounded-lg bg-background/60 border border-border/60 text-sm tabular-nums"
                    />
                  </div>
                  <div className="flex flex-col gap-1 pt-3">
                    <div className="flex gap-1">
                      <IconBtn onClick={() => moveWave(i, -1)} disabled={i === 0} title="Move up"><ArrowUp className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn onClick={() => moveWave(i, 1)} disabled={i === waves.length - 1} title="Move down"><ArrowDown className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn onClick={() => duplicateWave(i)} title="Duplicate"><Copy className="w-3.5 h-3.5" /></IconBtn>
                      <IconBtn onClick={() => removeWave(i)} disabled={waves.length <= 1} title="Delete" danger><Trash2 className="w-3.5 h-3.5" /></IconBtn>
                    </div>
                  </div>
                </div>

                {/* Spawn groups */}
                <div className="space-y-2">
                  {w.spawns.map((s, j) => (
                    <div key={j} className={cn('rounded-lg border p-2.5 space-y-2', ENEMY_COLOR[s.enemy])}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">Group {j + 1}</div>
                        <button
                          onClick={() => removeSpawn(i, j)}
                          disabled={w.spawns.length <= 1}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-rose-200 disabled:opacity-30 active:scale-95"
                        >
                          Remove
                        </button>
                      </div>

                      {/* Enemy kind picker */}
                      <div className="grid grid-cols-5 gap-1">
                        {ENEMY_KINDS.map(k => (
                          <button
                            key={k}
                            onClick={() => updateSpawn(i, j, { enemy: k })}
                            className={cn(
                              'px-1 py-1 rounded text-[10px] font-semibold border active:scale-95',
                              s.enemy === k ? 'bg-foreground/10 border-foreground/40 text-foreground' : 'bg-background/40 border-border/60 text-muted-foreground',
                            )}
                          >
                            {ENEMY_LABEL[k]}
                          </button>
                        ))}
                      </div>

                      {/* Numeric controls */}
                      <div className="grid grid-cols-3 gap-2">
                        <NumCell
                          label="Count"
                          value={s.count}
                          min={1} max={200}
                          onChange={v => updateSpawn(i, j, { count: v })}
                        />
                        <NumCell
                          label="Interval ms"
                          value={s.intervalMs}
                          min={100} max={5000} step={50}
                          onChange={v => updateSpawn(i, j, { intervalMs: v })}
                        />
                        <NumCell
                          label="Delay ms"
                          value={s.delayMs ?? 0}
                          min={0} max={30000} step={100}
                          onChange={v => updateSpawn(i, j, { delayMs: v })}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => addSpawn(i)}
                    className="w-full px-3 py-2 rounded-lg border border-dashed border-emerald-500/50 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add enemy group
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addWave}
        className="w-full px-3 py-2.5 rounded-xl border border-dashed border-emerald-500/50 text-emerald-200 text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-[0.98]"
      >
        <Plus className="w-4 h-4" /> Add wave
      </button>
    </div>
  );
}

/* ─────────── Small helpers ─────────── */

function IconBtn({ children, onClick, disabled, danger, title }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean; title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-7 h-7 rounded-md border flex items-center justify-center active:scale-95 disabled:opacity-30',
        danger ? 'border-rose-500/40 bg-rose-500/10 text-rose-200' : 'border-border/60 bg-background/60 text-foreground/80',
      )}
    >
      {children}
    </button>
  );
}

function NumCell({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        type="number"
        value={value}
        min={min} max={max} step={step}
        onChange={e => {
          const n = Number(e.target.value);
          if (Number.isNaN(n)) return;
          onChange(Math.max(min, Math.min(max, n)));
        }}
        className="w-full mt-0.5 px-2 py-1.5 rounded-md bg-background/60 border border-border/60 text-sm tabular-nums"
      />
    </div>
  );
}
