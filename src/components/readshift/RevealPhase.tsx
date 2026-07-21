// READSHIFT — Reveal: for each answer show the author, their Signal, FRAME
// target, the group's guesses + Strong Reads, and points. Reactions and
// comments are allowed ONLY here (post-reveal). All data comes from the
// immutable readshift_round_results (the sanctioned reveal source).
import { useState } from 'react';
import { Star, Award, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SignalBadge, signalHsl } from './SignalBadge';
import * as api from '@/lib/readshift/api';
import type { RsGame, RsRound, RsRoundResult, RsRoundAward, RsComment, RsParticipant, RsRevealAnswer } from '@/lib/readshift/dbTypes';

const REACTIONS = [
  { key: 'knew_it', label: 'Knew It' },
  { key: 'you_got_me', label: 'You Got Me' },
  { key: 'absolutely_not', label: 'Absolutely Not' },
  { key: 'too_accurate', label: 'Too Accurate' },
  { key: 'identity_theft', label: 'Identity Theft' },
  { key: 'explain_yourself', label: 'Explain Yourself' },
];

interface Props {
  game: RsGame; round: RsRound; result: RsRoundResult | null; awards: RsRoundAward[];
  comments: RsComment[]; participants: RsParticipant[]; userId: string; clubId: string; onChanged: () => void;
}

export function RevealPhase({ round, result, awards, comments, participants, userId, clubId, onChanged }: Props) {
  const nameOf = (uid: string | null) => (uid ? participants.find((p) => p.user_id === uid)?.profiles?.display_name || 'Player' : '—');
  const [reacted, setReacted] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState('');
  const answers: RsRevealAnswer[] = result?.detail?.answers ?? [];

  if (round.voided || answers.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-sm font-bold mb-1">Round {round.round_number} was voided</p>
        <p className="text-[12px] text-muted-foreground/70">Fewer than 3 answers came in, so no points were awarded. On to the next round.</p>
      </div>
    );
  }

  const react = async (answerId: string, key: string) => {
    const k = `${answerId}:${key}`;
    setReacted((prev) => ({ ...prev, [k]: !prev[k] }));
    try { await api.toggleReaction(answerId, userId, key); } catch { toast.error('Could not react'); }
  };
  const postComment = async () => {
    if (!comment.trim()) return;
    try { await api.addComment(round.id, clubId, userId, comment); setComment(''); onChanged(); }
    catch { toast.error('Could not comment'); }
  };

  return (
    <div className="space-y-4">
      {awards.length > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center gap-1.5 mb-2"><Award className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} /><h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/60">Round Awards</h3></div>
          <div className="flex flex-wrap gap-1.5">
            {awards.map((a) => (
              <span key={a.id} className="text-[11px] font-semibold px-2 py-1 rounded-lg" style={{ background: 'hsl(var(--gold) / 0.12)', color: 'hsl(var(--gold))' }}>
                {a.label}: {nameOf(a.user_id)}
              </span>
            ))}
          </div>
        </div>
      )}

      {answers.map((ans) => {
        const hsl = signalHsl(ans.signal);
        return (
          <div key={ans.answerId} className="glass-card p-4">
            <p className="text-[14px] leading-snug mb-3">{ans.body}</p>
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold" style={{ background: `hsl(${hsl} / 0.16)`, color: `hsl(${hsl})` }}>
                {nameOf(ans.authorUserId).split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
              </div>
              <span className="text-[13px] font-bold">{nameOf(ans.authorUserId)}</span>
              <SignalBadge signal={ans.signal} size="sm" />
              {ans.signal === 'FRAME' && <span className="text-[11px] text-muted-foreground/70">framing <strong>{nameOf(ans.frameTargetUserId)}</strong></span>}
              <span className="ml-auto text-[12px] font-black tabular-nums" style={{ color: `hsl(${hsl})` }}>+{ans.signalPoints}</span>
            </div>

            {/* Who guessed whom */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {ans.guesses.map((g, i) => {
                const correct = g.guessed === ans.authorUserId;
                const target = ans.signal === 'FRAME' && g.guessed === ans.frameTargetUserId;
                return (
                  <span key={i} className={cn('text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1',
                    correct ? 'bg-success/15 text-success' : target ? 'bg-primary/12 text-primary' : 'bg-muted/50 text-muted-foreground/80')}>
                    {g.strong && <Star className="w-2.5 h-2.5 fill-current" />}
                    {nameOf(g.reader)} → {nameOf(g.guessed)}
                  </span>
                );
              })}
            </div>
            {ans.bonuses.length > 0 && (
              <p className="text-[10px] text-muted-foreground/60 mb-2">{ans.bonuses.map((b) => `${b.name} +${b.points}`).join(' · ')}</p>
            )}

            {/* Reactions (post-reveal only) */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/15">
              {REACTIONS.map((r) => {
                const active = reacted[`${ans.answerId}:${r.key}`];
                return (
                  <button key={r.key} onClick={() => react(ans.answerId, r.key)}
                    className={cn('text-[10px] font-bold px-2 py-1 rounded-full transition-colors btn-press',
                      active ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-muted/40 text-muted-foreground/70 border border-transparent')}>
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Round comments */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-1.5 mb-2"><MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60" /><h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/60">Comments</h3></div>
        <div className="space-y-2 mb-3">
          {comments.length === 0 && <p className="text-[12px] text-muted-foreground/60">Be the first to react.</p>}
          {comments.map((c) => (
            <div key={c.id} className="text-[12.5px]"><span className="font-bold">{c.profiles?.display_name || 'Player'}</span> <span className="text-foreground/85">{c.content}</span></div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))} placeholder="Add a comment…"
            className="form-input flex-1 h-10" onKeyDown={(e) => { if (e.key === 'Enter') postComment(); }} />
          <button onClick={postComment} disabled={!comment.trim()} className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
