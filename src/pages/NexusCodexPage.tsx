import { TOWER_LIST } from '@/lib/nexus/towers';
import { ENEMY_LIST } from '@/lib/nexus/enemies';
import { ABILITY_LIST } from '@/lib/nexus/abilities';
import { TowerIcon } from '@/components/nexus/TowerIcon';
import { Crosshair, Skull, Zap } from 'lucide-react';
import type { TowerKind } from '@/lib/nexus/types';

export default function NexusCodexPage() {
  return (
    <div className="max-w-md mx-auto pb-6 px-3 pt-2">
      {/* Header */}
      <div className="mb-4 relative nx-panel nx-clip p-3">
        <span className="nx-bracket nx-bracket-tl" />
        <span className="nx-bracket nx-bracket-br" />
        <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300/70 font-bold">
          ▌ Field Manual
        </div>
        <h1 className="text-2xl font-black mt-0.5 tracking-tight">Codex</h1>
        <p className="text-[11px] text-cyan-100/60 mt-0.5">Towers, hostiles, and tactical abilities.</p>
      </div>

      <Section title="Defense Systems" icon={<Crosshair className="w-3 h-3" />} accent="cyan">
        {TOWER_LIST.map(t => (
          <TowerCard key={t.kind} kind={t.kind} title={t.name} desc={t.tagline}
                stats={[`⚡ ${t.cost}`, `DMG ${t.damage}`, `RNG ${t.range}`, `${t.fireRate}/s`]} />
        ))}
      </Section>

      <Section title="Hostiles" icon={<Skull className="w-3 h-3" />} accent="rose">
        {ENEMY_LIST.map(e => (
          <Card key={e.kind} glyph={e.glyph} title={e.name}
                desc={e.kind === 'drone' ? 'Fast and fragile. Comes in waves.' :
                      e.kind === 'walker' ? 'Heavy armor, slow speed. Bring armor-pierce.' :
                      e.kind === 'shielded' ? 'Energy shield absorbs first damage. Burst it or EMP it.' :
                      e.kind === 'stealth' ? 'Only Rail Battery can target it.' :
                      e.kind === 'runner' ? 'Extremely fast, low HP. Slow fields + splash catch it.' :
                      e.kind === 'brute' ? 'Enormous HP wall. Sustained fire + snipers.' :
                      e.kind === 'flyer' ? 'Airborne — only Flak and Rail can hit it.' :
                      e.kind === 'healer' ? 'Heals nearby enemies. Kill it first.' :
                      e.kind === 'splitter' ? 'Bursts into fast runners on death.' :
                      'Boss. Massive HP and shield. Bring everything.'}
                accent="rose"
                stats={[`HP ${e.hp}`, `SPD ${e.speed}`, e.armor ? `ARM ${e.armor}` : '', e.shield ? `SHD ${e.shield}` : ''].filter(Boolean) as string[]} />
        ))}
      </Section>

      <Section title="Tactical Abilities" icon={<Zap className="w-3 h-3" />} accent="amber">
        {ABILITY_LIST.map(a => (
          <Card key={a.kind} glyph={a.glyph} title={a.name} desc={a.tagline} accent="amber"
                stats={[`CD ${a.cooldownMs/1000}s`]} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, icon, accent, children }: {
  title: string; icon: React.ReactNode; accent: 'cyan' | 'rose' | 'amber'; children: React.ReactNode;
}) {
  const tint = { cyan: 'text-cyan-300', rose: 'text-rose-300', amber: 'text-amber-300' }[accent];
  return (
    <section className="mb-5">
      <h2 className={`text-[10px] font-bold uppercase tracking-[0.25em] mb-2 flex items-center gap-1.5 ${tint}`}>
        {icon} {title}
      </h2>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}

function TowerCard({ kind, title, desc, stats }: { kind: TowerKind; title: string; desc: string; stats: string[] }) {
  return (
    <div className="relative p-2.5 nx-clip border border-cyan-400/25 bg-cyan-500/[0.04]">
      <div className="flex items-start gap-2.5">
        <div className="w-11 h-11 nx-clip border border-cyan-400/40 bg-cyan-500/10 flex items-center justify-center shrink-0">
          <TowerIcon kind={kind} className="w-7 h-7 text-cyan-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">{title}</div>
          <div className="text-[11px] text-cyan-100/65 leading-snug">{desc}</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {stats.map(s => (
              <span key={s} className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-cyan-500/10 border border-cyan-400/20 text-cyan-200">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ glyph, title, desc, stats, accent }: { glyph: string; title: string; desc: string; stats: string[]; accent: 'rose' | 'amber' }) {
  const colors = {
    rose: { border: 'border-rose-400/25 bg-rose-500/[0.04]', glyph: 'border-rose-400/40 bg-rose-500/10 text-rose-200', chip: 'bg-rose-500/10 border-rose-400/20 text-rose-200' },
    amber: { border: 'border-amber-400/25 bg-amber-500/[0.04]', glyph: 'border-amber-400/40 bg-amber-500/10 text-amber-200', chip: 'bg-amber-500/10 border-amber-400/20 text-amber-200' },
  }[accent];
  return (
    <div className={`relative p-2.5 nx-clip border ${colors.border}`}>
      <div className="flex items-start gap-2.5">
        <div className={`w-11 h-11 nx-clip border flex items-center justify-center font-black text-base shrink-0 ${colors.glyph}`}>
          {glyph}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">{title}</div>
          <div className="text-[11px] text-cyan-100/65 leading-snug">{desc}</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {stats.map(s => (
              <span key={s} className={`text-[9px] font-mono px-1.5 py-0.5 rounded-sm border ${colors.chip}`}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
