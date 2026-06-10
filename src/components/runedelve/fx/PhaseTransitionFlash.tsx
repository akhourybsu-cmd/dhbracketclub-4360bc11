// Rune Delve — Phase Transition Cinematic (V1 visual overhaul)
//
// One-shot full-screen cinematic for R5 boss phase transitions. The
// engine pushes a combat-log entry when a boss enters phase 2 or 3;
// this layer adds the on-screen beat so the player feels the moment
// rather than reading about it.
//
// Behaviour:
//   • Mounted once on the play page
//   • Re-fires every time `triggerKey` increments
//   • Renders a radial gold flash + a chyron-style "PHASE X" tag
//   • Auto-clears after ~900ms — non-blocking; combat continues underneath

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Props {
  /** Bump on each phase transition. */
  triggerKey: number;
  /** Phase being entered (2 or 3) — drives chyron text. */
  phaseIndex?: 2 | 3;
  /** Boss name displayed under the phase tag. */
  bossName?: string;
  /** Short flavor line under the boss name. */
  flavor?: string;
}

interface Active {
  key: number;
  phase: 2 | 3;
  bossName: string;
  flavor: string;
}

export function PhaseTransitionFlash({ triggerKey, phaseIndex = 2, bossName = '', flavor = '' }: Props) {
  const [active, setActive] = useState<Active | null>(null);

  useEffect(() => {
    if (triggerKey <= 0) return;
    setActive({ key: triggerKey, phase: phaseIndex, bossName, flavor });
    const t = window.setTimeout(() => setActive(null), 950);
    return () => window.clearTimeout(t);
  // We intentionally only depend on the key — the other props are
  // captured at trigger time so a late prop change can't tweak a
  // playing animation mid-flight.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={active.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          aria-hidden
        >
          {/* Radial gold flash — quick punch on entry, lingers a beat. */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.05, 1], opacity: [0, 0.8, 0] }}
            transition={{ duration: 0.9, times: [0, 0.35, 1], ease: 'easeOut' }}
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 50% 35% at 50% 50%, hsl(45 95% 60% / 0.45), hsl(45 95% 60% / 0.10) 40%, transparent 70%)',
            }}
          />
          {/* Chyron — "PHASE 2 — AWAKENED" stays legible against the flash. */}
          <motion.div
            initial={{ scale: 0.92, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', damping: 18, stiffness: 320 }}
            className="relative text-center px-6 py-4 rounded-2xl"
            style={{
              background: 'linear-gradient(180deg, hsl(218 50% 6% / 0.85), hsl(218 60% 4% / 0.92))',
              border: '1px solid hsl(45 95% 60% / 0.65)',
              boxShadow: '0 0 40px hsl(45 95% 60% / 0.45), inset 0 0 20px hsl(45 95% 60% / 0.18)',
            }}
          >
            <p
              className="font-rd-display text-[10px] font-extrabold uppercase tracking-[0.32em]"
              style={{ color: 'hsl(45 95% 65%)' }}
            >
              Phase {active.phase}
            </p>
            {active.bossName && (
              <h2
                className="font-rd-display text-xl font-black tracking-tight mt-1"
                style={{ color: 'hsl(45 95% 78%)', textShadow: '0 0 12px hsl(45 95% 60% / 0.6)' }}
              >
                {active.bossName}
              </h2>
            )}
            {active.flavor && (
              <p className="font-rd-flavor text-[11.5px] text-foreground/80 mt-1 max-w-[280px] leading-snug">
                {active.flavor}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
