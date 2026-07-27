// READSHIFT — Read phase: attribute each anonymous answer to a player.
// The reader's own answer is shown but not guessable (self-guesses never
// score). Same author may be picked for multiple answers. One Strong Read.
// Cards are ordered by their random uuid — a stable, author-neutral order.
import { useMemo, useState } from 'react';
import { Clock, Star, Users, Check } from 'lucide-react';
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

export function ReadPhase({ game, round, readCards, authorPool, myGuesses, myAnswer, participants, progress, userId, clubId, onSaved }: Props) {
  const nameOf = (uid: string) => participants.find((p) => p.user_id === uid)?.profiles?.display_name || 'Player';
  const cards = useMemo(() => [...readCards].sort((a, b) => a.answer_id.localeCompare(b.answer_id)), [readCards]);
  const poolNames = useMemo(
    () => authorPool.map((uid) => ({ uid, name: nameOf(uid) })).sort((a, b) => a.name.localeCompare(b.name)),
    [authorPool, participants],
  );
  const [guessBy, setGuessBy] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const g of myGuesses) if (g.guessed_user_id) m[g.answer_id] = g.guessed_user_id;
    return m;
  });
  const [strong, setStrong] = useState<string | null>(() => myGuesses.find((g) => g.is_strong_read)?.answer_id ?? null);
  const locked = round.phase !== 'read';
  const deadline = round.read_deadline ? new Date(round.read_deadline) : null;

  const guessable = cards.filter((c) => c.answer_id !== myAnswer?.id);
  const answered = guessable.filter((c) => guessBy[c.answer_id]).length;

  const pick = async (answerId: string, guessed: string) => {
    const nextMap = { ...guessBy, [answerId]: guessed };
    setGuessBy(nextMap);
    try {
      await api.saveGuess(round.id, clubId, userId, answerId, guessed);
      // If this completed our ballot and early_advance is on, poke the server.
      if (game.early_advance) {
        const done = guessable.every((c) => nextMap[c.answer_id]);
        if (done) void api.pokeAdvance(game.id);
      }
    } catch { toast.error('Could not save guess'); }
  };
  const markStrong = async (answerId: string) => {
    const next = strong === answerId ? null : answerId;
    setStrong(next);
    if (next) {
      try { await api.setStrongRead(round.id, clubId, userId, answerId); toast.success('Strong Read set'); onSaved(); }
      catch { toast.error('Could not set Strong Read'); }
    }
  };

  return (
    <div className="space-y-4">
      <CumulativeStandings game={game} participants={participants} refreshKey={round.id} variant="compact" />
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/60">
            Round {round.round_number} · Prompt
          </span>
          {deadline && (
            <span className="text-[11px] font-semibold text-muted-foreground/70 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {deadline.getTime() > Date.now() ? `${formatDistanceToNowStrict(deadline)} left` : 'Locking…'}
            </span>
          )}
        </div>
        <p className="text-[16px] font-extrabold leading-snug">{round.prompt_snapshot || 'Prompt unavailable'}</p>
        <p className="text-[11px] font-bold text-muted-foreground/70 mt-2.5 pt-2.5 border-t border-border/15">
          Who wrote what? Tap an answer to assign an author.
        </p>
      </div>

      <div className="space-y-3">
        {cards.map((c) => {
          const mine = c.answer_id === myAnswer?.id;
          return (
            <div key={c.answer_id} className={cn('glass-card p-4', mine && 'opacity-80')}>
              <p className="text-[14px] leading-snug mb-3">{c.body}</p>
              {mine ? (
                <span className="text-[11px] font-bold text-muted-foreground/70">Your answer</span>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={guessBy[c.answer_id] ?? ''}
                    onChange={(e) => pick(c.answer_id, e.target.value)}
                    disabled={locked}
                    className="form-input flex-1 h-10"
                    aria-label="Who wrote this?"
                  >
                    <option value="" disabled>Who wrote this?</option>
                    {poolNames.map((p) => <option key={p.uid} value={p.uid}>{p.name}</option>)}
                  </select>
                  <button
                    onClick={() => markStrong(c.answer_id)}
                    disabled={locked || !guessBy[c.answer_id]}
                    aria-pressed={strong === c.answer_id}
                    aria-label="Mark as Strong Read"
                    className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors btn-press',
                      strong === c.answer_id ? 'bg-gold/20 text-gold' : 'bg-muted/50 text-muted-foreground/60')}
                    title="Strong Read (double points if correct)"
                  >
                    <Star className={cn('w-4 h-4', strong === c.answer_id && 'fill-current')} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground/60 flex items-center justify-center gap-3">
        <span className="flex items-center gap-1"><Check className="w-3 h-3" /> {answered}/{guessable.length} assigned</span>
        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {progress.submitted}/{progress.total} finished</span>
      </p>
    </div>
  );
}
