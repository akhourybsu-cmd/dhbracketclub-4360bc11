import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, X, Cpu, Zap, ShieldOff, Clock, ChevronRight, Users, Target, TrendingUp } from 'lucide-react';
import { useResolvedMissions } from '@/hooks/useMissionCalibrations';
import { TOWERS, TOWER_KINDS } from '@/lib/nexus/towers';
import { ABILITY_KINDS } from '@/lib/nexus/abilities';
import type { TowerKind, AbilityKind } from '@/lib/nexus/types';
import { NexusRewardsPanel } from '@/components/nexus/NexusRewardsPanel';
import { MapLayoutPreview } from '@/components/nexus/MapLayoutPreview';
import { getBriefing } from '@/lib/nexus/missionBriefings';
import { getLayout, getLayoutsByCategory, type MapLayoutId } from '@/lib/nexus/mapLayouts';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';

interface RunInsight {
  towerBuilds: Record<TowerKind, number>;
  towerUpgrades: Record<TowerKind, number>;
  towerSells: Record<TowerKind, number>;
  abilityUses: Record<AbilityKind, number>;
  energyStarvedMs: number;
  leaks: number;
  durationSeconds: number;
  kills?: number;
  bossDamage?: number;
  endless?: boolean;
  boostCode?: string | null;
  endlessRewards?: { sigils: Array<{ code: string; first_time: boolean }>; tokens: number } | null;
  operation?: {
    operationId: string | null;
    pointsAwarded: number;
    phase: number;
    status: string;
    duplicate: boolean;
    error?: string;
    affectedPhase?: number;
    priorProgress?: number;
    newProgress?: number;
    priorTarget?: number;
    phaseAdvanced?: boolean;
    operationComplete?: boolean;
  } | null;
}

const PHASE_LABELS: Record<number, { label: string; metric: string; verb: string }> = {
  1: { label: 'Repel the Swarm', metric: 'Enemies neutralized', verb: 'pushed Phase 1' },
  2: { label: 'Hold the Sector', metric: 'Score earned', verb: 'pushed Phase 2' },
  3: { label: 'Crack the Siege Core', metric: 'Boss damage', verb: 'damaged the Siege Core' },
};

