// ═══════════════════════════════════════════════════════════════════
// READSHIFT — How to Play (in-app instruction manual)
// ═══════════════════════════════════════════════════════════════════
import { useState } from 'react';
import { BookOpen, VenetianMask, PenLine, Eye, Trophy, Sparkles, Target, EyeOff, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Props {
  trigger?: React.ReactNode;
  variant?: 'button' | 'icon';
}

export function HowToPlayDialog({ trigger, variant = 'button' }: Props) {
  const [open, setOpen] = useState(false);

  const defaultTrigger =
    variant === 'icon' ? (
      <button
        aria-label="How to play"
        className="w-9 h-9 rounded-xl flex items-center justify-center btn-press border border-border/50 bg-card/50"
      >
        <BookOpen className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
      </button>
    ) : (
      <button className="w-full h-10 rounded-xl font-bold btn-press flex items-center justify-center gap-2 border border-border/60 bg-card/40 text-[13px]">
        <BookOpen className="w-4 h-4" /> How to Play
      </button>
    );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60 px-5 py-4">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{
                  background:
                    'linear-gradient(135deg, hsl(var(--primary) / 0.25), hsl(var(--primary) / 0.05))',
                }}
              >
                <VenetianMask className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              </div>
              <div className="text-left">
                <DialogTitle className="text-lg font-black tracking-tight">READSHIFT</DialogTitle>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
                  Player's Manual
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-5 py-4 space-y-6 text-[13px] leading-relaxed">
          {/* ─── The Pitch ─── */}
          <Section title="The Idea" kicker="01">
            <p>
              READSHIFT is an async social deduction game. Each round, everyone answers the same
              prompt anonymously. Then you all try to <b>read</b> the room — guess who wrote what,
              and score for insight, disguise, and misdirection.
            </p>
          </Section>

          {/* ─── Setup ─── */}
          <Section title="Setup" kicker="02" icon={<Users className="w-4 h-4" />}>
            <ul className="space-y-1.5 list-disc pl-4">
              <li>4–12 players per game (sweet spot: 5–8).</li>
              <li>The creator picks the number of rounds (3–7) and phase timers.</li>
              <li>Anyone in the club can join before Round 1 begins.</li>
            </ul>
          </Section>

          {/* ─── Round Flow ─── */}
          <Section title="A Round in 3 Phases" kicker="03">
            <PhaseCard
              icon={<PenLine className="w-4 h-4" />}
              tint="warning"
              step="Phase 1"
              title="Shift — write your answer"
            >
              Answer the prompt anonymously. Then choose a <b>Signal</b> for how you want to be
              read. Answers stay hidden until every player submits (or the timer runs out).
            </PhaseCard>

            <PhaseCard
              icon={<Eye className="w-4 h-4" />}
              tint="live"
              step="Phase 2"
              title="Read — guess the authors"
            >
              All answers appear in a shuffled list, no names attached. Match each answer to the
              player you think wrote it. Pick <b>one Strong Read</b> — the answer you're most
              confident about — for bonus points if you nail it.
            </PhaseCard>

            <PhaseCard
              icon={<Trophy className="w-4 h-4" />}
              tint="success"
              step="Phase 3"
              title="Reveal — score & react"
            >
              Authors are revealed, points are awarded, and everyone sees who fooled who. Then the
              next round begins.
            </PhaseCard>
          </Section>

          {/* ─── Signals ─── */}
          <Section title="Signals — how you want to be read" kicker="04">
            <p className="text-muted-foreground">
              Every answer you submit rides on a Signal. Your Signal decides how <i>your</i> answer
              scores when others guess (or fail to guess) it.
            </p>
            <SignalCard
              icon={<Sparkles className="w-4 h-4" />}
              name="TELL"
              tagline="Be recognized."
            >
              Score for every reader who correctly identifies you. Bonus if a strict majority nails
              it. Play TELL when your voice is unmistakable and you want the credit.
            </SignalCard>
            <SignalCard
              icon={<EyeOff className="w-4 h-4" />}
              name="BLUR"
              tagline="Vanish in the crowd."
            >
              Score for every reader who guesses wrong. Bonus if <b>nobody</b> finds you, plus a
              diversity bonus when readers scatter their guesses across 3+ different players.
            </SignalCard>
            <SignalCard
              icon={<Target className="w-4 h-4" />}
              name="FRAME"
              tagline="Point the finger."
            >
              Pick a target player. Score for every reader who guesses that target instead of you.
              Big bonus if the target ends up tied for the most guesses. Small consolation if
              nobody guesses you either.
            </SignalCard>
          </Section>

          {/* ─── Scoring ─── */}
          <Section title="Scoring Cheat Sheet" kicker="05">
            <div className="glass-card p-3 space-y-2">
              <ScoreRow label="Correct author guess" value="+1 each" />
              <ScoreRow label="Strong Read correct" value="+2 bonus" />
              <ScoreRow label="Perfect Read (all correct)" value="+3 bonus" />
              <div className="h-px bg-border/60 my-1" />
              <ScoreRow label="TELL — per correct reader" value="+1" />
              <ScoreRow label="TELL — majority read you" value="+2 bonus" />
              <ScoreRow label="BLUR — per wrong reader" value="+1" />
              <ScoreRow label="BLUR — nobody found you" value="+2 bonus" />
              <ScoreRow label="BLUR — 3+ distinct guesses" value="+1 bonus" />
              <ScoreRow label="FRAME — per guess on target" value="+2" />
              <ScoreRow label="FRAME — target tied for most" value="+3 bonus" />
              <ScoreRow label="FRAME — you stayed hidden" value="+1 bonus" />
            </div>
            <p className="text-[11px] text-muted-foreground/70 pt-1">
              Signal points are capped at 10 per round, per answer — big rooms can't runaway‑inflate
              scores.
            </p>
          </Section>

          {/* ─── Winning ─── */}
          <Section title="Winning the Game" kicker="06" icon={<Trophy className="w-4 h-4" />}>
            <p>
              After the final round, points are totaled across every round. Highest score wins the
              game, and per‑round <b>awards</b> (sharpest reader, best disguise, cleanest frame,
              etc.) are handed out for bragging rights.
            </p>
          </Section>

          {/* ─── Tips ─── */}
          <Section title="Tactics" kicker="07">
            <ul className="space-y-1.5 list-disc pl-4">
              <li>Vary your Signal round to round — predictability is expensive.</li>
              <li>BLUR loves generic answers. TELL rewards a distinct voice.</li>
              <li>Save your Strong Read for the answer you're <i>most</i> sure about.</li>
              <li>FRAME works best on players who wrote something adjacent to your target's style.</li>
              <li>You never score off your own answer, and you never guess yourself.</li>
            </ul>
          </Section>

          <p className="text-center text-[11px] text-muted-foreground/60 pt-2 pb-1">
            Good luck, reader.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Building blocks ─────────────────────────────────────────────

