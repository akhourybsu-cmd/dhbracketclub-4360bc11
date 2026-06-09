// DH Club Home — "Right Now" priority card
//
// The single dominant action card on the Home screen. Shows the
// highest-priority action from the next-action ranker. If multiple actions
// are pending, a small "▼ N more" pill lets the user expand a compact list
// of the rest. Accent and tag come from the action itself; the card adapts
// its color treatment so the highest priority feels appropriately urgent.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { NextAction } from '@/lib/home/nextAction';

const ACCENT_HSL: Record<NextAction['accent'], string> = {
  gold:        'var(--gold)',
  primary:     'var(--primary)',
  destructive: 'var(--destructive)',
  success:     'var(--success)',
  lore:        'var(--lore, 270 70% 65%)',
  accent:      'var(--accent-foreground, 195 80% 65%)',
  warning:     'var(--warning, 38 95% 60%)',
};

interface Props {
  actions: NextAction[];
}

export function RightNowCard({ actions }: Props) {
  const [expanded, setExpanded] = useState(false);
  if (actions.length === 0) return null;

  const top = actions[0];
  const rest = actions.slice(1, 5);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-4"
    >
      <PriorityCard action={top} primary />
      {rest.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            // Mobile: h-9 (36px) for a comfortable thumb target.
            // Desktop: original h-7 (28px) so the "X more" affordance
            // stays compact under the list.
            className="mt-1.5 w-full inline-flex items-center justify-center gap-1.5 h-9 lg:h-7 px-3 rounded-lg text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground transition-colors"
            aria-expanded={expanded}
          >
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            {rest.length} more
          </button>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden mt-1 space-y-1"
              >
                {rest.map(a => (
                  <PriorityCard key={a.id} action={a} primary={false} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  );
}

function PriorityCard({ action, primary }: { action: NextAction; primary: boolean }) {
  const accent = `hsl(${ACCENT_HSL[action.accent]})`;
  const accentSoft = `hsl(${ACCENT_HSL[action.accent]} / 0.14)`;
  const accentBorder = `hsl(${ACCENT_HSL[action.accent]} / 0.32)`;
  const Icon = action.icon;

  if (primary) {
    return (
      <Link
        to={action.to}
        className="block group active:scale-[0.99] transition-transform"
        aria-label={action.label}
      >
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: `radial-gradient(ellipse 80% 100% at 100% 0%, ${accentSoft}, transparent 70%), linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))`,
            border: `1px solid ${accentBorder}`,
            boxShadow: `0 0 22px -8px ${accent.replace(')', ' / 0.45)')}`,
          }}
        >
          {/* Pulsing accent rail on the left */}
          <span
            aria-hidden
            className="absolute left-0 top-0 bottom-0 w-[3px]"
            style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
          />
          <div className="relative p-3.5 flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${accentSoft}, ${accent.replace(')', ' / 0.04)')})`,
                border: `1px solid ${accentBorder}`,
                color: accent,
              }}
            >
              <Icon className="w-5 h-5" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              {action.tag && (
                <p
                  className="text-[8.5px] font-extrabold uppercase tracking-[0.22em] mb-0.5 truncate"
                  style={{ color: accent }}
                >
                  ◆ {action.tag}
                </p>
              )}
              <h3 className="text-[15px] font-extrabold tracking-tight leading-tight truncate">{action.label}</h3>
              {action.sub && (
                <p className="text-[11px] text-muted-foreground/85 leading-snug truncate mt-0.5">{action.sub}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: accent }} strokeWidth={2.5} />
          </div>
        </div>
      </Link>
    );
  }

  // Secondary item — denser row inside the expander
  return (
    <Link
      to={action.to}
      className="block active:scale-[0.99] transition-transform"
      aria-label={action.label}
    >
      <div
        className="relative rounded-xl flex items-center gap-2.5 p-2.5"
        style={{
          background: 'hsl(var(--card) / 0.6)',
          border: `1px solid ${accentBorder}`,
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: accentSoft, color: accent }}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold leading-tight truncate">{action.label}</p>
          {action.sub && <p className="text-[10px] text-muted-foreground/70 truncate">{action.sub}</p>}
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
      </div>
    </Link>
  );
}
