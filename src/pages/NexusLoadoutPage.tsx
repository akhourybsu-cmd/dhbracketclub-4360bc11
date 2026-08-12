import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Infinity as InfinityIcon } from 'lucide-react';
import { useResolvedMission } from '@/hooks/useMissionCalibrations';
import { TOWER_LIST } from '@/lib/nexus/towers';
import { ABILITY_LIST } from '@/lib/nexus/abilities';
import { TowerIcon } from '@/components/nexus/TowerIcon';
import { TowerKind } from '@/lib/nexus/types';
import { resolveModifiers, modifierTone } from '@/lib/nexus/modifiers';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';
import { useActiveOperation } from '@/hooks/useNexusOperation';
import { NexusBoostPicker } from '@/components/nexus/NexusBoostPicker';
import { MissionBriefingCard } from '@/components/nexus/MissionBriefingCard';
import { EndlessMapSelector, useEndlessLayout } from '@/components/nexus/EndlessMapSelector';
import { getBriefing } from '@/lib/nexus/missionBriefings';
import { getLayout } from '@/lib/nexus/mapLayouts';

const TOWER_HSL: Record<TowerKind, { c: string; bg: string; text: string }> = {
  pulse: { c: 'hsl(188 92% 56%)', bg: 'hsl(188 92% 56% / 0.12)', text: 'hsl(188 92% 78%)' },
  arc:   { c: 'hsl(265 80% 70%)', bg: 'hsl(265 80% 70% / 0.12)', text: 'hsl(265 80% 84%)' },
  cryo:  { c: 'hsl(200 95% 70%)', bg: 'hsl(200 95% 70% / 0.12)', text: 'hsl(200 95% 84%)' },
  rail:  { c: 'hsl(38 95% 60%)',  bg: 'hsl(38 95% 60% / 0.12)',  text: 'hsl(38 95% 78%)' },
  flak:  { c: 'hsl(150 80% 55%)', bg: 'hsl(150 80% 55% / 0.12)', text: 'hsl(150 80% 78%)' },
  mortar:{ c: 'hsl(350 85% 62%)', bg: 'hsl(350 85% 62% / 0.12)', text: 'hsl(350 85% 80%)' },
  amp:   { c: 'hsl(300 85% 68%)', bg: 'hsl(300 85% 68% / 0.12)', text: 'hsl(300 85% 84%)' },
};

