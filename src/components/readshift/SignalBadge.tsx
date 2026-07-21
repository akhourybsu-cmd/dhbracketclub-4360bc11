// READSHIFT — Signal badge. Distinguished by ICON + LABEL (+ color), never
// color alone (accessibility). Optionally shows the objective explanation.
import { Fingerprint, Waves, VenetianMask } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Signal } from '@/lib/readshift/types';

const META: Record<Signal, { label: string; icon: LucideIcon; hsl: string; explain: string }> = {
  TELL: { label: 'TELL', icon: Fingerprint, hsl: '152 68% 52%', explain: 'Answer honestly and recognizably. You score when others correctly identify you as the author.' },
  BLUR: { label: 'BLUR', icon: Waves, hsl: '200 82% 58%', explain: 'Write something believable that could belong to several people. You score when readers misattribute you or spread their guesses.' },
  FRAME: { label: 'FRAME', icon: VenetianMask, hsl: '315 82% 66%', explain: 'Answer so it sounds like your secret target. You score when others attribute your answer to them.' },
};

export function SignalBadge({ signal, size = 'md' }: { signal: Signal; size?: 'sm' | 'md' }) {
  const m = META[signal];
  const Icon = m.icon;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full font-extrabold uppercase tracking-wider',
        size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-[12px] px-3 py-1')}
      style={{ background: `hsl(${m.hsl} / 0.16)`, color: `hsl(${m.hsl})`, border: `1px solid hsl(${m.hsl} / 0.4)` }}
    >
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} aria-hidden />
      {m.label}
    </span>
  );
}

export function SignalExplainer({ signal }: { signal: Signal }) {
  const m = META[signal];
  return (
    <div className="rounded-xl p-3.5" style={{ background: `hsl(${m.hsl} / 0.08)`, border: `1px solid hsl(${m.hsl} / 0.22)` }}>
      <div className="flex items-center gap-2 mb-1.5">
        <SignalBadge signal={signal} />
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: `hsl(${m.hsl})` }}>Your Signal</span>
      </div>
      <p className="text-[12.5px] text-foreground/85 leading-snug">{m.explain}</p>
    </div>
  );
}

export function signalHsl(signal: Signal) { return META[signal].hsl; }