function Section({
  title,
  kicker,
  icon,
  children,
}: {
  title: string;
  kicker: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black tracking-[0.2em] text-primary/70">{kicker}</span>
        <div className="h-px flex-1 bg-border/60" />
        {icon && <span className="text-muted-foreground/70">{icon}</span>}
      </div>
      <h3 className="text-[15px] font-black tracking-tight">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function PhaseCard({
  icon,
  step,
  title,
  tint,
  children,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  tint: 'warning' | 'live' | 'success';
  children: React.ReactNode;
}) {
  const color =
    tint === 'warning'
      ? 'hsl(38 92% 55%)'
      : tint === 'live'
        ? 'hsl(var(--primary))'
        : 'hsl(142 71% 45%)';
  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${color} / 0.15`, backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">
            {step}
          </div>
          <div className="text-[13px] font-bold">{title}</div>
        </div>
      </div>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}

function SignalCard({
  icon,
  name,
  tagline,
  children,
}: {
  icon: React.ReactNode;
  name: string;
  tagline: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-primary">{icon}</span>
        <span className="font-black tracking-wider text-[13px]">{name}</span>
        <span className="text-[11px] italic text-muted-foreground/80">— {tagline}</span>
      </div>
      <p className="text-muted-foreground text-[12.5px]">{children}</p>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12.5px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-black tabular-nums" style={{ color: 'hsl(var(--primary))' }}>
        {value}
      </span>
    </div>
  );
}
