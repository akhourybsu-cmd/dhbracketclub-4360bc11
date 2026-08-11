import { motion, useReducedMotion } from 'framer-motion';

// The club's collective flame. `intensity` (0 → ~1.5) is how hard the whole
// club has stoked it this week; the flame grows taller, brighter, whiter-hot
// and throws more embers as it climbs. Pure SVG + framer — no assets, no
// external libs, theme-independent (lives inside the FORGE ember shell).

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

export function ClubFlame({ intensity }: { intensity: number }) {
  const reduce = useReducedMotion();
  const i = clamp(intensity, 0, 1.5);
  const lit = i > 0.02;

  // Derived look.
  const scale = 0.55 + i * 0.55;                 // taller as it grows
  const glow = 0.18 + i * 0.62;                  // background bloom
  const coreOpacity = clamp((i - 0.35) / 0.9, 0, 1); // white-hot core appears higher up
  const flickerDur = Math.max(0.7, 1.8 - i * 0.8);   // faster flicker when roaring
  const emberCount = Math.round(3 + i * 9);
  // Hue shifts warmer→brighter with intensity.
  const outer = `hsl(${12 + i * 8} 100% ${48 + i * 6}%)`;
  const mid = `hsl(${28 + i * 10} 100% ${55 + i * 6}%)`;
  const inner = `hsl(${44 + i * 6} 100% ${68 + i * 8}%)`;

  return (
    <div className="relative flex items-end justify-center" style={{ width: 200, height: 240 }} aria-hidden>
      {/* Ground bloom */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 230, height: 200, bottom: 6, background: `radial-gradient(circle, ${outer.replace(')', ` / ${glow})`)}, transparent 66%)`, filter: 'blur(20px)' }}
        animate={reduce ? undefined : { opacity: [glow * 0.75, glow, glow * 0.8], scale: [1, 1.05, 1] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Rising embers */}
      {lit && Array.from({ length: emberCount }).map((_, k) => {
        const left = 50 + (((k * 37) % 60) - 30); // deterministic spread
        const delay = (k % emberCount) * (1.6 / emberCount);
        const dur = 1.8 + (k % 4) * 0.5;
        const sz = 2 + (k % 3);
        return (
          <motion.span key={k} className="absolute rounded-full"
            style={{ left: `${left}%`, bottom: 40, width: sz, height: sz, background: `radial-gradient(circle, ${inner}, transparent 70%)` }}
            initial={{ opacity: 0, y: 0 }}
            animate={reduce ? { opacity: 0.5 } : { opacity: [0, 1, 0], y: [-4, -80 - i * 40], x: [0, (k % 2 ? 1 : -1) * (6 + (k % 5) * 3)] }}
            transition={{ duration: dur, repeat: Infinity, delay, ease: 'easeOut' }}
          />
        );
      })}

      {/* Flame body */}
      <motion.svg
        viewBox="0 0 100 150" width={150} height={210}
        className="relative z-[1]"
        style={{ transformOrigin: '50% 100%', transform: `scale(${scale})`, filter: `drop-shadow(0 0 ${8 + i * 22}px ${mid.replace(')', ' / 0.6)')})` }}
        animate={reduce ? undefined : { scaleY: [1, 1.06, 0.97, 1.04, 1], scaleX: [1, 0.97, 1.02, 0.98, 1] }}
        transition={{ duration: flickerDur, repeat: Infinity, ease: 'easeInOut' }}
      >
        <defs>
          <linearGradient id="fgOuter" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={outer} />
            <stop offset="60%" stopColor={mid} />
            <stop offset="100%" stopColor={mid} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="fgInner" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={mid} />
            <stop offset="70%" stopColor={inner} />
            <stop offset="100%" stopColor={inner} stopOpacity="0" />
          </linearGradient>
        </defs>
        {lit ? (
          <>
            {/* outer flame silhouette */}
            <path d="M50 4 C 66 34, 82 52, 66 92 C 62 104, 70 112, 62 124 C 88 108, 84 150, 50 148 C 16 150, 12 108, 38 124 C 30 112, 38 104, 34 92 C 18 52, 34 34, 50 4 Z" fill="url(#fgOuter)" />
            {/* inner flame */}
            <motion.path d="M50 36 C 60 56, 68 68, 58 96 C 54 108, 62 116, 52 128 C 70 118, 66 138, 50 138 C 34 138, 30 118, 48 128 C 38 116, 46 108, 42 96 C 32 68, 40 56, 50 36 Z" fill="url(#fgInner)"
              animate={reduce ? undefined : { scaleY: [1, 1.08, 0.95, 1] }} transition={{ duration: flickerDur * 0.7, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '50% 100%' }} />
            {/* white-hot core (high intensity) */}
            {coreOpacity > 0 && (
              <motion.ellipse cx="50" cy="120" rx="10" ry="22" fill="hsl(48 100% 92%)" opacity={coreOpacity}
                animate={reduce ? undefined : { ry: [22, 26, 20, 22], opacity: [coreOpacity, coreOpacity * 0.8, coreOpacity] }}
                transition={{ duration: flickerDur * 0.6, repeat: Infinity, ease: 'easeInOut' }} />
            )}
          </>
        ) : (
          // Unlit: faint embers waiting to catch.
          <ellipse cx="50" cy="132" rx="24" ry="10" fill="hsl(18 60% 30%)" opacity="0.5" />
        )}
      </motion.svg>
    </div>
  );
}
