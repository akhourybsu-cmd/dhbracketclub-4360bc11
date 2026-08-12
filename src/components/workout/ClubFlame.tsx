import { useEffect } from 'react';
import { motion, useReducedMotion, useAnimationControls } from 'framer-motion';

// The club's collective flame. `intensity` (0 → ~1.5) is how hard the whole
// club has stoked it this week; the flame grows taller, brighter, whiter-hot
// and throws more embers as it climbs. `surge` (increment it) makes the flame
// leap and spit an ember burst in the moment someone logs. Pure SVG + framer.

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

/** One-shot ember burst, remounted each surge. */
function Burst({ color, i }: { color: string; i: number }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <>
      {Array.from({ length: 14 }).map((_, k) => {
        const ang = (k / 14) * Math.PI - Math.PI;         // fan upward
        const dist = 60 + (k % 5) * 16 + i * 30;
        const sz = 2 + (k % 3);
        return (
          <motion.span key={k} className="absolute rounded-full"
            style={{ left: '50%', bottom: 70, width: sz, height: sz, background: `radial-gradient(circle, ${color}, transparent 70%)` }}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{ opacity: 0, x: Math.cos(ang) * dist, y: -Math.abs(Math.sin(ang)) * dist - 20, scale: 0.4 }}
            transition={{ duration: 0.7 + (k % 3) * 0.15, ease: 'easeOut' }}
          />
        );
      })}
    </>
  );
}

export function ClubFlame({ intensity, surge = 0 }: { intensity: number; surge?: number }) {
  const reduce = useReducedMotion();
  const i = clamp(intensity, 0, 1.5);
  const lit = i > 0.02;
  const pop = useAnimationControls();

  useEffect(() => {
    if (!surge || reduce) return;
    pop.start({ scale: [1, 1.16, 0.98, 1], transition: { duration: 0.55, ease: 'easeOut' } });
  }, [surge, reduce, pop]);

  const scale = 0.55 + i * 0.55;
  const glow = 0.18 + i * 0.62;
  const coreOpacity = clamp((i - 0.35) / 0.9, 0, 1);
  const flickerDur = Math.max(0.7, 1.8 - i * 0.8);
  const emberCount = Math.round(3 + i * 9);
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

      {/* Steady rising embers */}
      {lit && Array.from({ length: emberCount }).map((_, k) => {
        const left = 50 + (((k * 37) % 60) - 30);
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

      {/* Surge burst — remounts on each surge */}
      {surge > 0 && <Burst key={surge} color={inner} i={i} />}

      {/* Flame body (wrapped so surge can pop it independently of the flicker) */}
      <motion.div animate={pop} className="relative z-[1]" style={{ transformOrigin: '50% 100%' }}>
        <motion.svg
          viewBox="0 0 100 150" width={150} height={210}
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
              <path d="M50 4 C 66 34, 82 52, 66 92 C 62 104, 70 112, 62 124 C 88 108, 84 150, 50 148 C 16 150, 12 108, 38 124 C 30 112, 38 104, 34 92 C 18 52, 34 34, 50 4 Z" fill="url(#fgOuter)" />
              <motion.path d="M50 36 C 60 56, 68 68, 58 96 C 54 108, 62 116, 52 128 C 70 118, 66 138, 50 138 C 34 138, 30 118, 48 128 C 38 116, 46 108, 42 96 C 32 68, 40 56, 50 36 Z" fill="url(#fgInner)"
                animate={reduce ? undefined : { scaleY: [1, 1.08, 0.95, 1] }} transition={{ duration: flickerDur * 0.7, repeat: Infinity, ease: 'easeInOut' }} style={{ transformOrigin: '50% 100%' }} />
              {coreOpacity > 0 && (
                <motion.ellipse cx="50" cy="120" rx="10" ry="22" fill="hsl(48 100% 92%)" opacity={coreOpacity}
                  animate={reduce ? undefined : { ry: [22, 26, 20, 22], opacity: [coreOpacity, coreOpacity * 0.8, coreOpacity] }}
                  transition={{ duration: flickerDur * 0.6, repeat: Infinity, ease: 'easeInOut' }} />
              )}
            </>
          ) : (
            <ellipse cx="50" cy="132" rx="24" ry="10" fill="hsl(18 60% 30%)" opacity="0.5" />
          )}
        </motion.svg>
      </motion.div>
    </div>
  );
}
