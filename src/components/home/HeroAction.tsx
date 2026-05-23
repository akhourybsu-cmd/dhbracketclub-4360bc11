// DH Club Home — Hero Action
//
// The single cinematic primary card on the Home screen. Consumes the top
// result from `rankNextActions` and presents it as the most important
// thing on the page — a gradient-washed slab with a clear tag, headline,
// supporting line, and one CTA. This is the ONLY surface on Home that
// earns the soft outer glow; everything else stays calm.
//
// If there is no next action, we render an inviting "club is quiet"
// hero so the page never collapses to nothing under the header.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, Sparkles } from 'lucide-react';
import type { NextAction } from '@/lib/home/nextAction';
import { Surface } from './primitives/Surface';

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
  action: NextAction | null;
  /** Fallback club accent if no action. */
  clubAccent: string;
  /** Friendly first-name greeting for the empty hero. */
  firstName?: string;
}

export function HeroAction({ action, clubAccent, firstName }: Props) {
  if (!action) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="mb-5"
      >
        <Surface variant="hero" accent={clubAccent}>
          <div className="relative px-4 py-4 flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 relative"
              style={{
                background: `radial-gradient(circle at 30% 30%, hsl(${clubAccent} / 0.32), hsl(${clubAccent} / 0.06))`,
                boxShadow: `inset 0 0 0 1px hsl(${clubAccent} / 0.28)`,
              }}
            >
              <Sparkles className="w-5 h-5" style={{ color: `hsl(${clubAccent})` }} strokeWidth={2.2} />
              <span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full motion-safe:animate-[heroPulse_2.4s_ease-in-out_infinite]"
                style={{ background: `hsl(${clubAccent})`, boxShadow: `0 0 8px hsl(${clubAccent} / 0.7)` }}
              />
              <style>{`@keyframes heroPulse { 0%,100% { opacity: 0.85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.25); } }`}</style>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.16em]" style={{ color: `hsl(${clubAccent})` }}>
                All caught up{firstName ? `, ${firstName}` : ''}
              </p>
              <h2 className="text-[16px] font-extrabold tracking-tight leading-tight mt-0.5">
                Nothing waiting on you
              </h2>
              <p className="text-[11.5px] text-muted-foreground/85 leading-snug mt-0.5">
                Browse the club below, or open an app to start something.
              </p>
            </div>
          </div>
        </Surface>
      </motion.div>
    );
  }

  const accent = `hsl(${ACCENT_HSL[action.accent]})`;
  const Icon = action.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="mb-5"
    >
      <Link to={action.to} className="block active:scale-[0.99] transition-transform" aria-label={action.label}>
        <Surface variant="hero" accent={ACCENT_HSL[action.accent].replace('var(--', '').replace(')', '') === 'gold'
          ? '45 95% 55%'
          : ACCENT_HSL[action.accent].includes('var')
            ? clubAccent
            : ACCENT_HSL[action.accent]}>
          {/* Ambient drift — slow, respects prefers-reduced-motion */}
          <span
            aria-hidden
            className="absolute -top-12 -right-12 w-48 h-48 rounded-full pointer-events-none motion-safe:animate-[heroDrift_10s_ease-in-out_infinite] opacity-70"
            style={{ background: `radial-gradient(circle, ${accent.replace(')', ' / 0.18)')}, transparent 70%)` }}
          />
          <style>{`@keyframes heroDrift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-10px,8px); } }`}</style>

          <div className="relative p-5 flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${accent.replace(')', ' / 0.22)')}, ${accent.replace(')', ' / 0.04)')})`,
                color: accent,
                boxShadow: `inset 0 0 0 1px ${accent.replace(')', ' / 0.28)')}`,
              }}
            >
              <Icon className="w-6 h-6" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1">
              {action.tag && (
                <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] mb-1" style={{ color: accent }}>
                  {action.tag}
                </p>
              )}
              <h2 className="text-[18px] font-extrabold tracking-tight leading-tight">
                {action.label}
              </h2>
              {action.sub && (
                <p className="text-[12.5px] text-muted-foreground/80 leading-snug mt-0.5 line-clamp-2">
                  {action.sub}
                </p>
              )}
            </div>
            <ChevronRight className="w-5 h-5 flex-shrink-0" style={{ color: accent }} strokeWidth={2.5} />
          </div>
        </Surface>
      </Link>
    </motion.div>
  );
}
