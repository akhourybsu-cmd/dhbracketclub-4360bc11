// READSHIFT — Shift phase: read the prompt + your private Signal, write an
// answer. Answers are hidden from everyone until the phase locks; editable
// until then. Never shows who submitted (only a count).
import { useEffect, useState } from 'react';
import { Clock, Check, Send, Target, Users, Loader2 } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { SignalExplainer } from './SignalBadge';
import * as api from '@/lib/readshift/api';
import { ANSWER_MAX_CHARS } from '@/lib/readshift/constants';
import { CumulativeStandings } from './CumulativeStandings';
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
  const [saving, setSaving] = useState(false);
  useEffect(() => { setBody(myAnswer?.body ?? ''); }, [myAnswer?.id]);

  const locked = myAnswer?.locked || round.phase !== 'shift';
  const deadline = round.shift_deadline ? new Date(round.shift_deadline) : null;
  const targetName = assignment?.frame_target_user_id
    ? participants.find((p) => p.user_id === assignment.frame_target_user_id)?.profiles?.display_name ?? 'your target'
    : null;

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await api.saveAnswer(round.id, clubId, userId, body);
      toast.success('Answer saved');
      onSaved();
      // If early_advance is on and this was the last player to submit,
      // ask the server to advance the phase immediately.
      if (game.early_advance) void api.pokeAdvance(game.id);
    } catch (e: any) {
      toast.error(e?.message || 'Could not save');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <CumulativeStandings game={game} participants={participants} refreshKey={round.id} variant="compact" />
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/60">Round {round.round_number} · Prompt</span>
          {deadline && (
            <span className="text-[11px] font-semibold text-muted-foreground/70 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {deadline.getTime() > Date.now() ? `${formatDistanceToNowStrict(deadline)} left` : 'Locking…'}
            </span>
          )}
        </div>
        <p className="text-[17px] font-extrabold leading-snug">{round.prompt_snapshot || 'Prompt loading…'}</p>
      </div>

      {assignment && <SignalExplainer signal={assignment.signal} />}

      {assignment?.signal === 'FRAME' && targetName && (
        <div className="glass-card p-3.5 flex items-center gap-2.5" style={{ background: 'hsl(315 80% 64% / 0.1)', border: '1px solid hsl(315 80% 64% / 0.28)' }}>
          <Target className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(315 80% 66%)' }} />
          <p className="text-[12.5px]"><span className="text-muted-foreground/70">Sound like</span> <strong>{targetName}</strong></p>
        </div>
      )}

      {myAnswer && !locked ? (
        <div
          className="glass-card p-4 relative overflow-hidden"
          style={{ background: 'hsl(142 70% 45% / 0.08)', border: '1.5px solid hsl(142 70% 45% / 0.45)' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] flex items-center gap-1.5" style={{ color: 'hsl(142 70% 55%)' }}>
              <Check className="w-3.5 h-3.5" /> Answer Locked In
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground/70">Editable until phase ends</span>
          </div>
          <p className="text-[15px] font-semibold leading-snug mb-3 italic">"{body}"</p>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, ANSWER_MAX_CHARS))}
            placeholder="Edit your answer…"
            rows={2}
            className="form-input resize-none text-[13px]"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">{body.length}/{ANSWER_MAX_CHARS}</span>
          </div>
          <button
            onClick={save}
            disabled={saving || !body.trim() || body === myAnswer.body}
            className="rs-cta w-full h-11 rounded-xl btn-press mt-2 disabled:opacity-40"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {body === myAnswer.body ? 'No Changes' : 'Update Answer'}
          </button>
        </div>
      ) : locked ? (
        <div
          className="glass-card p-4"
          style={{ background: 'hsl(var(--muted) / 0.3)', border: '1.5px solid hsl(var(--border))' }}
        >
          <div className="flex items-center gap-1.5 mb-2">
            <Check className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Locked</span>
          </div>
          {body ? (
            <p className="text-[15px] font-semibold leading-snug italic">"{body}"</p>
          ) : (
            <p className="text-[13px] text-muted-foreground">No answer submitted.</p>
          )}
        </div>
      ) : (
        <div className="glass-card p-4">
          <label className="form-label">Your answer</label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, ANSWER_MAX_CHARS))}
            placeholder="Keep it plausible…"
            rows={3}
            className="form-input resize-none"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground/60 tabular-nums">{body.length}/{ANSWER_MAX_CHARS}</span>
          </div>
          <button onClick={save} disabled={saving || !body.trim()}
            className="rs-cta w-full h-11 rounded-xl btn-press mt-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Answer
          </button>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground/60 flex items-center justify-center gap-1.5">
        <Users className="w-3 h-3" /> {progress.submitted} of {progress.total} players have responded
      </p>
    </div>
  );
}
