// Rune Delve — Heavy Strike Banner (V1 visual overhaul)
//
// When the player lands a chain of 6+ (the existing "heavy strike"
// threshold the combat engine already recognises), this layer flashes
// a quick chyron over the board. Chain 6 reads "HEAVY STRIKE", 7
// "DEVASTATING", 8+ "ANNIHILATION". The banner is purely cosmetic —
// the engine already handles the damage tier — but it gives big
// chains a moment of presence instead of disappearing into the rune
// clear animation.
//
// Mounted once on the play page; re-fires every time triggerKey
// increments. The chain length passed at trigger time selects the
// label and accent.

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface Props {
  triggerKey: number;
  chainLength?: number;
}

interface Tier {
  label: string;
  accent: string;
}

function tierFor(chainLength: number): Tier {
  if (chainLength >= 8) return { label: 'Annihilation', accent: '0 85% 60%' };
  if (chainLength >= 7) return { label: 'Devastating',  accent: '15 95% 60%' };
  return { label: 'Heavy Strike', accent: '45 95% 60%' };
}

export function HeavyStrikeBanner({ triggerKey, chainLength = 6 }: Props) {
  const [active, setActive] = useState<{ key: number; length: number } | null>(null);

  useEffect(() => {
    if (triggerKey <= 0) return;
    setActive({ key: triggerKey, length: chainLength });
    const t = window.setTimeout(() => setActive(null), 700);
    return () => window.clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  if (!active) return null;
  const tier = tierFor(active.length);

  return (
    <AnimatePresence>
      <motion.div
        key={active.key}
        initial={{ opacity: 0, scale: 1.4, y: -8 }}
        animate={{ opacity: [0, 1, 0.95, 0], scale: [1.4, 1.0, 0.98, 0.94], y: [-8, 0, 2, 6] }}
        transition={{ duration: 0.7, times: [0, 0.15, 0.55, 1] }}
        className="pointer-events-none absolute inset-x-0 top-1/3 flex items-center justify-center z-[40]"
        aria-hidden
      >
        <div
          className="px-5 py-2 rounded-xl"
          style={{
            background: `linear-gradient(180deg, hsl(${tier.accent} / 0.25), hsl(${tier.accent} / 0.08))`,
            border: `1px solid hsl(${tier.accent} / 0.6)`,
            boxShadow: `0 0 30px hsl(${tier.accent} / 0.55), inset 0 0 16px hsl(${tier.accent} / 0.25)`,
          }}
        >
          <p
            className="font-rd-display text-[8px] font-extrabold uppercase tracking-[0.32em] leading-none mb-0.5"
            style={{ color: `hsl(${tier.accent} / 0.85)` }}
          >
            × {active.length}
          </p>
          <h2
            className="font-rd-display text-2xl font-black uppercase tracking-[0.08em] leading-none"
            style={{
              color: `hsl(${tier.accent})`,
              textShadow: `0 0 18px hsl(${tier.accent} / 0.7), 0 1px 0 hsl(218 60% 4%)`,
            }}
          >
            {tier.label}
          </h2>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
