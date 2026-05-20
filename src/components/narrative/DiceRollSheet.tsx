// DH Club — Narrative RPG · Dice roll composer
//
// Portaled bottom-sheet for setting up a roll: pick stat, modifier,
// difficulty, advantage, optional reason. Used by both player and GM.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Dices } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CHRONICLE_STATS, type ChronicleStat, type RollAdvantage } from '@/lib/narrative/chronicleRuleset';
import type { Character } from '@/lib/narrative/types';

interface Props {
  open: boolean;
  onClose: () => void;
  character: Character | null;
  /** When true, GM picker gets an extra Visibility (Hidden) toggle. */
  isGm?: boolean;
  onRoll: (input: {
    stat: ChronicleStat | 'none';
    statValue: number;
    modifier: number;
    difficulty: number;
    advantage: RollAdvantage;
    reason: string;
    visibility: 'public' | 'gm_only';
  }) => Promise<void>;
}

export function DiceRollSheet({ open, onClose, character, isGm, onRoll }: Props) {
  const [stat, setStat] = useState<ChronicleStat | 'none'>('grit');
  const [modifier, setModifier] = useState(0);
  const [difficulty, setDifficulty] = useState(0);
  const [advantage, setAdvantage] = useState<RollAdvantage>('none');
  const [reason, setReason] = useState('');
  const [hidden, setHidden] = useState(false);
  const [rolling, setRolling] = useState(false);

  if (!open || typeof document === 'undefined') return null;

  const statValue = (() => {
    if (!character || stat === 'none') return 0;
    return character[`stat_${stat}` as keyof Character] as number;
  })();

  const submit = async () => {
    setRolling(true);
    let ok = false;
    try {
      await onRoll({
        stat,
        statValue,
        modifier,
        difficulty,
        advantage,
        reason: reason.trim(),
        visibility: hidden ? 'gm_only' : 'public',
      });
      ok = true;
    } catch (e) {
      // Don't auto-close on error — the user's setup (stat / modifier
      // / reason) stays on screen so they can adjust and retry without
      // recomposing the whole roll.
      toast.error(`Roll failed: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      // ALWAYS clear rolling — fixes the permanent-loading bug where a
      // thrown error from onRoll left the Roll button disabled forever.
      setRolling(false);
    }
    if (ok) {
      setReason('');
      onClose();
    }
  };

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center"
      style={{ background: 'hsl(218 50% 3% / 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[88dvh] rounded-t-2xl flex flex-col overflow-hidden bg-card border border-border/40"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/25">
          <div className="flex items-center gap-2">
            <Dices className="w-4 h-4 text-primary" />
            <h2 className="text-[14px] font-extrabold tracking-tight">Roll the dice</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg bg-muted/40 active:scale-90 flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Stat picker */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Stat</p>
            <div className="grid grid-cols-2 gap-2">
              {CHRONICLE_STATS.map(s => {
                const v = character ? (character[`stat_${s.id}` as keyof Character] as number) : 0;
                const selected = stat === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStat(s.id)}
                    className={`rounded-xl p-2.5 border bg-card text-left transition ${selected ? 'ring-1 ring-primary/40' : ''}`}
                    style={{
                      borderColor: selected ? `hsl(${s.accent})` : 'hsl(var(--border) / 0.4)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-extrabold">{s.label}</span>
                      <span className="text-[12px] font-extrabold tabular-nums" style={{ color: `hsl(${s.accent})` }}>
                        {v >= 0 ? `+${v}` : v}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5">{s.tagline}</p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Reason */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Reason (optional)</p>
            <Textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder='e.g. "Sneak past the security guard"'
              rows={2}
              className="text-[13px]"
            />
          </section>

          {/* Advantage / Disadvantage */}
          <section>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Edge</p>
            <div className="grid grid-cols-3 gap-2">
              {(['advantage', 'none', 'disadvantage'] as const).map(a => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAdvantage(a)}
                  className={`rounded-xl py-2 text-[11px] font-extrabold uppercase tracking-wider border ${advantage === a ? 'bg-primary/15 text-primary border-primary/40' : 'bg-card border-border/40 text-muted-foreground/80'}`}
                >
                  {a === 'none' ? 'Straight' : a === 'advantage' ? 'Adv' : 'Disadv'}
                </button>
              ))}
            </div>
          </section>

          {/* Modifier + Difficulty */}
          <section className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-1">Modifier</p>
              <Input type="number" value={modifier} onChange={e => setModifier(parseInt(e.target.value, 10) || 0)} className="h-10 text-center" />
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-1">Difficulty</p>
              <Input type="number" value={difficulty} onChange={e => setDifficulty(Math.max(0, parseInt(e.target.value, 10) || 0))} className="h-10 text-center" />
            </div>
          </section>

          {/* GM hidden toggle */}
          {isGm && (
            <button
              type="button"
              onClick={() => setHidden(h => !h)}
              className="w-full text-left rounded-xl p-3 bg-muted/30 border border-border/40"
            >
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-extrabold">Hidden roll (GM-only)</p>
                <div className={`w-9 h-5 rounded-full p-0.5 transition ${hidden ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`w-4 h-4 rounded-full bg-background transition ${hidden ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
              <p className="text-[10.5px] text-muted-foreground/70 mt-0.5">Players won't see the result — only the narrative outcome you choose to share.</p>
            </button>
          )}

          {/* Preview */}
          <div className="rounded-xl bg-muted/25 border border-border/30 px-3 py-2.5 text-[11.5px] text-muted-foreground/85">
            Rolling <span className="font-extrabold text-foreground/90">1d20{statValue !== 0 ? (statValue >= 0 ? ` + ${statValue}` : ` − ${Math.abs(statValue)}`) : ''}{modifier !== 0 ? (modifier >= 0 ? ` + ${modifier}` : ` − ${Math.abs(modifier)}`) : ''}{difficulty > 0 ? ` (diff ${difficulty})` : ''}</span>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border/25">
          <button
            type="button"
            onClick={submit}
            disabled={rolling}
            className="w-full h-12 rounded-xl text-[13px] font-extrabold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
              color: 'hsl(var(--primary-foreground))',
              boxShadow: '0 4px 14px hsl(var(--primary) / 0.4)',
            }}
          >
            <Dices className="w-4 h-4" /> {rolling ? 'Rolling…' : 'Roll'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
