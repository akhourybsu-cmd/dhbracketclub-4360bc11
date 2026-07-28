// READSHIFT — Shift phase (premium redesign).
// Prompt promoted to a serif "hero" card. Locked state is loud + editable.
// Composer feels tactile with clear character budget and single premium CTA.
import { useEffect, useState } from 'react';
import { Clock, Check, Send, Target, Users, Loader2, Pencil, Sparkles } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { SignalExplainer } from './SignalBadge';
import * as api from '@/lib/readshift/api';
import { ANSWER_MAX_CHARS } from '@/lib/readshift/constants';
import { CumulativeStandings } from './CumulativeStandings';
import { cn } from '@/lib/utils';
import type { RsGame, RsRound, RsSignalAssignment, RsAnswer, RsParticipant } from '@/lib/readshift/dbTypes';

interface Props {
  game: RsGame;
  round: RsRound;
  assignment: RsSignalAssignment | null;
  myAnswer: RsAnswer | null;
  participants: RsParticipant[];
  progress: { submitted: number; total: number };
  userId: string;
  clubId: string;
  onSaved: () => void;
}

export function ShiftPhase({ game, round, assignment, myAnswer, participants, progress, userId, clubId, onSaved }: Props) {
  const [body, setBody] = useState(myAnswer?.body ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setBody(myAnswer?.body ?? ''); setEditing(false); }, [myAnswer?.id]);

  const locked = myAnswer?.locked || round.phase !== 'shift';
  const hasSubmitted = !!myAnswer;
  const deadline = round.shift_deadline ? new Date(round.shift_deadline) : null;
  const targetName = assignment?.frame_target_user_id
    ? participants.find((p) => p.user_id === assignment.frame_target_user_id)?.profiles?.display_name ?? 'your target'
    : null;

  const nearLimit = body.length > ANSWER_MAX_CHARS * 0.85;

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await api.saveAnswer(round.id, clubId, userId, body);
      toast.success(hasSubmitted ? 'Answer updated' : 'Answer locked in');
      setEditing(false);
      onSaved();
      if (game.early_advance) void api.pokeAdvance(game.id);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <CumulativeStandings game={game} participants={participants} refreshKey={round.id} variant="compact" />

      {/* Prompt hero */}
      <div className="rs-prompt-hero">
        <div className="flex items-center justify-between gap-3 relative">
          <span className="rs-prompt-eyebrow">
            <Sparkles className="w-3 h-3" /> Round {round.round_number} · Prompt
          </span>
          {deadline && (
            <span className="text-[10.5px] font-bold text-muted-foreground/75 flex items-center gap-1 tabular-nums">
              <Clock className="w-3 h-3" />
              {deadline.getTime() > Date.now() ? `${formatDistanceToNowStrict(deadline)} left` : 'Locking…'}
            </span>
          )}
        </div>
        <p className="rs-prompt-body">{round.prompt_snapshot || 'Prompt loading…'}</p>
      </div>

      {assignment && <SignalExplainer signal={assignment.signal} />}

      {assignment?.signal === 'FRAME' && targetName && (
        <div className="glass-card p-3.5 flex items-center gap-2.5" style={{ background: 'hsl(315 80% 64% / 0.1)', border: '1px solid hsl(315 80% 64% / 0.28)' }}>
          <Target className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(315 80% 66%)' }} />
          <p className="text-[12.5px]"><span className="text-muted-foreground/75">Sound like</span> <strong className="text-foreground/95">{targetName}</strong></p>
        </div>
      )}

      {/* Submitted + not editing: loud confirmation card */}
      {hasSubmitted && !editing && !locked && (
        <div
          className="glass-card p-4"
          style={{ background: 'linear-gradient(180deg, hsl(152 66% 30% / 0.14), hsl(152 66% 20% / 0.08))', border: '1.5px solid hsl(152 66% 54% / 0.5)' }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="rs-pill" style={{ background: 'hsl(152 66% 40% / 0.22)', borderColor: 'hsl(152 66% 54% / 0.45)', color: 'hsl(152 72% 76%)' }}>
              <Check className="w-3 h-3" strokeWidth={3} /> Locked In
            </span>
            <span className="text-[10px] font-bold text-muted-foreground/70">Editable until phase ends</span>
          </div>
          <blockquote className="text-[15.5px] font-semibold leading-snug italic text-foreground/95 border-l-2 pl-3 py-0.5"
            style={{ borderColor: 'hsl(152 66% 54% / 0.55)' }}>
            "{myAnswer.body}"
          </blockquote>
          <button
            onClick={() => setEditing(true)}
            className="mt-3.5 w-full h-11 rounded-xl inline-flex items-center justify-center gap-2 font-extrabold text-[13px] btn-press border transition-colors"
            style={{ background: 'hsl(268 34% 15% / 0.7)', borderColor: 'hsl(278 42% 42% / 0.4)', color: 'hsl(285 90% 80%)' }}
          >
            <Pencil className="w-3.5 h-3.5" /> Edit answer
          </button>
        </div>
      )}

      {/* Locked (phase advanced): read-only summary */}
      {locked && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Check className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Phase locked</span>
          </div>
          {body ? (
            <blockquote className="text-[15px] font-semibold leading-snug italic border-l-2 pl-3" style={{ borderColor: 'hsl(var(--border))' }}>"{body}"</blockquote>
          ) : (
            <p className="text-[13px] text-muted-foreground">No answer submitted this round.</p>
          )}
        </div>
      )}

      {/* Composer — first-write OR editing an existing answer */}
      {!locked && (!hasSubmitted || editing) && (
        <div className="glass-card p-4">
          <label className="rs-eyebrow mb-3">Your answer</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, ANSWER_MAX_CHARS))}
            placeholder="Keep it plausible…"
            rows={4}
            className="form-input resize-none text-[14.5px] leading-snug"
            autoFocus={editing}
          />
          <div className="flex items-center justify-between mt-2 mb-3">
            <span className={cn(
              'text-[10.5px] font-bold tabular-nums',
              nearLimit ? 'text-[hsl(45_96%_65%)]' : 'text-muted-foreground/60'
            )}>
              {body.length}/{ANSWER_MAX_CHARS}
            </span>
            {editing && hasSubmitted && (
              <button
                onClick={() => { setBody(myAnswer.body); setEditing(false); }}
                className="text-[11px] font-bold text-muted-foreground/70 hover:text-foreground/90 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
          <button
            onClick={save}
            disabled={saving || !body.trim() || (hasSubmitted && body === myAnswer.body)}
            className="rs-cta w-full h-12 rounded-xl btn-press disabled:opacity-45"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : hasSubmitted
                ? <><Send className="w-4 h-4" /> Update answer</>
                : <><Send className="w-4 h-4" /> Lock it in</>}
          </button>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/65 flex items-center justify-center gap-1.5">
        <Users className="w-3 h-3" /> {progress.submitted} of {progress.total} players responded
      </p>
    </div>
  );
}
