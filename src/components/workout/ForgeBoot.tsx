import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';

const BOOT_FLAG = 'fg_boot_played_v1';
const DURATION = 1300;
const STAGES = ['Stoking the coals…', 'Loading this week…', 'FORGE online'];

/** One-time boot intro for the FORGE shell — plays once per browser session
 *  on first entry into /workouts/*, mirroring the Draft Arena boot. */
export function ForgeBoot() {
  const [show, setShow] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    let played = false;
    try { played = sessionStorage.getItem(BOOT_FLAG) === '1'; } catch { /* ignore */ }
    if (played) return;
    setShow(true);
    try { sessionStorage.setItem(BOOT_FLAG, '1'); } catch { /* ignore */ }

    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const elapsed = t - start;
      const linear = Math.min(1, elapsed / DURATION);
      const eased = 1 - Math.pow(1 - linear, 1.7);
      setProgress(Math.round(eased * 100));
      if (linear > 0.45 && linear <= 0.85) setStage(1);
      if (linear > 0.85) setStage(2);
      if (linear < 1) raf = requestAnimationFrame(tick);
      else setTimeout(() => setShow(false), 280);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
          transition={{ duration: 0.18 }}
          className="fg-mode fg-boot fixed inset-0 z-[100] overflow-hidden flex flex-col items-center justify-center px-6"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {/* Emblem: pulsing ember behind a slowly-rotating dashed ring */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative w-32 h-32 mb-7 flex items-center justify-center"
          >
            <motion.div
              className="fg-boot-emblem-glow absolute inset-0 rounded-full"
              animate={{ opacity: [0.4, 0.85, 0.4], scale: [1, 1.12, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ filter: 'blur(12px)' }}
            />
            <motion.div
              className="fg-boot-ring absolute inset-2 rounded-full border"
              animate={{ rotate: 360 }} transition={{ duration: 8, ease: 'linear', repeat: Infinity }}
              style={{ borderStyle: 'dashed' }}
            />
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Flame className="w-14 h-14" style={{ color: 'hsl(28 100% 62%)', filter: 'drop-shadow(0 0 12px hsl(24 100% 55% / 0.8))' }} strokeWidth={2.2} />
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }} className="text-center"
          >
            <p className="fg-boot-eyebrow text-[10px] font-extrabold uppercase tracking-[0.32em] mb-1.5">◆ DH · Weekly Gauntlet ◆</p>
            <h1 className="fg-boot-title text-[30px] font-black leading-none tracking-[0.12em]">FORGE</h1>
            <p className="text-[10px] font-bold mt-1.5" style={{ color: 'hsl(30 20% 70%)' }}>Stepping onto the anvil</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }} className="mt-8 w-full max-w-[260px]"
          >
            <div className="fg-boot-bar-track relative h-1.5 rounded-full overflow-hidden">
              <motion.div className="fg-boot-bar-fill h-full relative" style={{ width: `${progress}%` }}>
                <span className="absolute right-0 top-0 bottom-0 w-5" style={{ background: 'linear-gradient(90deg, transparent, hsl(0 0% 100% / 0.6))' }} />
              </motion.div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <AnimatePresence mode="wait">
                <motion.p key={stage}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.22 }}
                  className="fg-boot-eyebrow text-[9px] font-extrabold uppercase tracking-[0.24em]"
                >{STAGES[stage]}</motion.p>
              </AnimatePresence>
              <span className="text-[10px] font-mono tabular-nums" style={{ color: 'hsl(30 20% 65%)' }}>{progress}%</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