export default function NexusLoadoutPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const navigate = useNavigate();
  const id = parseInt(missionId || '1', 10);
  const { mission, loading } = useResolvedMission(id);
  const isEndless = id === ENDLESS_MISSION_ID;
  const { operation } = useActiveOperation();
  // Endless layout selection — read once at the top so the hook order stays
  // stable across loading → loaded → error transitions.
  const [endlessLayoutId] = useEndlessLayout();
  // Endless runs auto-contribute to whichever op is active when the run finishes
  // (server-side resolution). Banner just reflects current state.
  const contributingToOp = isEndless && operation?.status === 'active';

  if (loading) return <div className="p-6 text-center text-muted-foreground">Loading mission…</div>;
  if (!mission) return <div className="p-6">Mission not found.</div>;

  const baseBriefing = getBriefing(mission.id);
  // For endless runs, override the briefing's layout with the player's saved
  // map-selector choice so the briefing card and result page agree.
  const briefing = baseBriefing && isEndless
    ? { ...baseBriefing, layoutId: endlessLayoutId, tagline: getLayout(endlessLayoutId)?.tagline ?? baseBriefing.tagline }
    : baseBriefing;

  return (
    <div className="max-w-md mx-auto pb-6 px-1">
      {briefing && (
        <div className="mt-1 mb-3">
          <MissionBriefingCard
            briefing={briefing}
            missionNumber={mission.id === ENDLESS_MISSION_ID ? undefined : mission.id}
            title={mission.name}
          />
        </div>
      )}

      {/* Endless players get a map-selector card right under the briefing */}
      {isEndless && <EndlessMapSelector />}
      <div className="mb-4 mt-1">
        {!briefing && (
          <>
            <div className="nx-title text-[9px]" style={{ color: 'hsl(var(--nx-cyan))' }}>MISSION {String(mission.id).padStart(2, '0')}</div>
            <h1 className="text-2xl font-black tracking-tight">{mission.name}</h1>
          </>
        )}

        {isEndless && (
          contributingToOp && operation ? (
            <div
              className="mt-2.5 p-2.5 nx-clip-sm flex items-start gap-2.5"
              style={{
                background: 'linear-gradient(180deg, hsl(280 50% 14%), hsl(280 60% 8%))',
                border: '1px solid hsl(280 80% 65% / 0.5)',
                boxShadow: '0 0 12px -6px hsl(280 80% 60% / 0.5)',
              }}
            >
              <div
                className="shrink-0 w-8 h-8 nx-clip-sm flex items-center justify-center"
                style={{ background: 'hsl(280 80% 65% / 0.2)', border: '1px solid hsl(280 80% 65%)', color: 'hsl(280 90% 80%)' }}
              >
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="nx-title text-[9px]" style={{ color: 'hsl(280 90% 78%)', letterSpacing: '0.2em' }}>
                  CONTRIBUTING TO CO-OP OP
                </div>
                <div className="text-[12px] font-black truncate text-foreground">{operation.name}</div>
                <div className="text-[10px] text-foreground/70 mt-0.5">
                  Phase {operation.current_phase} · this run's score, kills & boss damage push club progress.
                </div>
              </div>
            </div>
          ) : (
            <div
              className="mt-2.5 p-2.5 nx-clip-sm flex items-start gap-2.5"
              style={{
                background: 'linear-gradient(180deg, hsl(38 30% 10%), hsl(38 40% 6%))',
                border: '1px dashed hsl(var(--nx-amber) / 0.4)',
              }}
            >
              <div
                className="shrink-0 w-8 h-8 nx-clip-sm flex items-center justify-center"
                style={{ background: 'hsl(var(--nx-amber) / 0.18)', border: '1px solid hsl(var(--nx-amber))', color: 'hsl(var(--nx-amber))' }}
              >
                <InfinityIcon className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="nx-title text-[9px]" style={{ color: 'hsl(var(--nx-amber))', letterSpacing: '0.2em' }}>
                  SOLO ENDLESS RUN
                </div>
                <div className="text-[11px] text-foreground/80 mt-0.5">
                  No active club operation. Standalone score only.
                </div>
              </div>
            </div>
          )
        )}
        {(() => {
          const mods = resolveModifiers(mission.modifierIds);
          if (mods.length === 0 && !mission.modifier) return null;
          return (
            <div className="mt-2.5 space-y-1.5">
              <div className="nx-title text-[9px]" style={{ color: 'hsl(var(--nx-amber))', letterSpacing: '0.2em' }}>
                ▲ TACTICAL INTEL · {mods.length} MODIFIER{mods.length === 1 ? '' : 'S'}
              </div>
              {mods.length > 0 ? (
                mods.map(mod => {
                  const t = modifierTone(mod.tone);
                  return (
                    <div
                      key={mod.id}
                      className="p-2.5 nx-clip-sm flex items-start gap-2.5"
                      style={{
                        background: `linear-gradient(180deg, ${t.bg}, hsl(218 50% 6% / 0.85))`,
                        border: `1px solid ${t.border}`,
                      }}
                    >
                      <div
                        className="shrink-0 w-8 h-8 nx-clip-sm flex items-center justify-center text-base font-black"
                        style={{ background: t.bg, border: `1px solid ${t.border}`, color: t.fg }}
                      >
                        {mod.glyph}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-[11px] font-black tracking-wide" style={{ color: t.fg }}>
                            {mod.label.toUpperCase()}
                          </span>
                          <span
                            className="nx-title text-[8px] px-1 py-px"
                            style={{ color: 'hsl(0 0% 100% / 0.55)', border: '1px solid hsl(0 0% 100% / 0.18)', letterSpacing: '0.18em' }}
                          >
                            {mod.category.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'hsl(0 0% 100% / 0.85)' }}>
                          {mod.description}
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                mission.modifier && (
                  <div
                    className="p-2.5 nx-clip-sm"
                    style={{
                      background: 'linear-gradient(180deg, hsl(var(--nx-amber) / 0.15), hsl(var(--nx-amber) / 0.05))',
                      border: '1px solid hsl(var(--nx-amber) / 0.45)',
                    }}
                  >
                    <div className="nx-title text-[9px]" style={{ color: 'hsl(var(--nx-amber))' }}>{mission.modifier.label}</div>
                    <div className="text-xs text-amber-100/85 mt-0.5">{mission.modifier.description}</div>
                  </div>
                )
              )}
            </div>
          );
        })()}
      </div>

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
        <h2 className="nx-title text-[9px] mb-2" style={{ color: 'hsl(0 0% 100% / 0.55)' }}>◢ TOWER LOADOUT · ALL UNLOCKED</h2>
        <div className="grid grid-cols-2 gap-2">
          {TOWER_LIST.map(t => {
            const c = TOWER_HSL[t.kind];
            return (
              <div
                key={t.kind}
                className="p-2.5 nx-clip-sm relative"
                style={{
                  background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
                  border: `1px solid ${c.c}`,
                  boxShadow: `inset 0 1px 0 hsl(0 0% 100% / 0.05), 0 0 12px -6px ${c.c}`,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                    style={{ background: c.bg, border: `1.5px solid ${c.c}`, color: c.c }}
                  >
                    <TowerIcon kind={t.kind} size={20} />
                  </div>
                  <div className="text-xs font-black" style={{ color: c.text }}>{t.name}</div>
                </div>
                <div className="text-[10px] text-foreground/70 leading-snug">{t.tagline}</div>
                <div className="nx-title text-[9px] mt-1.5" style={{ color: 'hsl(var(--nx-amber))' }}>⚡{t.cost}</div>
              </div>
            );
          })}
        </div>
      </motion.section>

      <motion.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }} className="mb-4">
        <h2 className="nx-title text-[9px] mb-2" style={{ color: 'hsl(0 0% 100% / 0.55)' }}>◢ COMMANDER ABILITIES</h2>
        <div className="grid grid-cols-2 gap-2">
          {ABILITY_LIST.map(a => (
            <div
              key={a.kind}
              className="p-2.5 nx-clip-sm"
              style={{
                background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
                border: '1px solid hsl(var(--nx-amber) / 0.55)',
                boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.05), 0 0 10px -6px hsl(var(--nx-amber))',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center font-black text-sm"
                  style={{ background: 'hsl(var(--nx-amber) / 0.18)', border: '1.5px solid hsl(var(--nx-amber))', color: 'hsl(var(--nx-amber))' }}
                >
                  {a.glyph}
                </div>
                <div className="text-xs font-black" style={{ color: 'hsl(var(--nx-amber))' }}>{a.name}</div>
              </div>
              <div className="text-[10px] text-foreground/70 leading-snug">{a.tagline}</div>
              <div className="nx-title text-[9px] mt-1.5" style={{ color: 'hsl(var(--nx-cyan))' }}>CD {a.cooldownMs / 1000}s</div>
            </div>
          ))}
        </div>
      </motion.section>

      <NexusBoostPicker />

      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        <Stat label="Start ⚡" value={mission.startEnergy} />
        <Stat label="Base HP" value={mission.baseHp} />
        <Stat label="Waves" value={mission.waves.length} />
      </div>

      <button
        onClick={() => navigate(`/nexus/battle/${mission.id}`)}
        className="w-full py-3.5 nx-clip-sm font-black text-sm active:scale-95 nx-title relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, hsl(150 80% 55%), hsl(150 80% 42%))',
          color: 'hsl(150 30% 8%)',
          boxShadow: '0 0 18px hsl(150 80% 55% / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.35)',
        }}
      >
        ▶  DEPLOY
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="p-2.5 nx-clip-sm"
      style={{
        background: 'hsl(218 35% 7%)',
        border: '1px solid hsl(var(--nx-cyan) / 0.18)',
      }}
    >
      <div className="nx-title text-[9px]" style={{ color: 'hsl(0 0% 100% / 0.55)' }}>{label}</div>
      <div className="text-base font-black tabular-nums" style={{ color: 'hsl(var(--nx-cyan))' }}>{value}</div>
    </div>
  );
}

