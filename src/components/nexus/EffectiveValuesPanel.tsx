import { useState } from 'react';
import { ChevronDown, ChevronRight, AlertTriangle, Info, ShieldAlert, Zap } from 'lucide-react';
import {
  EffectiveMission,
  ScalarBreakdown,
  fmtMult,
  fmtDelta,
} from '@/lib/nexus/effectiveValues';
import { TOWERS } from '@/lib/nexus/towers';
import { ABILITIES } from '@/lib/nexus/abilities';
import { ENEMIES } from '@/lib/nexus/enemies';
import { EnemyKind, TowerKind, AbilityKind } from '@/lib/nexus/types';

const ENEMY_LABELS = Object.fromEntries(
  (Object.keys(ENEMIES) as EnemyKind[]).map((k) => [k, ENEMIES[k]?.name ?? k]),
) as Record<EnemyKind, string>;

export function EffectiveValuesPanel({ eff }: { eff: EffectiveMission }) {
  const [openWaves, setOpenWaves] = useState(false);
  const [openTowers, setOpenTowers] = useState(false);
  const [openEnemies, setOpenEnemies] = useState(false);

  const hasAnyMod = eff.modifiers.length > 0;
  const economyChanged =
    eff.startEnergy.final !== eff.startEnergy.base ||
    eff.baseHp.final !== eff.baseHp.base ||
    eff.rewardCores.final !== eff.rewardCores.base ||
    eff.waveReward.final !== 1 ||
    eff.bountyMult.final !== 1;

  return (
    <section className="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3">
      <header className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Effective live values</div>
          <div className="text-[11px] text-muted-foreground">
            Base × calibration × {hasAnyMod ? `${eff.modifiers.length} modifier${eff.modifiers.length === 1 ? '' : 's'}` : 'no modifiers'}
          </div>
        </div>
      </header>

      {/* Active modifier strip */}
      {hasAnyMod && (
        <div className="flex flex-wrap gap-1 mb-3">
          {eff.modifiers.map(m => (
            <span
              key={m.id}
              className="text-[10px] px-2 py-0.5 rounded-full border border-border/60 bg-card text-foreground/80 inline-flex items-center gap-1"
              title={m.description}
            >
              <span className="opacity-80">{m.glyph}</span>
              <span className="font-semibold">{m.label}</span>
            </span>
          ))}
        </div>
      )}

      {/* Warnings */}
      {eff.warnings.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {eff.warnings.map((w, i) => (
            <WarningChip key={i} w={w} />
          ))}
        </div>
      )}

      {/* Mission economy block */}
      <SubHeading>Mission</SubHeading>
      <div className="space-y-1.5 mb-3">
        <Row label="Start energy" b={eff.startEnergy} suffix="⚡" />
        <Row label="Base HP" b={eff.baseHp} />
        <Row label="Reward cores" b={eff.rewardCores} />
        <Row label="Wave reward" b={eff.waveReward} />
        <Row label="Kill bounty" b={eff.bountyMult} />
      </div>

      {/* Enemies (collapsible) */}
      <Collapsible
        open={openEnemies}
        onToggle={() => setOpenEnemies(o => !o)}
        title="Enemies"
        summary={`HP ${fmtMult(maxHp(eff))} · Spd ${fmtMult(eff.enemySpeed.final)}${eff.mission.isBoss ? ` · Boss ${fmtMult(eff.bossHp.final)}` : ''}`}
      >
        <div className="space-y-1.5">
          <Row label="Speed (all)" b={eff.enemySpeed} />
          {(['drone', 'walker', 'shielded', 'stealth'] as EnemyKind[]).map(k => (
            (eff.enemyHp[k].final !== 1 || eff.enemyShield[k].final !== 1) && (
              <div key={k} className="rounded-md bg-card/60 border border-border/40 px-2 py-1.5">
                <div className="text-[11px] font-semibold mb-1">{ENEMY_LABELS[k]}</div>
                {eff.enemyHp[k].final !== 1 && <Row label="HP" b={eff.enemyHp[k]} compact />}
                {eff.enemyShield[k].final !== 1 && <Row label="Shield" b={eff.enemyShield[k]} compact />}
                {eff.shieldRegen[k] != null && (
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-muted-foreground">Regen</span>
                    <span className="text-amber-300 font-semibold tabular-nums">+{eff.shieldRegen[k]}/s</span>
                  </div>
                )}
              </div>
            )
          ))}
          {eff.mission.isBoss && (
            <div className="rounded-md bg-card/60 border border-border/40 px-2 py-1.5">
              <div className="text-[11px] font-semibold mb-1">Boss</div>
              <Row label="HP" b={eff.bossHp} compact />
              <Row label="Shield" b={eff.bossShield} compact />
            </div>
          )}
          <SubNote>
            Effective HP at spawn = <span className="text-foreground">enemy.hp × calibration × modifier</span>
          </SubNote>
        </div>
      </Collapsible>

      {/* Towers + abilities (collapsible) */}
      <Collapsible
        open={openTowers}
        onToggle={() => setOpenTowers(o => !o)}
        title="Towers & abilities"
        summary={towerAbilitySummary(eff)}
      >
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {(['pulse', 'arc', 'cryo', 'rail'] as TowerKind[]).map(k => (
            <TowerCard key={k} kind={k} eff={eff} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(['orbital', 'emp'] as AbilityKind[]).map(k => (
            <AbilityCard key={k} kind={k} eff={eff} />
          ))}
        </div>
      </Collapsible>

      {/* Resolved waves preview */}
      <Collapsible
        open={openWaves}
        onToggle={() => setOpenWaves(o => !o)}
        title="Resolved waves"
        summary={`${eff.waves.length} wave${eff.waves.length === 1 ? '' : 's'} · ${eff.waves.reduce((a, w) => a + w.totalCount.final, 0)} foes`}
      >
        <div className="space-y-1.5">
          {eff.waves.map(w => (
            <div key={w.index} className="rounded-md bg-card/60 border border-border/40 px-2 py-1.5">
              <div className="flex items-baseline justify-between mb-0.5">
                <div className="text-[11px] font-semibold">Wave {w.index + 1}</div>
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  +{w.rewardEnergy.final}⚡{w.rewardEnergy.final !== w.rewardEnergy.base && (
                    <span className="text-amber-300"> (was {w.rewardEnergy.base})</span>
                  )} · {w.totalCount.final} foes
                  {w.totalCount.final !== w.totalCount.base && (
                    <span className="text-amber-300"> (was {w.totalCount.base})</span>
                  )}
                </div>
              </div>
              <div className="space-y-0.5">
                {w.spawns.map((sp, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                    <span>{ENEMY_LABELS[sp.enemy]} ×{sp.count.final}{sp.count.final !== sp.count.base && (
                      <span className="text-amber-300"> (was {sp.count.base})</span>
                    )}</span>
                    <span>
                      every {sp.intervalMs.final}ms
                      {sp.delayMs.final != null && <> · +{sp.delayMs.final}ms delay</>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <SubNote>
            Enemy HP / shield / speed multipliers apply at spawn time and aren't shown in the per-foe breakdown above.
          </SubNote>
        </div>
      </Collapsible>

      {!hasAnyMod && !economyChanged && (
        <p className="text-[11px] text-muted-foreground mt-2">
          No calibration overrides or modifiers active — players are walking into baseline values.
        </p>
      )}
    </section>
  );
}

/* ---------- subcomponents ---------- */

function SubHeading({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 px-0.5">{children}</div>;
}

function SubNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">{children}</p>;
}

function Row({ label, b, suffix, compact }: { label: string; b: ScalarBreakdown; suffix?: string; compact?: boolean }) {
  const changed = b.mode === 'additive'
    ? b.calibration !== 0 || b.modifier !== 0
    : Math.abs(b.calibration - 1) > 1e-6 || Math.abs(b.modifier - 1) > 1e-6;
  const finalDisplay = b.mode === 'additive'
    ? `${b.final}${suffix ?? ''}`
    : fmtMult(b.final);
  return (
    <div className={`rounded-md ${compact ? '' : 'bg-card/60 border border-border/40'} px-2 py-1`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className={`text-sm font-black tabular-nums ${changed ? 'text-emerald-300' : 'text-foreground/85'}`}>
          {finalDisplay}
        </span>
      </div>
      {changed && (
        <div className="text-[10px] text-muted-foreground tabular-nums leading-tight mt-0.5">
          {b.mode === 'additive' ? (
            <>{b.base}{suffix ?? ''} <Op s="+" /> cal {fmtDelta(b.calibration)} <Op s="+" /> mod {fmtDelta(b.modifier)}</>
          ) : (
            <>{b.base.toFixed(2)} <Op s="×" /> cal {b.calibration.toFixed(2)} <Op s="×" /> mod {b.modifier.toFixed(2)}</>
          )}
        </div>
      )}
    </div>
  );
}

function Op({ s }: { s: string }) {
  return <span className="text-foreground/40">{s}</span>;
}

function TowerCard({ kind, eff }: { kind: TowerKind; eff: EffectiveMission }) {
  const cost = eff.towerCost[kind];
  const dmg = eff.towerDamage[kind];
  const t = TOWERS[kind];
  const costChanged = Math.abs(cost.modifier - 1) > 1e-6;
  const dmgChanged = Math.abs(dmg.modifier - 1) > 1e-6;
  const anyChange = costChanged || dmgChanged;
  return (
    <div className={`rounded-md border px-2 py-1.5 ${anyChange ? 'border-emerald-500/30 bg-emerald-500/[0.05]' : 'border-border/40 bg-card/60'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold">{t.name.split(' ')[0]}</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{t.glyph}</span>
      </div>
      <div className="flex items-baseline justify-between text-[10px]">
        <span className="text-muted-foreground">Cost</span>
        <span className={`tabular-nums font-semibold ${costChanged ? 'text-emerald-300' : ''}`}>
          {Math.round(cost.final)}{costChanged && <span className="text-muted-foreground font-normal"> /{cost.base}</span>}
        </span>
      </div>
      <div className="flex items-baseline justify-between text-[10px]">
        <span className="text-muted-foreground">Dmg</span>
        <span className={`tabular-nums font-semibold ${dmgChanged ? 'text-emerald-300' : ''}`}>
          {Math.round(dmg.final)}{dmgChanged && <span className="text-muted-foreground font-normal"> /{dmg.base}</span>}
        </span>
      </div>
    </div>
  );
}

function AbilityCard({ kind, eff }: { kind: AbilityKind; eff: EffectiveMission }) {
  const cd = eff.abilityCooldown[kind];
  const ms = eff.abilityCooldownMs[kind];
  const a = ABILITIES[kind];
  const changed = Math.abs(cd.modifier - 1) > 1e-6;
  return (
    <div className={`rounded-md border px-2 py-1.5 ${changed ? 'border-emerald-500/30 bg-emerald-500/[0.05]' : 'border-border/40 bg-card/60'}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-bold">{a.name.split(' ')[0]}</span>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{a.glyph}</span>
      </div>
      <div className="flex items-baseline justify-between text-[10px]">
        <span className="text-muted-foreground">Cooldown</span>
        <span className={`tabular-nums font-semibold ${changed ? 'text-emerald-300' : ''}`}>
          {(ms.finalMs / 1000).toFixed(1)}s
          {changed && <span className="text-muted-foreground font-normal"> /{(ms.baseMs / 1000).toFixed(0)}s</span>}
        </span>
      </div>
      {changed && (
        <div className="text-[9px] text-muted-foreground text-right">{fmtMult(cd.final)}</div>
      )}
    </div>
  );
}

function Collapsible({
  open, onToggle, title, summary, children,
}: { open: boolean; onToggle: () => void; title: string; summary: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 rounded-md border border-border/40 bg-card/40">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2.5 py-2 text-left active:bg-muted/40 rounded-md"
      >
        <div className="flex items-center gap-1.5">
          {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <span className="text-[11px] font-bold uppercase tracking-widest">{title}</span>
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{summary}</span>
      </button>
      {open && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}

function WarningChip({ w }: { w: { level: 'info' | 'warn' | 'danger'; label: string; detail: string } }) {
  const tone =
    w.level === 'danger' ? { fg: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/40', Icon: ShieldAlert } :
    w.level === 'warn' ? { fg: 'text-amber-200', bg: 'bg-amber-500/10', border: 'border-amber-500/40', Icon: AlertTriangle } :
    { fg: 'text-sky-200', bg: 'bg-sky-500/10', border: 'border-sky-500/30', Icon: Info };
  const Icon = tone.Icon;
  return (
    <div className={`flex items-start gap-2 rounded-md border ${tone.border} ${tone.bg} px-2 py-1.5`}>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${tone.fg}`} />
      <div className="min-w-0">
        <div className={`text-[11px] font-bold ${tone.fg}`}>{w.label}</div>
        <div className="text-[10px] text-muted-foreground leading-snug">{w.detail}</div>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */

function maxHp(eff: EffectiveMission): number {
  return Math.max(
    eff.enemyHp.drone.final,
    eff.enemyHp.walker.final,
    eff.enemyHp.shielded.final,
    eff.enemyHp.stealth.final,
  );
}

function towerAbilitySummary(eff: EffectiveMission): string {
  const parts: string[] = [];
  for (const k of ['pulse', 'arc', 'cryo', 'rail'] as TowerKind[]) {
    const dmg = eff.towerDamage[k].modifier;
    const cost = eff.towerCost[k].modifier;
    if (Math.abs(dmg - 1) > 1e-6) parts.push(`${k[0].toUpperCase()} dmg ${fmtMult(dmg)}`);
    if (Math.abs(cost - 1) > 1e-6) parts.push(`${k[0].toUpperCase()} cost ${fmtMult(cost)}`);
  }
  for (const k of ['orbital', 'emp'] as AbilityKind[]) {
    const cd = eff.abilityCooldown[k].modifier;
    if (Math.abs(cd - 1) > 1e-6) parts.push(`${k === 'orbital' ? 'Orb' : 'EMP'} CD ${fmtMult(cd)}`);
  }
  return parts.length ? parts.slice(0, 3).join(' · ') : 'No tower/ability changes';
}

// Re-export so consumers don't need to import enemies/abilities for typing
export { ENEMIES };