export default function NexusResultsPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const id = parseInt(missionId || '1', 10);
  const { missions } = useResolvedMissions();
  const mission = missions.find(m => m.id === id);
  const won = params.get('win') === '1';
  const score = parseInt(params.get('score') || '0', 10);
  const hp = parseInt(params.get('hp') || '0', 10);
  const waves = parseInt(params.get('waves') || '0', 10);
  const cores = parseInt(params.get('cores') || '0', 10);
  const next = missions.find(m => m.id === id + 1);

  const insight = useMemo<RunInsight | null>(() => {
    try {
      const raw = sessionStorage.getItem(`nexus_run_${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, [id]);

  const towerKinds: TowerKind[] = TOWER_KINDS;
  const abilityKinds: AbilityKind[] = ABILITY_KINDS;
  const totalBuilt = insight ? towerKinds.reduce((a, k) => a + (insight.towerBuilds[k] || 0), 0) : 0;
  const totalSells = insight ? towerKinds.reduce((a, k) => a + (insight.towerSells[k] || 0), 0) : 0;
  const totalAbilities = insight ? abilityKinds.reduce((a, k) => a + (insight.abilityUses[k] || 0), 0) : 0;

  const mins = insight ? Math.floor(insight.durationSeconds / 60) : 0;
  const secs = insight ? insight.durationSeconds % 60 : 0;
  const starvedSec = insight ? Math.round(insight.energyStarvedMs / 1000) : 0;

  const accent = won ? 'cyan' : 'rose';
  const ringHex = won ? 'hsl(188 92% 56%)' : 'hsl(350 90% 60%)';

  // Resolve briefing + layout for the deployment-record strip below the verdict.
  // Endless runs honor the localStorage selection set by the loadout map picker;
  // solo runs read the briefing's static layoutId.
  const briefing = getBriefing(id);
  const isEndless = id === ENDLESS_MISSION_ID;
  let layoutId: MapLayoutId | undefined = briefing?.layoutId;
  if (isEndless) {
    try {
      const stored = window.localStorage.getItem('nexus_endless_layout_v1') as MapLayoutId | null;
      const valid = stored && getLayoutsByCategory('endless').some(l => l.id === stored);
      if (valid) layoutId = stored as MapLayoutId;
    } catch { /* private mode etc. — fall back to briefing */ }
  }
  const layout = getLayout(layoutId);

  return (
    <div className="max-w-md mx-auto pb-6 px-3 pt-4">
      {/* Verdict seal */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 180, damping: 16 }}
        className="relative mx-auto w-28 h-28 mb-3"
      >
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, ${ringHex}, transparent 60%, ${ringHex})`,
            opacity: 0.45,
            filter: 'blur(1px)',
          }}
        />
        <div className="absolute inset-1 rounded-full bg-[hsl(218_45%_5%)] border border-white/10" />
        <div
          className={`absolute inset-3 rounded-full flex items-center justify-center border-2 ${
            won ? 'bg-cyan-500/15 border-cyan-400' : 'bg-rose-500/15 border-rose-400'
          }`}
        >
          {won ? <Trophy className="w-9 h-9 text-cyan-300" /> : <X className="w-9 h-9 text-rose-300" />}
        </div>
        {/* Tick marks */}
        {[0, 90, 180, 270].map(deg => (
          <div
            key={deg}
            className="absolute left-1/2 top-1/2 w-px h-2"
            style={{
              background: ringHex,
              transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-58px)`,
              opacity: 0.7,
            }}
          />
        ))}
      </motion.div>

      <div className="text-center mb-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300/70">
          {insight?.endless ? 'Endless · After-Action' : `Mission ${id} · After-Action`}
        </div>
        <h1 className="text-2xl font-black mt-1 tracking-tight">{mission?.name}</h1>
        <div
          className={`inline-block mt-2 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] nx-clip ${
            won
              ? 'bg-cyan-500/15 border border-cyan-400/60 text-cyan-200'
              : 'bg-rose-500/15 border border-rose-400/60 text-rose-200'
          }`}
        >
          {won ? (insight?.endless ? '◆ Sector Defended' : '◆ Nexus Held') : '◆ Nexus Breached'}
        </div>
        {/* Sector cleared note for last solo mission win */}
        {won && !insight?.endless && !next && (
          <div className="mt-2 text-[11px] text-amber-300/90 font-bold">
            ◆ Sector I cleared — try Endless / Co-op next.
          </div>
        )}
      </div>

      {/* Deployment record — which layout the run took place on */}
      {layout && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="relative mb-3 nx-clip-sm overflow-hidden flex items-center gap-3 p-2.5"
          style={{
            background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
            border: `1px solid ${layout.preview.accent.replace(')', ' / 0.32)')}`,
          }}
        >
          <MapLayoutPreview layout={layout} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="nx-pulse-dot inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: layout.preview.accent, boxShadow: `0 0 6px ${layout.preview.accent}` }}
              />
              <p className="nx-title text-[9px]" style={{ color: layout.preview.accent, letterSpacing: '0.22em' }}>
                {isEndless ? 'ENDLESS DEPLOYMENT · LAYOUT' : `MISSION ${String(id).padStart(2, '0')} · LAYOUT`}
              </p>
            </div>
            <p className="text-[12px] font-black truncate">{layout.name}</p>
            <p className="text-[10px] text-foreground/65 leading-snug line-clamp-2">{layout.tagline}</p>
          </div>
        </motion.div>
      )}

      {/* Primary stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Stat label="Score" value={score.toLocaleString()} accent={accent} />
        <Stat label="Waves" value={`${waves}/${mission?.waves.length ?? 0}`} accent={accent} />
        <Stat label="Base HP" value={hp} accent={accent} />
        <Stat label="Cores" value={cores} icon={<Cpu className="w-3 h-3 text-amber-400" />} accent="amber" />
      </div>

      {/* Run Insight */}
      {insight && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative nx-panel nx-clip p-3 mb-4"
        >
          <span className="nx-bracket nx-bracket-tl" />
          <span className="nx-bracket nx-bracket-br" />
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-[0.22em] font-bold text-cyan-300">
              ▌ Combat Telemetry
            </div>
            <div className="flex items-center gap-1 text-[10px] text-cyan-200/70 tabular-nums">
              <Clock className="w-3 h-3" /> {mins}:{String(secs).padStart(2, '0')}
            </div>
          </div>

          {/* Tower mix */}
          <div className="grid grid-cols-4 gap-1.5 mb-2.5">
            {towerKinds.map(k => {
              const built = insight.towerBuilds[k] || 0;
              const upg = insight.towerUpgrades[k] || 0;
              const active = built > 0;
              return (
                <div
                  key={k}
                  className={`relative rounded-md px-1 py-1.5 text-center border ${
                    active
                      ? 'bg-cyan-500/10 border-cyan-400/40'
                      : 'bg-white/[0.02] border-white/5'
                  }`}
                >
                  <div className={`text-[8px] uppercase tracking-wider ${active ? 'text-cyan-300' : 'text-muted-foreground'}`}>
                    {TOWERS[k].name.split(' ')[0]}
                  </div>
                  <div className={`text-base font-black tabular-nums ${active ? 'text-white' : 'text-muted-foreground'}`}>
                    {built}
                  </div>
                  {upg > 0 && (
                    <div className="text-[8px] text-amber-300 tabular-nums font-bold">+{upg}↑</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer micro-stats */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-cyan-100/70">
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              ABILITIES <span className="text-white tabular-nums font-bold">{totalAbilities}</span>
            </span>
            {totalSells > 0 && (
              <span>SELLS <span className="text-white tabular-nums font-bold">{totalSells}</span></span>
            )}
            {insight.leaks > 0 && (
              <span className="flex items-center gap-1 text-rose-300">
                <ShieldOff className="w-3 h-3" /> {insight.leaks} LEAK{insight.leaks > 1 ? 'S' : ''}
              </span>
            )}
            {starvedSec >= 3 && (
              <span className="text-amber-300">⚠ LOW PWR {starvedSec}s</span>
            )}
          </div>

          {/* Tip */}
          {totalBuilt > 0 && towerKinds.filter(k => (insight.towerBuilds[k] || 0) > 0).length === 1 && (
            <div className="mt-2.5 pt-2 border-t border-cyan-500/15 text-[10px] text-cyan-300/80">
              ◆ TACTICAL: mix tower types — combined arms scores higher.
            </div>
          )}
        </motion.div>
      )}

      {insight?.endless && (
        <OperationContributionPanel insight={insight} score={score} />
      )}

      {insight && (
        <NexusRewardsPanel rewards={insight.endlessRewards ?? null} boostCode={insight.boostCode} />
      )}

      {/* Actions — three flows: solo win (advance), solo loss (retry/browse), endless (run again / op hub) */}
      <div className="flex flex-col gap-2">
        {/* Solo WIN with a next mission unlocked */}
        {won && next && !insight?.endless && (
          <button
            onClick={() => navigate(`/nexus/loadout/${next.id}`)}
            className="relative w-full py-3.5 nx-clip bg-gradient-to-r from-cyan-500 to-indigo-500 text-[hsl(218_45%_5%)] font-black uppercase tracking-wider text-sm active:scale-[0.98] flex items-center justify-center gap-2"
          >
            Deploy Mission {next.id} <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Endless mode primary CTA — always offer "Run Again" prominently */}
        {insight?.endless && (
          <button
            onClick={() => navigate(`/nexus/loadout/100`)}
            className="relative w-full py-3.5 nx-clip bg-gradient-to-r from-emerald-500 to-cyan-500 text-[hsl(218_45%_5%)] font-black uppercase tracking-wider text-sm active:scale-[0.98] flex items-center justify-center gap-2"
          >
            ▶ Run Another Endless <ChevronRight className="w-4 h-4" />
          </button>
        )}

        {/* Solo LOSS — give a clear secondary "browse missions" option */}
        {!won && !insight?.endless && (
          <button
            onClick={() => navigate('/nexus/missions')}
            className="w-full py-3 nx-clip bg-cyan-500/15 border border-cyan-400/50 text-cyan-100 font-bold uppercase tracking-wider text-xs active:scale-[0.98]"
          >
            ◢ Browse Missions
          </button>
        )}

        {/* Retry — always available, but label differs by mode */}
        <button
          onClick={() => navigate(`/nexus/battle/${id}`)}
          className="w-full py-3 nx-clip bg-white/[0.04] border border-white/15 text-foreground/85 font-bold uppercase tracking-wider text-xs active:scale-[0.98]"
        >
          ↻ {insight?.endless ? 'Retry Same Loadout' : 'Retry Mission'}
        </button>

        {/* Always offer a clear closeout to the hub */}
        <button
          onClick={() => navigate('/nexus')}
          className="w-full py-2.5 nx-clip-sm border border-white/10 bg-transparent text-[11px] font-bold uppercase tracking-[0.22em] text-foreground/65 hover:text-cyan-200 hover:border-cyan-400/30 transition-colors active:scale-[0.98]"
        >
          ← Return to Hub
        </button>
      </div>
    </div>
  );
}

function Stat({
  label, value, icon, accent,
}: { label: string; value: string | number; icon?: React.ReactNode; accent: 'cyan' | 'rose' | 'amber' }) {
  const tint = {
    cyan: 'border-cyan-400/30 bg-cyan-500/5',
    rose: 'border-rose-400/30 bg-rose-500/5',
    amber: 'border-amber-400/30 bg-amber-500/5',
  }[accent];
  return (
    <div className={`relative p-2.5 nx-clip border ${tint}`}>
      <div className="text-[9px] uppercase tracking-[0.18em] text-cyan-200/60 flex items-center gap-1 mb-0.5">
        {icon}{label}
      </div>
      <div className="text-lg font-black tabular-nums text-white">{value}</div>
    </div>
  );
}

/* ----------------------- Operation Contribution Panel ----------------------- */

function useCountUp(target: number, durationMs = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return; }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

function fmt(n: number) { return n.toLocaleString(); }

function OperationContributionPanel({ insight, score }: { insight: RunInsight; score: number }) {
  const op = insight.operation;
  const purple = 'hsl(280 90% 78%)';
  const purpleDim = 'hsl(280 60% 18%)';

  // Headline copy for status
  let headline = 'You pushed the Operation forward';
  let headlineColor = purple;
  if (op?.operationComplete) { headline = '◆ Operation Complete — your run sealed it'; headlineColor = 'hsl(150 80% 70%)'; }
  else if (op?.phaseAdvanced) {
    const pn = op.affectedPhase ?? 1;
    headline = pn === 3 ? 'Siege Core damaged · Phase secured' : `Phase ${pn} secured · Phase ${pn + 1} unlocked`;
    headlineColor = 'hsl(150 80% 72%)';
  } else if (op?.duplicate) { headline = 'Already submitted — no duplicate points'; headlineColor = 'hsl(0 0% 70%)'; }
  else if (op?.status === 'none' || !op) { headline = 'No active Operation'; headlineColor = 'hsl(0 0% 70%)'; }
  else if (op?.status === 'error') { headline = 'Could not submit run'; headlineColor = 'hsl(15 85% 70%)'; }
  else if (op?.affectedPhase) { headline = `You ${PHASE_LABELS[op.affectedPhase].verb}`; }

  const showProgress = !!op && !op.duplicate && op.status !== 'none' && op.status !== 'error'
    && typeof op.priorProgress === 'number' && typeof op.newProgress === 'number' && typeof op.priorTarget === 'number'
    && (op.priorTarget ?? 0) > 0;

  const priorPct = showProgress ? Math.min(100, ((op!.priorProgress! / op!.priorTarget!) * 100)) : 0;
  const newPct = showProgress ? Math.min(100, ((op!.newProgress! / op!.priorTarget!) * 100)) : 0;
  const movedPct = Math.max(0, newPct - priorPct);

  const animatedPts = useCountUp(op?.duplicate ? 0 : (op?.pointsAwarded ?? 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="relative nx-clip-sm p-3 mb-4 overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, hsl(280 50% 14%), hsl(280 60% 8%))',
        border: '1px solid hsl(280 80% 65% / 0.45)',
        boxShadow: '0 0 16px -4px hsl(280 80% 60% / 0.4)',
      }}
    >
      {/* sci-fi sweep */}
      {!op?.duplicate && op?.status !== 'error' && op?.status !== 'none' && op && (
        <motion.div
          aria-hidden
          className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(280 90% 75% / 0.18), transparent)' }}
          initial={{ x: 0 }}
          animate={{ x: '420%' }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.35 }}
        />
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Users className="w-3.5 h-3.5 shrink-0" style={{ color: purple }} />
          <span className="nx-title text-[10px] truncate" style={{ color: purple, letterSpacing: '0.22em' }}>
            OPERATION CONTRIBUTION
          </span>
        </div>
        {op && !op.duplicate && (op.pointsAwarded ?? 0) > 0 && (
          <motion.span
            initial={{ scale: 0.8 }}
            animate={op.phaseAdvanced || op.operationComplete
              ? { scale: [0.8, 1.18, 1] }
              : { scale: 1 }}
            transition={{ duration: 0.55 }}
            className="text-sm font-black tabular-nums"
            style={{ color: 'hsl(280 95% 85%)', textShadow: '0 0 8px hsl(280 90% 60% / 0.6)' }}
          >
            +{fmt(animatedPts)} PTS
          </motion.span>
        )}
      </div>

      {/* Headline */}
      <div
        className="text-[12px] font-black mb-2 leading-tight"
        style={{ color: headlineColor }}
      >
        {headline}
      </div>

      {/* Per-run contribution stats */}
      <div className="grid grid-cols-3 gap-2 text-center mb-2">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-foreground/55">Kills</div>
          <div className="text-base font-black tabular-nums text-foreground">{fmt(insight.kills ?? 0)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-foreground/55">Score</div>
          <div className="text-base font-black tabular-nums text-foreground">{fmt(score)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-foreground/55">Boss Dmg</div>
          <div className="text-base font-black tabular-nums text-foreground">{fmt(insight.bossDamage ?? 0)}</div>
        </div>
      </div>

      {/* Phase progress before -> after */}
      {showProgress && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="flex items-center gap-1 text-foreground/70">
              <Target className="w-3 h-3" style={{ color: purple }} />
              <span className="font-bold">
                Phase {op!.affectedPhase} · {PHASE_LABELS[op!.affectedPhase ?? 1].label}
              </span>
            </span>
            <span className="tabular-nums text-foreground/65">
              {fmt(op!.priorProgress!)} → {fmt(op!.newProgress!)}
            </span>
          </div>
          <div className="relative h-2.5 rounded-full overflow-hidden bg-black/45 border border-white/10">
            {/* prior baseline */}
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${priorPct}%`, background: 'hsl(280 40% 35%)' }}
            />
            {/* moved-by-this-run delta */}
            <motion.div
              className="absolute inset-y-0"
              style={{
                left: `${priorPct}%`,
                background: 'linear-gradient(90deg, hsl(280 80% 65%), hsl(195 90% 60%))',
                boxShadow: '0 0 10px hsl(280 90% 65%)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${movedPct}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.25 }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] mt-1">
            <span className="text-foreground/55">
              of {fmt(op!.priorTarget!)} target
            </span>
            <span className="flex items-center gap-1 font-bold" style={{ color: purple }}>
              <TrendingUp className="w-3 h-3" />
              +{movedPct.toFixed(movedPct < 1 ? 2 : 1)}%
            </span>
          </div>
        </div>
      )}

      {/* Edge state messages */}
      {op?.duplicate && (
        <div className="mt-2 text-[10px] text-foreground/60 text-center">
          This run was already counted toward the Operation.
        </div>
      )}
      {(op?.status === 'none' || !op) && insight.endless && (
        <div className="mt-2 text-[10px] text-foreground/60 text-center">
          No Operation is active right now — no points awarded.
        </div>
      )}
      {op?.status === 'error' && (
        <div className="mt-2 text-[10px] text-center" style={{ color: 'hsl(15 85% 70%)' }}>
          ⚠ {op.error ?? 'Submission failed'} — try again from the hub.
        </div>
      )}

      <Link
        to="/nexus/operation"
        className="mt-3 block text-center text-[11px] font-black uppercase tracking-widest py-2 nx-clip-sm"
        style={{ background: purpleDim, color: 'hsl(280 95% 85%)', border: '1px solid hsl(280 80% 60% / 0.5)' }}
      >
        View Operation Hub →
      </Link>
    </motion.div>
  );
}
