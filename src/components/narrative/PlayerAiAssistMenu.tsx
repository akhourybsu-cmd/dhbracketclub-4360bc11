// DH Club — Narrative RPG · Player writing assist
//
// A small dropdown that lives inside the player composer. Offers five
// safe writing-assist intents:
//
//   • Make this more in-character
//   • Make this more cinematic
//   • Make this funnier
//   • Clarify my action
//   • Recap what's happening publicly
//
// Strict guarantees (also enforced server-side by the edge function):
//   • Only public scene context + the player's own character data
//     are sent to AI.
//   • AI returns a new draft string; we ONLY fill the composer.
//     Nothing posts automatically.
//   • Buttons are disabled when AI is not configured.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Sparkles, X, Loader2, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { invokePlayerTool, isAiConfigured } from '@/lib/narrative/aiService';
import type { Character } from '@/lib/narrative/types';

interface Props {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  character: Character | null;
  /** Current composer text. */
  draft: string;
  /** Called with the AI-generated draft so the parent fills the composer. */
  onApply: (next: string) => void;
}

type Intent = 'in_character' | 'cinematic' | 'funnier' | 'clarify_scene' | 'recap_public';

const INTENTS: Array<{ id: Intent; label: string; blurb: string }> = [
  { id: 'in_character',  label: 'More in-character', blurb: 'Rewrite so it sounds like your character.' },
  { id: 'cinematic',     label: 'More cinematic',    blurb: 'Punch up the imagery and pacing.' },
  { id: 'funnier',       label: 'Funnier',           blurb: 'Lean into the joke.' },
  { id: 'clarify_scene', label: 'Clarify my action', blurb: 'State your intent more clearly.' },
  { id: 'recap_public',  label: 'Recap publicly',    blurb: 'Summarize what your character knows so far.' },
];

export function PlayerAiAssistMenu({ open, onClose, campaignId, character, draft, onApply }: Props) {
  const [busy, setBusy] = useState<Intent | null>(null);
  const configured = isAiConfigured();

  const run = async (intent: Intent) => {
    setBusy(intent);
    try {
      const result = await invokePlayerTool({
        campaignId,
        characterName: character?.name,
        characterArchetype: character?.archetype ?? undefined,
        draft,
        intent,
      });
      if ('available' in result && result.available === false) {
        toast.error(result.reason);
        return;
      }
      if (!('draft' in result)) return;
      onApply(result.draft);
      toast.success('Draft updated — review before sending.');
      onClose();
    } catch (e) {
      // invokePlayerTool already has its own try/catch returning
      // AiUnavailable, so this is belt-and-suspenders for anything
      // that slips past — leaves the menu usable instead of locked
      // on a single intent button forever.
      toast.error(`AI assist failed: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      setBusy(null);
    }
  };

  if (!open || typeof document === 'undefined') return null;

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
            <Wand2 className="w-4 h-4 text-primary" />
            <h2 className="text-[14px] font-extrabold tracking-tight">Help me write</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg bg-muted/40 active:scale-90 flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
          <p className="text-[10.5px] text-muted-foreground/75 leading-relaxed">
            The assistant only sees the <span className="font-extrabold text-foreground/85">public scene</span> and your <span className="font-extrabold text-foreground/85">own character</span>. It can't see GM notes, hidden clues, or secret faction motives. Nothing posts automatically — you'll review the new draft first.
          </p>
          {!configured && (
            <div className="rounded-xl border border-warning/35 bg-warning/8 p-3">
              <p className="text-[11px] text-foreground/80">AI assistance isn't enabled for this build.</p>
            </div>
          )}
          {INTENTS.map(i => (
            <button
              key={i.id}
              type="button"
              onClick={() => run(i.id)}
              disabled={!configured || !!busy}
              className="w-full text-left rounded-xl bg-card border border-border/40 p-3 active:scale-[0.98] transition disabled:opacity-50"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12.5px] font-extrabold">{i.label}</p>
                {busy === i.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground/70" />}
                {busy !== i.id && <Sparkles className="w-3.5 h-3.5 text-primary/70" />}
              </div>
              <p className="text-[10.5px] text-muted-foreground/75 leading-snug mt-0.5">{i.blurb}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
