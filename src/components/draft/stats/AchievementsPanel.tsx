import { useMemo, useState } from 'react';
import { Medal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Achievement, AchievementTier } from '@/lib/draft/statsAggregators';

const TIER_STYLE: Record<AchievementTier, { color: string; soft: string; label: string }> = {
  mythic: { color: 'hsl(280 70% 65%)', soft: 'hsl(280 70% 65% / 0.16)', label: 'Mythic' },
  gold: { color: 'hsl(var(--gold))', soft: 'hsl(var(--gold) / 0.16)', label: 'Gold' },
  silver: { color: 'hsl(210 12% 72%)', soft: 'hsl(210 12% 72% / 0.16)', label: 'Silver' },
  bronze: { color: 'hsl(28 45% 58%)', soft: 'hsl(28 45% 58% / 0.16)', label: 'Bronze' },
};

function Row({ a }: { a: Achievement }) {
  const tier = TIER_STYLE[a.tier];
  const pct = Math.max(0, Math.min(100, (a.progress / a.target) * 100));
  return (
    <div
      className={cn('rounded-xl p-2.5 border transition-colors', a.unlocked ? 'bg-background/40' : 'bg-background/20')}
      style={{ borderColor: a.unlocked ? tier.soft.replace('0.16', '0.45') : 'hsl(var(--border) / 0.3)' }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn('text-lg leading-none mt-0.5 shrink-0', !a.unlocked && 'opacity-35 grayscale')}
          aria-hidden
        >
          {a.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p
              className="text-[11.5px] font-extrabold leading-tight"
              style={{ color: a.unlocked ? tier.color : 'hsl(var(--foreground) / 0.75)' }}
            >
              {a.title}
            </p>
            <span
              className="text-[8px] font-bold uppercase tracking-wider px-1 py-px rounded"
              style={{ background: tier.soft, color: tier.color }}
            >
              {tier.label}
            </span>
            {a.unlocked && <span className="text-[8px] font-bold uppercase tracking-wider text-emerald-400">Unlocked</span>}
          </div>
          <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5 break-words">{a.description}</p>
          {a.detail && <p className="text-[9.5px] text-muted-foreground/55 mt-0.5 break-words">{a.detail}</p>}
          {!a.unlocked && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 rounded-full bg-muted/40 overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tier.color }} />
              </div>
              <span className="text-[9px] font-bold tabular-nums text-muted-foreground/70">
                {Math.round(a.progress)}/{a.target}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AchievementsPanel({ achievements }: { achievements: Achievement[] }) {
  const [expanded, setExpanded] = useState(false);
  const unlocked = useMemo(() => achievements.filter(a => a.unlocked).length, [achievements]);
  if (achievements.length === 0) return null;

  const visible = expanded ? achievements : achievements.slice(0, 6);

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 mt-1 px-0.5">
        <Medal className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/80">Achievements</span>
        <span className="ml-auto text-[10px] font-bold tabular-nums text-muted-foreground/70">
          {unlocked}/{achievements.length}
        </span>
      </div>
      <div className="da-glass p-3 space-y-1.5">
        {visible.map(a => <Row key={a.key} a={a} />)}
        {achievements.length > 6 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full h-8 rounded-lg bg-muted/30 text-[10.5px] font-bold text-foreground/70 hover:bg-muted/50 btn-press flex items-center justify-center gap-1"
          >
            {expanded ? 'Show less' : `Show all ${achievements.length}`}
            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>
    </div>
  );
}
