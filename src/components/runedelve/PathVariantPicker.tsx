// Rune Delve — Path Variant Picker (R2)
//
// Shown when the player taps a milestone level on the map. Presents
// three path options (Standard / Treasure / Elite) and a Close
// affordance. Once picked, navigates into the chamber with a
// pathVariant query param so the play page applies the variant's
// effects (enemy HP scaling, locked modifier, layout override,
// shard/drop bonuses).
//
// This is intentionally not a forced choice — the player can dismiss
// the modal and re-enter to pick a different path on subsequent runs.

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PATH_VARIANTS, type PathVariant } from '@/lib/runedelve/pathVariants';

const TIER_LABEL: Record<PathVariant['tier'], string> = {
  safe: 'Safe',
  flavored: 'Flavored',
  risky: 'Risky',
};

interface Props {
  levelNumber: number;
  /** Optional id of the last-picked variant — highlighted with a small
   *  "Last pick" pip so the player can re-pick by reflex. */
  lastPicked?: string | null;
  onPick: (variant: PathVariant) => void;
  onClose: () => void;
}

export function PathVariantPicker({ levelNumber, lastPicked, onPick, onClose }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4"
      style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 50%, hsl(218 50% 10% / 0.92), hsl(218 60% 4% / 0.96))',
        backdropFilter: 'blur(8px)',
      }}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', damping: 22, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-md w-full"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          <div>
            <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">
              Milestone · Level {levelNumber}
            </p>
            <h2 className="text-lg font-extrabold tracking-tight">Choose your path.</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground/70 hover:text-foreground active:scale-90 transition"
            style={{ background: 'hsl(var(--muted) / 0.4)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {PATH_VARIANTS.map((v, i) => {
            const isLast = lastPicked === v.id;
            return (
              <motion.button
                key={v.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: 0.08 + i * 0.07 }}
                onClick={() => onPick(v)}
                className={cn(
                  'w-full text-left rounded-2xl p-3.5 active:scale-[0.985] transition-transform',
                  v.tier === 'risky' && 'rd-path-risky',
                )}
                style={{
                  background: `linear-gradient(135deg, hsl(${v.accent} / 0.14), hsl(${v.accent} / 0.04) 60%, hsl(var(--card) / 0.7))`,
                  border: `1px solid hsl(${v.accent} / ${v.tier === 'risky' ? 0.55 : 0.35})`,
                  boxShadow: v.tier === 'risky' ? `0 0 22px -6px hsl(${v.accent} / 0.35)` : undefined,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{
                      background: `linear-gradient(135deg, hsl(${v.accent} / 0.28), hsl(${v.accent} / 0.08))`,
                      border: `1px solid hsl(${v.accent} / 0.4)`,
                      color: `hsl(${v.accent})`,
                    }}
                    aria-hidden
                  >
                    {v.glyph}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                      <h3 className="font-extrabold text-[14px] tracking-tight">{v.name}</h3>
                      <span
                        className="text-[8.5px] font-extrabold uppercase tracking-wider px-1.5 py-[1px] rounded-full"
                        style={{
                          background: `hsl(${v.accent} / 0.18)`,
                          color: `hsl(${v.accent})`,
                          border: `1px solid hsl(${v.accent} / 0.4)`,
                        }}
                      >
                        {TIER_LABEL[v.tier]}
                      </span>
                      {isLast && (
                        <span className="text-[8.5px] font-extrabold uppercase tracking-wider px-1.5 py-[1px] rounded-full bg-muted/40 text-muted-foreground border border-border/30">
                          Last pick
                        </span>
                      )}
                    </div>
                    <p className="font-rd-flavor text-[12px] text-foreground/80 leading-snug">{v.tagline}</p>
                    <ul className="mt-1.5 space-y-0.5">
                      {v.effectLines.map((line, j) => (
                        <li
                          key={j}
                          className="text-[10.5px] font-bold leading-tight"
                          style={{ color: `hsl(${v.accent})` }}
                        >
                          · {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}
