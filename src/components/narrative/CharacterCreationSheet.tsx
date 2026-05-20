// DH Club — Narrative RPG · Character creation sheet
//
// Guided, mobile-friendly character builder. Walks the player through
// name + archetype + identity + stat distribution against the Chronicle
// Ruleset. Validates point spend and per-stat caps before submit.
// Flamingo Protocol campaigns surface archetype suggestions (not
// prebuilt characters — players still write their own backstory etc.).

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, User, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  CHRONICLE_STATS, CHARACTER_CREATION, pointsSpent, validateStartingStats,
  type ChronicleStat,
} from '@/lib/narrative/chronicleRuleset';
import { getTemplate, type TemplateKey } from '@/lib/narrative/templates';

interface Props {
  open: boolean;
  onClose: () => void;
  templateKey: TemplateKey;
  onCreate: (input: {
    name: string;
    pronouns: string | null;
    archetype: string | null;
    backstory: string | null;
    personality: string | null;
    goal: string | null;
    flaw: string | null;
    signature_move: string | null;
    stat_grit: number;
    stat_charm: number;
    stat_cunning: number;
    stat_chaos: number;
    stat_focus: number;
    inventory: unknown[];
    conditions: unknown[];
    notes_public: string | null;
    notes_private: string | null;
    avatar_url: string | null;
  }) => Promise<unknown | null | void>;
}

type Step = 0 | 1 | 2 | 3;

const STEPS: { key: Step; label: string }[] = [
  { key: 0, label: 'Identity' },
  { key: 1, label: 'Archetype' },
  { key: 2, label: 'Stats' },
  { key: 3, label: 'Story' },
];

const ZERO_STATS = { grit: 0, charm: 0, cunning: 0, chaos: 0, focus: 0 };

