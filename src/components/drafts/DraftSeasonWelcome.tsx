import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, Gavel, ScrollText, ShieldCheck, ChevronDown, X, MessageSquareQuote, ListChecks, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DraftSeason } from '@/hooks/useDraftSeasons';
import type { DraftSeasonIntro } from '@/hooks/useDraftSeasonIntro';
import { getSeasonDisplayName } from '@/lib/seasonUtils';

interface Props {
  open: boolean;
  season: DraftSeason;
  intro: DraftSeasonIntro;
  /** Show "New Season" pill + primary CTA (auto-shown variant). False for the manual "Season Info" reopen. */
  isFirstView?: boolean;
  onAcknowledge: () => void | Promise<void>;
  onClose: () => void;
}

interface Section {
  key: string;
  title: string;
  icon: React.ElementType;
  items: string[];
}

export function DraftSeasonWelcome({ open, season, intro, isFirstView = false, onAcknowledge, onClose }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>('changes');

  const sections: Section[] = useMemo(() => [
    { key: 'changes', title: "What's New", icon: Sparkles, items: intro.changes },
    { key: 'format', title: 'How This Season Works', icon: ListChecks, items: intro.season_format },
    { key: 'ai', title: 'AI Judging Updates', icon: ShieldCheck, items: intro.ai_judging_notes },
    { key: 'disputes', title: 'Disputes & Commissioner Review', icon: Gavel, items: intro.dispute_notes },
    { key: 'scoring', title: 'Scoring Reminders', icon: Trophy, items: intro.scoring_notes },
    { key: 'dates', title: 'Important Dates', icon: Calendar, items: intro.important_dates },
  ].filter(s => s.items && s.items.length > 0), [intro]);

  const handleEnter = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onAcknowledge();
      onClose();
    } catch (e) {
      console.error('Failed to acknowledge season welcome', e);
    } finally {
      setSubmitting(false);
    }
  };

  const seasonTitle = season.name || getSeasonDisplayName(season.season_label, season.year);

  const node = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="season-welcome"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="da-mode fixed inset-0 z-[110] overflow-y-auto"
          style={{
            background: 'hsl(var(--background))',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 7rem)',
          }}
        >
          {/* Close (always available — secondary CTA "Review later") */}
          <button
            onClick={onClose}
            aria-label="Close season welcome"
            className="absolute top-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center bg-card/60 border border-border backdrop-blur btn-press z-10"
            style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="max-w-[640px] mx-auto px-4 sm:px-6 pt-10">
            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-3xl overflow-hidden p-6 sm:p-8 mb-6"
              style={{
                background:
                  'linear-gradient(135deg, hsl(var(--gold) / 0.18), hsl(var(--primary) / 0.10) 60%, transparent)',
                border: '1px solid hsl(var(--gold) / 0.35)',
                boxShadow: '0 20px 60px -20px hsl(var(--gold) / 0.35)',
              }}
            >
              {/* Shimmer flare */}
              <motion.div
                aria-hidden
                className="absolute -top-20 -right-20 w-64 h-64 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(closest-side, hsl(var(--gold) / 0.35), transparent)' }}
                animate={{ opacity: [0.6, 0.9, 0.6], scale: [1, 1.08, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              />

              {isFirstView && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] mb-3"
                  style={{
                    background: 'hsl(var(--gold) / 0.18)',
                    border: '1px solid hsl(var(--gold) / 0.45)',
                    color: 'hsl(var(--gold))',
                  }}
                >
                  <Sparkles className="w-3 h-3" /> New Season
                </motion.div>
              )}

              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.05]">
                Welcome to {seasonTitle}
              </h1>
              {intro.season_subtitle && (
                <p className="mt-2 text-[15px] sm:text-base text-foreground/70 font-medium leading-snug">
                  {intro.season_subtitle}
                </p>
              )}
              {intro.hero_summary && (
                <p className="mt-4 text-[14px] text-foreground/80 leading-relaxed">
                  {intro.hero_summary}
                </p>
              )}
            </motion.div>

            {/* Commissioner message */}
            {intro.commissioner_message && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="rounded-2xl border border-border bg-card p-4 mb-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MessageSquareQuote className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    Commissioner Message
                  </p>
                </div>
                <p className="text-[14px] text-foreground/85 leading-relaxed italic">
                  "{intro.commissioner_message}"
                </p>
              </motion.div>
            )}

            {/* Section cards (collapsible) */}
            <div className="space-y-2.5">
              {sections.map((s, idx) => {
                const isOpen = expanded === s.key;
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.key}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + idx * 0.05, duration: 0.35 }}
                    className="rounded-2xl border border-border bg-card overflow-hidden"
                  >
                    <button
                      onClick={() => setExpanded(isOpen ? null : s.key)}
                      className="w-full flex items-center gap-3 p-4 btn-press text-left min-h-[56px]"
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold leading-tight">{s.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {s.items.length} {s.items.length === 1 ? 'item' : 'items'}
                        </p>
                      </div>
                      <ChevronDown
                        className={cn(
                          'w-5 h-5 text-muted-foreground transition-transform duration-200',
                          isOpen && 'rotate-180'
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <ul className="px-4 pb-4 pt-1 space-y-2">
                            {s.items.map((item, i) => (
                              <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-foreground/85">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-6 text-center">
              <ScrollText className="w-4 h-4 inline-block text-muted-foreground mr-1.5 -mt-0.5" />
              <span className="text-[11px] text-muted-foreground">
                You can revisit this overview anytime from Draft Arena → Season Info.
              </span>
            </div>
          </div>

          {/* Sticky CTA bar */}
          <div
            className="fixed bottom-0 inset-x-0 z-[120] border-t border-border bg-background/95 backdrop-blur-xl px-4 py-3"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="max-w-[640px] mx-auto flex gap-2">
              {isFirstView && (
                <Button
                  variant="ghost"
                  onClick={onClose}
                  className="h-12 px-4 text-[13px] font-bold"
                >
                  Review later
                </Button>
              )}
              <Button
                onClick={handleEnter}
                disabled={submitting}
                className="flex-1 h-12 text-[14px] font-black uppercase tracking-[0.12em]"
                style={{
                  background: 'linear-gradient(135deg, hsl(var(--gold)), hsl(var(--gold) / 0.85))',
                  color: 'hsl(var(--background))',
                  boxShadow: '0 10px 30px -10px hsl(var(--gold) / 0.55)',
                }}
              >
                {submitting ? 'Saving…' : (isFirstView ? intro.call_to_action_label : 'Got it')}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}
