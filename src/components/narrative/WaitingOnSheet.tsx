// DH Club — Narrative RPG · "Waiting on" pin sheet
//
// Small bottom sheet the GM opens to set or clear the persistent
// waiting_on_state on the campaign. Replaces the prior implicit
// heuristic (last-message-timestamp) with explicit GM intent that
// survives refresh / devices / users.
//
// Three modes:
//   • All players  — every active player is being waited on
//   • Specific     — pick which players (multi-select from members)
//   • Clear        — no one is being waited on; falls back to heuristic
//
// Optional toggle: required vs optional response. Players can see this
// reflected in the campaign status pill.
//
// Persists via useNarrativeCampaign.setWaitingOn → narrative_campaigns
// .waiting_on_state jsonb column. Realtime UPDATE subscription on the
// campaign row propagates to every viewer immediately.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, Users as UsersIcon, UserCheck, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { FLAMINGO } from '@/lib/narrative/flamingoTheme';
import { SPRING_SOFT, TAP_PRESS, haptic } from '@/lib/narrative/motion';
import type { Campaign, CampaignMember } from '@/lib/narrative/types';

interface Props {
  open: boolean;
  onClose: () => void;
  campaign: Campaign;
  members: CampaignMember[];
  /** When true, applies the Flamingo theme to the sheet. */
  flamingo: boolean;
  /** Mutator from useNarrativeCampaign. */
  onSet: (next: { mode: 'all' | 'specific' | null; player_ids?: string[]; required?: boolean }) => Promise<boolean>;
}

type LocalMode = 'all' | 'specific' | 'clear';

