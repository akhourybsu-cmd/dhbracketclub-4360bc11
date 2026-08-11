import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Lightbulb, AlertTriangle } from 'lucide-react';
import { LIBRARY_BY_KEY } from '@/lib/workout/library';

/** How-to tutorial for a workout, keyed by its library key. Portaled to
 *  <body> so its fixed positioning escapes the shell's transforms. */
export function TutorialSheet({ libKey, onClose }: { libKey: string | null; onClose: () => void }) {
  if (typeof document === 'undefined') return null;
  const ex = libKey ? LIBRARY_BY_KEY[libKey] : null;
  return createPortal(
    <AnimatePresence>
      {ex && (
        <motion.div className="fixed inset-0 z-[70] flex flex-col justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.div
            role="dialog" aria-modal="true" aria-label={`How to: ${ex.name}`}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="relative rounded-t-3xl border-t px-5 pt-3"
            style={{
              background: 'linear-gradient(180deg, hsl(16 40% 8%), hsl(12 50% 5%))',
              borderColor: 'hsl(22 90% 55% / 0.28)', color: 'hsl(30 30% 94%)',
              paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))', maxHeight: '88dvh', overflowY: 'auto',
            }}
          >
            <div className="w-10 h-1.5 rounded-full mx-auto mb-3" style={{ background: 'hsl(28 40% 40% / 0.6)' }} aria-hidden />
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'hsl(28 90% 66%)' }}>How to</p>
                <h2 className="text-[19px] font-black tracking-tight">{ex.name}</h2>
              </div>
              <button onClick={onClose} aria-label="Close" className="fg-back flex-shrink-0"><X className="w-5 h-5" /></button>
            </div>

            <p className="text-[13px] leading-snug mb-4" style={{ color: 'hsl(30 20% 72%)' }}>{ex.tutorial.summary}</p>

            <div className="space-y-2 mb-4">
              {ex.tutorial.steps.map((s, i) => (
                <div key={i} className="flex gap-3 items-start rounded-xl p-2.5" style={{ background: 'hsl(18 40% 11% / 0.6)' }}>
                  <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-black"
                    style={{ background: 'linear-gradient(135deg, hsl(24 100% 58%), hsl(38 96% 50%))', color: 'hsl(16 40% 8%)' }}>{i + 1}</span>
                  <p className="text-[13.5px] leading-snug pt-0.5">{s}</p>
                </div>
              ))}
            </div>

            {ex.tutorial.cues.length > 0 && (
              <div className="rounded-xl p-3 mb-3" style={{ background: 'hsl(38 60% 14% / 0.4)', border: '1px solid hsl(38 90% 55% / 0.2)' }}>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] mb-1.5 inline-flex items-center gap-1.5" style={{ color: 'hsl(40 95% 62%)' }}>
                  <Lightbulb className="w-3.5 h-3.5" /> Form cues
                </p>
                <ul className="space-y-1">
                  {ex.tutorial.cues.map((c, i) => (
                    <li key={i} className="flex gap-2 text-[13px]" style={{ color: 'hsl(38 25% 82%)' }}><Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: 'hsl(40 90% 60%)' }} />{c}</li>
                  ))}
                </ul>
              </div>
            )}

            {ex.tutorial.mistakes && ex.tutorial.mistakes.length > 0 && (
              <div className="rounded-xl p-3" style={{ background: 'hsl(6 60% 14% / 0.35)', border: '1px solid hsl(6 90% 55% / 0.2)' }}>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] mb-1.5 inline-flex items-center gap-1.5" style={{ color: 'hsl(8 95% 68%)' }}>
                  <AlertTriangle className="w-3.5 h-3.5" /> Avoid
                </p>
                <ul className="space-y-1">
                  {ex.tutorial.mistakes.map((c, i) => (
                    <li key={i} className="text-[13px]" style={{ color: 'hsl(8 25% 80%)' }}>• {c}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
