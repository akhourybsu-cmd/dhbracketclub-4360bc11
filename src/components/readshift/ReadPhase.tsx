// READSHIFT — Read phase (premium redesign).
// Each anonymous answer gets a numbered card. Author attribution uses a
// tactile button grid instead of a native <select>, so picks feel deliberate
// and every tap has real feedback. Reader's own answer is shown but not
// guessable (self-guesses never score). One Strong Read across the round.
import { useMemo, useState } from 'react';
import { Clock, Star, Users, Check, Sparkles } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as api from '@/lib/readshift/api';
import { CumulativeStandings } from './CumulativeStandings';
import type { RsGame, RsRound, RsReadCard, RsGuess, RsParticipant, RsAnswer } from '@/lib/readshift/dbTypes';

interface Props {
  game: RsGame;
  round: RsRound;
  readCards: RsReadCard[];
  authorPool: string[];
  myGuesses: RsGuess[];
  myAnswer: RsAnswer | null;
  participants: RsParticipant[];
  progress: { submitted: number; total: number };
  userId: string;
  clubId: string;
  onSaved: () => void;
}

function initialsOf(name: string) {
  return name.split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export function ReadPhase({ game, round, readCards, authorPool, myGuesses, myAnswer, participants, progress, userId, clubId, onSaved }: Props) {
  const nameOf = (uid: string) => participants.find((p) => p.user_id === uid)?.profiles?.display_name || 'Player';
  const cards = useMemo(() => [...readCards].sort((a, b) => a.answer_id.localeCompare(b.answer_id)), [readCards]);
  const pool = useMemo(
    () => authorPool.map((uid) => ({ uid, name: nameOf(uid) })).sort((a, b) => a.name.localeCompare(b.name)),
    [authorPool, participants],
  );
  const [guessBy, setGuessBy] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const g of myGuesses) if (g.guessed_user_id) m[g.answer_id] = g.guessed_user_id;
    return m;
  });
  const [strong, setStrong] = useState<string | null>(() => myGuesses.find((g) => g.is_strong_read)?.answer_id ?? null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const locked = round.phase !== 'read';
  const deadline = round.read_deadline ? new Date(round.read_deadline) : null;

  const guessable = cards.filter((c) => c.answer_id !== myAnswer?.id);
  const answered = guessable.filter((c) => guessBy[c.answer_id]).length;
  const allDone = answered === guessable.length && guessable.length > 0;

  const pick = async (answerId: string, guessed: string) => {
    // Toggle behavior — tapping the currently selected author clears the pick.
    const nextGuess = guessBy[answerId] === guessed ? '' : guessed;
    const nextMap = { ...guessBy, [answerId]: nextGuess };
    if (!nextGuess) delete nextMap[answerId];
    setGuessBy(nextMap);
    if (!nextGuess) return;
    setSavingId(answerId);
    try {
      await api.saveGuess(round.id, clubId, userId, answerId, nextGuess);
      if (game.early_advance) {
        const done = guessable.every((c) => nextMap[c.answer_id]);
        if (done) void api.pokeAdvance(game.id);
      }
    } catch { toast.error('Could not save guess'); }
    finally { setSavingId(null); }
  };
  const markStrong = async (answerId: string) => {
    const next = strong === answerId ? null : answerId;
    setStrong(next);
    if (next) {
      try { await api.setStrongRead(round.id, clubId, userId, answerId); toast.success('Strong Read set — double points if correct'); onSaved(); }
      catch { toast.error('Could not set Strong Read'); }
    }
  };

  return (
    <div className="space-y-5">
      <CumulativeStandings game={game} participants={participants} refreshKey={round.id} variant="compact" />

      {/* ─── Prompt hero ─── */}
      <div className="rs-prompt-hero">
        <div className="flex items-center justify-between gap-3 relative">
          <span className="rs-prompt-eyebrow">
            <Sparkles className="w-3 h-3" /> Round {round.round_number} · Ballot
          </span>
          {deadline && (
            <span className="text-[10.5px] font-bold text-muted-foreground/75 flex items-center gap-1 tabular-nums">
              <Clock className="w-3 h-3" />
              {deadline.getTime() > Date.now() ? `${formatDistanceToNowStrict(deadline)} left` : 'Locking…'}
            </span>
          )}
        </div>
        <p className="rs-prompt-body">{round.prompt_snapshot || 'Prompt unavailable'}</p>
        <p className="text-[11.5px] font-semibold text-muted-foreground/75 mt-3 pt-3 border-t border-border/20 leading-snug">
          Read each answer, then tap who you think wrote it. Pick <strong className="text-foreground/90">one Strong Read</strong> for double points if you're right.
        </p>
      </div>

      <div className="rs-eyebrow">Answers · {cards.length}</div>

      <div className="space-y-3.5">
        {cards.map((c, idx) => {
          const mine = c.answer_id === myAnswer?.id;
          const picked = guessBy[c.answer_id];
          const isStrong = strong === c.answer_id;
          const saving = savingId === c.answer_id;
          return (
            <div
              key={c.answer_id}
              className={cn(
                'glass-card p-4 transition-shadow',
                mine && 'opacity-90',
                isStrong && 'ring-2 ring-[hsl(45_96%_62%/0.55)]',
              )}
            >
              {/* Header: number + status */}
              <div className="flex items-start gap-3 mb-3">
                <span className="rs-answer-num">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14.5px] leading-snug text-foreground/95">{c.body}</p>
                </div>
                {mine && (
                  <span className="rs-pill" style={{ background: 'hsl(152 66% 40% / 0.18)', borderColor: 'hsl(152 66% 54% / 0.35)', color: 'hsl(152 70% 72%)' }}>
                    Yours
                  </span>
                )}
              </div>

              {mine ? (
                <p className="text-[11.5px] font-semibold text-muted-foreground/70 italic px-1">
                  You can't guess your own answer — nobody scores on self-picks.
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/70">
                      Who wrote this?
                    </span>
                    <button
                      onClick={() => markStrong(c.answer_id)}
                      disabled={locked || !picked}
                      aria-pressed={isStrong}
                      aria-label="Mark as Strong Read (double points)"
                      className="rs-strong-btn"
                      title={isStrong ? 'Strong Read set' : 'Strong Read — 2× if correct'}
                    >
                      <Star className={cn('w-3 h-3', isStrong && 'fill-current')} />
                      {isStrong ? 'Strong Read' : '2× Pick'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {pool.map((p) => {
                      const selected = picked === p.uid;
                      return (
                        <button
                          key={p.uid}
                          type="button"
                          onClick={() => pick(c.answer_id, p.uid)}
                          disabled={locked || saving}
                          data-selected={selected}
                          className="rs-author-btn"
                        >
                          <span className="rs-author-initials">{initialsOf(p.name)}</span>
                          <span className="truncate flex-1">{p.name}</span>
                          <Check className="rs-author-check" strokeWidth={3.5} />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress footer */}
      <div className={cn(
        'glass-card p-3 flex items-center justify-between gap-3 transition-colors',
        allDone && 'ring-1 ring-[hsl(152_66%_54%/0.35)]'
      )}>
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            allDone ? 'bg-[hsl(152_66%_40%/0.2)] text-[hsl(152_70%_70%)]' : 'bg-primary/12 text-primary',
          )}>
            {allDone ? <Check className="w-4 h-4" strokeWidth={3} /> : <span className="text-[11px] font-black tabular-nums">{answered}</span>}
          </div>
          <div className="min-w-0">
            <div className="text-[12.5px] font-extrabold leading-none">
              {allDone ? 'Ballot complete' : `${answered} of ${guessable.length} assigned`}
            </div>
            <div className="text-[10.5px] font-semibold text-muted-foreground/70 mt-1 flex items-center gap-1">
              <Users className="w-2.5 h-2.5" /> {progress.submitted}/{progress.total} finished round
            </div>
          </div>
        </div>
        {allDone && (
          <span className="rs-pill" style={{ background: 'hsl(152 66% 40% / 0.2)', borderColor: 'hsl(152 66% 54% / 0.35)', color: 'hsl(152 72% 74%)' }}>
            Locked in
          </span>
        )}
      </div>
    </div>
  );
}