export function WaitingOnSheet({ open, onClose, campaign, members, flamingo, onSet }: Props) {
  const wait = campaign.waiting_on_state ?? {};
  // Seed local state from the persisted pin so reopening the sheet
  // shows the GM their current configuration.
  const [mode, setMode] = useState<LocalMode>(
    wait.mode === 'all' ? 'all' : wait.mode === 'specific' ? 'specific' : 'clear',
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(Array.isArray(wait.player_ids) ? wait.player_ids : []),
  );
  const [required, setRequired] = useState<boolean>(wait.required !== false);
  const [busy, setBusy] = useState(false);

  // Re-seed when the sheet opens (in case persisted state changed via
  // realtime while the sheet was closed).
  useEffect(() => {
    if (!open) return;
    setMode(wait.mode === 'all' ? 'all' : wait.mode === 'specific' ? 'specific' : 'clear');
    setSelected(new Set(Array.isArray(wait.player_ids) ? wait.player_ids : []));
    setRequired(wait.required !== false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Only active player members are pickable. Spectators and removed
  // members aren't valid "waiting on" targets — they don't post.
  const playerMembers = members.filter(m => m.status === 'active' && m.role === 'player');

  const apply = async () => {
    setBusy(true);
    haptic('light');
    try {
      const next = mode === 'clear'
        ? { mode: null as null }
        : mode === 'all'
          ? { mode: 'all' as const, required }
          : { mode: 'specific' as const, player_ids: Array.from(selected), required };
      const ok = await onSet(next);
      if (!ok) {
        toast.error('Could not save waiting-on pin.');
        return;
      }
      if (mode === 'clear') {
        toast.success('No one is being waited on.');
      } else if (mode === 'all') {
        toast.success('Waiting on all players.');
      } else {
        const n = selected.size;
        toast.success(`Waiting on ${n} player${n === 1 ? '' : 's'}.`);
      }
      onClose();
    } catch (e) {
      toast.error(`Couldn't save pin: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  // Sheet styling helpers
  const accent = flamingo ? FLAMINGO.gold : 'var(--gold)';
  const onIc = (m: LocalMode) => mode === m;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-[80] flex items-end justify-center"
          style={{
            background: flamingo ? `hsl(${FLAMINGO.midnight} / 0.7)` : 'hsl(218 50% 3% / 0.6)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%', transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
            transition={SPRING_SOFT}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md max-h-[88dvh] rounded-t-2xl flex flex-col overflow-hidden"
            style={{
              paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
              background: flamingo
                ? `linear-gradient(180deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`
                : 'hsl(var(--card))',
              border: flamingo ? `1px solid hsl(${FLAMINGO.gold} / 0.4)` : '1px solid hsl(var(--border) / 0.4)',
              color: flamingo ? `hsl(${FLAMINGO.paper})` : undefined,
            }}
          >
            <div aria-hidden className="flex items-center justify-center pt-2 pb-1">
              <div className="w-10 h-1 rounded-full" style={{ background: flamingo ? `hsl(${FLAMINGO.paper} / 0.25)` : 'hsl(var(--border))' }} />
            </div>

            <div className="px-4 pt-1 pb-3 flex items-start gap-2">
              <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: `hsl(${accent})` }} />
              <div className="min-w-0 flex-1">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.22em]"
                  style={{ color: `hsl(${accent})` }}
                >
                  Waiting on
                </p>
                <h2
                  className="font-display text-[17px] sm:text-[19px] font-extrabold tracking-tight leading-tight mt-0.5"
                  style={flamingo ? {
                    backgroundImage: `linear-gradient(90deg, hsl(${FLAMINGO.paper}), hsl(${FLAMINGO.gold}))`,
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                  } : undefined}
                >
                  Pin who you're waiting on
                </h2>
                <p
                  className="text-[11px] leading-snug mt-1"
                  style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.7)` : 'hsl(var(--muted-foreground) / 0.8)' }}
                >
                  Surfaces as a campaign status. Survives refresh and shows on every device.
                </p>
              </div>
              <motion.button
                whileTap={TAP_PRESS}
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                style={flamingo ? {
                  background: `hsl(${FLAMINGO.ink})`,
                  border: `1px solid hsl(${FLAMINGO.gold} / 0.4)`,
                  color: `hsl(${FLAMINGO.paper})`,
                } : {
                  background: 'hsl(var(--muted) / 0.4)',
                  border: '1px solid hsl(var(--border) / 0.4)',
                }}
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Mode picker */}
            <div className="px-3 space-y-1.5">
              <ModeButton
                flamingo={flamingo}
                accent={accent}
                selected={onIc('all')}
                onClick={() => setMode('all')}
                icon={<UsersIcon className="w-4 h-4" />}
                label="All players"
                blurb="Every active player. Use after a wide-open scene beat."
              />
              <ModeButton
                flamingo={flamingo}
                accent={accent}
                selected={onIc('specific')}
                onClick={() => setMode('specific')}
                icon={<UserCheck className="w-4 h-4" />}
                label="Specific players"
                blurb="Pick which players. The others can keep scrolling."
              />
              <ModeButton
                flamingo={flamingo}
                accent={accent}
                selected={onIc('clear')}
                onClick={() => setMode('clear')}
                icon={<X className="w-4 h-4" />}
                label="Clear"
                blurb="No one is being waited on. Falls back to activity heuristic."
              />
            </div>

            {/* Player picker (only when mode='specific') */}
            {mode === 'specific' && (
              <div className="px-4 pt-3 pb-1">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.22em] mb-2"
                  style={{ color: flamingo ? `hsl(${FLAMINGO.cyan})` : 'hsl(var(--muted-foreground) / 0.7)' }}
                >
                  Pick players ({selected.size} / {playerMembers.length})
                </p>
                {playerMembers.length === 0 ? (
                  <p className="text-[11.5px] italic" style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.6)` : 'hsl(var(--muted-foreground) / 0.7)' }}>
                    No active players yet — invite someone first.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {playerMembers.map(m => {
                      const checked = selected.has(m.user_id);
                      return (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => setSelected(prev => {
                            const next = new Set(prev);
                            if (next.has(m.user_id)) next.delete(m.user_id);
                            else next.add(m.user_id);
                            return next;
                          })}
                          className="w-full text-left rounded-lg p-2.5 flex items-center gap-2.5"
                          style={checked
                            ? flamingo
                              ? { background: `hsl(${FLAMINGO.gold} / 0.15)`, border: `1px solid hsl(${FLAMINGO.gold} / 0.55)` }
                              : { background: 'hsl(var(--primary) / 0.12)', border: '1px solid hsl(var(--primary) / 0.4)' }
                            : flamingo
                              ? { background: `hsl(${FLAMINGO.ink} / 0.6)`, border: `1px solid hsl(${FLAMINGO.paper} / 0.12)` }
                              : { background: 'hsl(var(--muted) / 0.25)', border: '1px solid hsl(var(--border) / 0.4)' }}
                        >
                          <div
                            className="w-5 h-5 rounded flex items-center justify-center border flex-shrink-0"
                            style={checked
                              ? { background: `hsl(${accent})`, borderColor: `hsl(${accent})`, color: flamingo ? `hsl(${FLAMINGO.midnight})` : 'hsl(var(--primary-foreground))' }
                              : { background: 'transparent', borderColor: flamingo ? `hsl(${FLAMINGO.paper} / 0.3)` : 'hsl(var(--border))' }}
                          >
                            {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                          </div>
                          <span className="text-[12.5px] font-extrabold truncate">{m.user_id.slice(0, 8)}…</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Optional / required toggle */}
            {mode !== 'clear' && (
              <div className="px-4 pt-3">
                <button
                  type="button"
                  onClick={() => setRequired(v => !v)}
                  className="w-full rounded-lg p-2.5 flex items-center gap-2.5"
                  style={{
                    background: flamingo ? `hsl(${FLAMINGO.ink} / 0.6)` : 'hsl(var(--muted) / 0.25)',
                    border: flamingo ? `1px solid hsl(${FLAMINGO.paper} / 0.12)` : '1px solid hsl(var(--border) / 0.4)',
                  }}
                >
                  <div
                    className="w-5 h-5 rounded flex items-center justify-center border flex-shrink-0"
                    style={required
                      ? { background: `hsl(${accent})`, borderColor: `hsl(${accent})`, color: flamingo ? `hsl(${FLAMINGO.midnight})` : 'hsl(var(--primary-foreground))' }
                      : { background: 'transparent', borderColor: flamingo ? `hsl(${FLAMINGO.paper} / 0.3)` : 'hsl(var(--border))' }}
                  >
                    {required && <Check className="w-3 h-3" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[12px] font-extrabold">Response required</p>
                    <p
                      className="text-[10.5px] leading-snug mt-0.5"
                      style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.6)` : 'hsl(var(--muted-foreground) / 0.75)' }}
                    >
                      Optional waits show as a softer pill; required waits show full pulse.
                    </p>
                  </div>
                </button>
              </div>
            )}

            {/* Apply */}
            <div
              className="px-4 pt-3 mt-2 border-t flex-shrink-0"
              style={{ borderColor: flamingo ? `hsl(${FLAMINGO.paper} / 0.12)` : 'hsl(var(--border) / 0.4)' }}
            >
              <motion.button
                type="button"
                whileTap={TAP_PRESS}
                onClick={apply}
                disabled={busy || (mode === 'specific' && selected.size === 0)}
                className="w-full h-11 rounded-xl text-[12.5px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-50"
                style={flamingo ? {
                  background: `linear-gradient(135deg, hsl(${FLAMINGO.gold}), hsl(${FLAMINGO.pink}))`,
                  color: `hsl(${FLAMINGO.midnight})`,
                  boxShadow: `0 0 14px -3px hsl(${accent} / 0.55)`,
                  border: `1px solid hsl(${accent})`,
                } : {
                  background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
                  color: 'hsl(var(--primary-foreground))',
                }}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {mode === 'clear' ? 'Clear pin' : 'Apply'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function ModeButton({
  flamingo, accent, selected, onClick, icon, label, blurb,
}: {
  flamingo: boolean;
  accent: string;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  blurb: string;
}) {
  return (
    <motion.button
      type="button"
      whileTap={TAP_PRESS}
      onClick={onClick}
      className="w-full text-left rounded-xl p-3 flex items-start gap-3 transition"
      style={selected
        ? flamingo
          ? {
              background: `linear-gradient(135deg, hsl(${FLAMINGO.gold} / 0.18), hsl(${FLAMINGO.pink} / 0.1))`,
              border: `1px solid hsl(${accent} / 0.55)`,
              color: `hsl(${FLAMINGO.paper})`,
            }
          : {
              background: 'hsl(var(--primary) / 0.12)',
              border: '1px solid hsl(var(--primary) / 0.4)',
            }
        : flamingo
          ? {
              background: `hsl(${FLAMINGO.ink} / 0.7)`,
              border: `1px solid hsl(${FLAMINGO.paper} / 0.12)`,
              color: `hsl(${FLAMINGO.paper} / 0.85)`,
            }
          : {
              background: 'hsl(var(--muted) / 0.25)',
              border: '1px solid hsl(var(--border) / 0.4)',
            }}
    >
      <span className="flex-shrink-0 mt-0.5" style={{
        color: selected
          ? `hsl(${accent})`
          : flamingo ? `hsl(${FLAMINGO.paper} / 0.6)` : 'hsl(var(--muted-foreground) / 0.7)',
      }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-extrabold tracking-tight">{label}</p>
        <p
          className="text-[11px] leading-snug mt-0.5"
          style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.62)` : 'hsl(var(--muted-foreground) / 0.78)' }}
        >
          {blurb}
        </p>
      </div>
      {selected && <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: `hsl(${accent})` }} strokeWidth={3} />}
    </motion.button>
  );
}
