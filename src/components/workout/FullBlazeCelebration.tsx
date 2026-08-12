import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

/** One-shot club celebration when the flame hits FULL BLAZE. Self-dismisses.
 *  Portaled to <body> so it overlays the whole shell. */
export function FullBlazeCelebration({ show, onDone }: { show: boolean; onDone: () => void }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [show, onDone]);

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center pointer-events-none overflow-hidden"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}
        >
          {/* heat wash */}
          <motion.div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse 90% 60% at 50% 60%, hsl(24 100% 52% / 0.5), transparent 70%)' }}
            initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.7] }} transition={{ duration: 1.2 }} />
          {/* ember shower */}
          {!reduce && Array.from({ length: 40 }).map((_, k) => {
            const left = (k * 137.5) % 100;
            const delay = (k % 10) * 0.05;
            const dur = 1.6 + (k % 5) * 0.3;
            const sz = 2 + (k % 4);
            return (
              <motion.span key={k} className="absolute rounded-full"
                style={{ left: `${left}%`, bottom: -10, width: sz, height: sz, background: `radial-gradient(circle, hsl(${30 + (k % 20)} 100% 68%), transparent 70%)` }}
                initial={{ opacity: 0, y: 0 }}
                animate={{ opacity: [0, 1, 0], y: [-20, -window.innerHeight * (0.6 + (k % 4) * 0.1)] }}
                transition={{ duration: dur, delay, ease: 'easeOut' }} />
            );
          })}
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: [0.5, 1.12, 1], opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
            className="relative text-center px-6"
          >
            <div className="text-[64px] leading-none mb-2">🔥</div>
            <h1 className="text-[34px] font-black tracking-[0.12em]"
              style={{ color: 'hsl(40 100% 92%)', textShadow: '0 0 30px hsl(24 100% 55% / 0.9)' }}>FULL BLAZE</h1>
            <p className="text-[13px] font-bold mt-1" style={{ color: 'hsl(30 40% 82%)' }}>The club maxed the flame this week</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