export function CharacterCreationSheet({ open, onClose, templateKey, onCreate }: Props) {
  const template = getTemplate(templateKey);
  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [archetype, setArchetype] = useState('');
  const [stats, setStats] = useState<Record<ChronicleStat, number>>({ ...ZERO_STATS });
  const [backstory, setBackstory] = useState('');
  const [personality, setPersonality] = useState('');
  const [goal, setGoal] = useState('');
  const [flaw, setFlaw] = useState('');
  const [signatureMove, setSignatureMove] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(0);
      setName(''); setPronouns(''); setArchetype('');
      setStats({ ...ZERO_STATS });
      setBackstory(''); setPersonality(''); setGoal(''); setFlaw(''); setSignatureMove('');
    }
  }, [open]);

  const spent = useMemo(() => pointsSpent(stats), [stats]);
  const remaining = CHARACTER_CREATION.totalPoints - spent;
  const statIssues = useMemo(() => validateStartingStats(stats), [stats]);
  const statsValid = statIssues.length === 0 && spent === CHARACTER_CREATION.totalPoints;

  const stepValid: Record<Step, boolean> = {
    0: name.trim().length >= 2,
    1: true, // archetype optional
    2: statsValid,
    3: true,
  };

  const bumpStat = (id: ChronicleStat, delta: number) => {
    setStats(prev => {
      const next = (prev[id] ?? 0) + delta;
      if (next < CHARACTER_CREATION.minStartingStat || next > CHARACTER_CREATION.maxStartingStat) return prev;
      if (delta > 0 && spent + delta > CHARACTER_CREATION.totalPoints) return prev;
      return { ...prev, [id]: next };
    });
  };

  const submit = async () => {
    if (!stepValid[0] || !stepValid[2]) {
      toast.error('Finish your character first.');
      return;
    }
    setSubmitting(true);
    try {
      // Thread the result through so silent persistence failures (RLS
      // rejection because the player isn't a campaign member yet,
      // network errors, etc.) surface as a real error toast instead
      // of a misleading "Character created" success.
      const result = await onCreate({
        name: name.trim(),
        pronouns: pronouns.trim() || null,
        archetype: archetype.trim() || null,
        backstory: backstory.trim() || null,
        personality: personality.trim() || null,
        goal: goal.trim() || null,
        flaw: flaw.trim() || null,
        signature_move: signatureMove.trim() || null,
        stat_grit: stats.grit,
        stat_charm: stats.charm,
        stat_cunning: stats.cunning,
        stat_chaos: stats.chaos,
        stat_focus: stats.focus,
        inventory: [],
        conditions: [],
        notes_public: null,
        notes_private: null,
        avatar_url: null,
      });
      if (!result) {
        toast.error(
          "Couldn't save your character. If you were invited recently, make sure you've accepted the invite first.",
        );
        return;
      }
      toast.success('Character created.');
      onClose();
    } catch (e) {
      toast.error(`Couldn't save character: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      // Always clear submitting so the form button never sticks in a
      // permanent loading state if the await above throws.
      setSubmitting(false);
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
        className="relative w-full max-w-md max-h-[92dvh] rounded-t-2xl flex flex-col overflow-hidden bg-card border border-border/40"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Header + step strip */}
        <div className="px-4 py-3 border-b border-border/25">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <h2 className="text-[14px] font-extrabold tracking-tight">Create your character</h2>
            </div>
            <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg bg-muted/40 active:scale-90 flex items-center justify-center">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-1">
            {STEPS.map(s => (
              <div
                key={s.key}
                className={`flex-1 h-1 rounded-full transition ${s.key === step ? 'bg-primary' : s.key < step ? 'bg-primary/50' : 'bg-muted/40'}`}
              />
            ))}
          </div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mt-2">
            Step {step + 1} of {STEPS.length} · {STEPS[step].label}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {step === 0 && (
            <div className="space-y-3">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Character name</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Taco Delaney" className="mt-1.5 h-11" />
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Pronouns (optional)</Label>
                <Input value={pronouns} onChange={e => setPronouns(e.target.value)} placeholder="e.g. they/them" className="mt-1.5 h-11" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Archetype (optional)</Label>
                <Input value={archetype} onChange={e => setArchetype(e.target.value)} placeholder="One short label that fits your character" className="mt-1.5 h-11" />
              </div>
              {template.characterArchetypes && template.characterArchetypes.length > 0 && (
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 mb-2">Suggestions</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {template.characterArchetypes.map(a => (
                      <button
                        key={a.label}
                        type="button"
                        onClick={() => setArchetype(a.label)}
                        className={`text-left rounded-xl p-2.5 border bg-card transition ${archetype === a.label ? 'border-primary ring-1 ring-primary/30' : 'border-border/40'}`}
                      >
                        <p className="text-[12px] font-extrabold">{a.label}</p>
                        <p className="text-[10.5px] text-muted-foreground/75 leading-snug">{a.blurb}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-extrabold">Points remaining</p>
                  <p className="text-[9.5px] text-muted-foreground/70">Spend exactly {CHARACTER_CREATION.totalPoints}. Max {CHARACTER_CREATION.maxStartingStat} in any stat.</p>
                </div>
                <span className="text-[20px] font-black tabular-nums" style={{ color: remaining === 0 ? 'hsl(var(--success))' : remaining < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))' }}>
                  {remaining}
                </span>
              </div>
              <div className="space-y-2">
                {CHRONICLE_STATS.map(s => (
                  <div
                    key={s.id}
                    className="rounded-xl bg-card border border-border/40 p-2.5 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-extrabold" style={{ color: `hsl(${s.accent})` }}>{s.label}</p>
                      <p className="text-[10px] text-muted-foreground/70 leading-snug">{s.tagline}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => bumpStat(s.id, -1)}
                        disabled={(stats[s.id] ?? 0) <= CHARACTER_CREATION.minStartingStat}
                        className="w-8 h-8 rounded-md bg-muted/40 active:scale-90 disabled:opacity-30 transition"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-[15px] font-black tabular-nums">{stats[s.id]}</span>
                      <button
                        type="button"
                        onClick={() => bumpStat(s.id, +1)}
                        disabled={(stats[s.id] ?? 0) >= CHARACTER_CREATION.maxStartingStat || remaining <= 0}
                        className="w-8 h-8 rounded-md active:scale-90 disabled:opacity-30 transition"
                        style={{ background: `hsl(${s.accent} / 0.2)`, color: `hsl(${s.accent})` }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {statIssues.length > 0 && (
                <ul className="text-[10.5px] text-destructive/85 list-disc ml-4">
                  {statIssues.map((i, idx) => <li key={idx}>{i}</li>)}
                </ul>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Backstory (short)</Label>
                <Textarea value={backstory} onChange={e => setBackstory(e.target.value)} rows={3} placeholder="Where do they come from? What's their deal?" className="mt-1.5 text-[12.5px]" />
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Personality</Label>
                <Input value={personality} onChange={e => setPersonality(e.target.value)} placeholder="A line or two." className="mt-1.5 h-11" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Goal</Label>
                  <Input value={goal} onChange={e => setGoal(e.target.value)} placeholder="What do they want?" className="mt-1.5 h-11" />
                </div>
                <div>
                  <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Flaw</Label>
                  <Input value={flaw} onChange={e => setFlaw(e.target.value)} placeholder="A weakness." className="mt-1.5 h-11" />
                </div>
              </div>
              <div>
                <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">Signature move</Label>
                <Input value={signatureMove} onChange={e => setSignatureMove(e.target.value)} placeholder="A move only your character makes." className="mt-1.5 h-11" />
                <p className="text-[10.5px] text-muted-foreground/65 mt-1">Optional. The GM can lean on this for cinematic moments.</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border/25 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStep(s => Math.max(0, s - 1) as Step)}
            disabled={step === 0}
            className="flex-1 h-11 rounded-xl bg-muted/40 border border-border/40 text-[12px] font-extrabold inline-flex items-center justify-center gap-1 active:scale-[0.98] transition disabled:opacity-40"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Back
          </button>
          {step < 3 ? (
            <button
              type="button"
              onClick={() => stepValid[step] ? setStep(s => Math.min(3, s + 1) as Step) : toast.error('Fill in this step first.')}
              className="flex-1 h-11 rounded-xl text-[12px] font-extrabold inline-flex items-center justify-center gap-1 active:scale-[0.98] transition"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))', color: 'hsl(var(--primary-foreground))' }}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !stepValid[2] || !stepValid[0]}
              className="flex-1 h-11 rounded-xl text-[12px] font-extrabold inline-flex items-center justify-center gap-1 active:scale-[0.98] transition disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))', color: 'hsl(var(--primary-foreground))' }}
            >
              <Sparkles className="w-3.5 h-3.5" /> Create character
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
