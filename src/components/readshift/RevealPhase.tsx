// READSHIFT — Reveal: clean, scannable summary of the round.
// Priorities (UI, not mechanics):
//  1. A "Round Scoreboard" at the top — who scored what, at a glance.
//  2. Per-answer cards that lead with author + points, hide the noise.
//  3. Reactions tucked behind a single "React" toggle so the card stays quiet.
import { useMemo, useState } from 'react';
import { Star, Award, MessageSquare, Send, Smile, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SignalBadge, signalHsl } from './SignalBadge';
import * as api from '@/lib/readshift/api';
import type {
  RsGame, RsRound, RsRoundResult, RsRoundAward, RsComment, RsParticipant, RsRevealAnswer,
} from '@/lib/readshift/dbTypes';

const REACTIONS = [
  { key: 'knew_it', label: 'Knew It' },
  { key: 'you_got_me', label: 'You Got Me' },
  { key: 'absolutely_not', label: 'Nope' },
  { key: 'too_accurate', label: 'Too Accurate' },
  { key: 'identity_theft', label: 'Identity Theft' },
  { key: 'explain_yourself', label: 'Explain' },
];

interface Props {
  game: RsGame; round: RsRound; result: RsRoundResult | null; awards: RsRoundAward[];
  comments: RsComment[]; participants: RsParticipant[]; userId: string; clubId: string; onChanged: () => void;
}

export function RevealPhase({ round, result, awards, comments, participants, userId, clubId, onChanged }: Props) {
  const nameOf = (uid: string | null) =>
    (uid ? participants.find((p) => p.user_id === uid)?.profiles?.display_name || 'Player' : '—');
  const initialsOf = (uid: string | null) =>
    nameOf(uid).split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const [reacted, setReacted] = useState<Record<string, boolean>>({});
  const [reactOpen, setReactOpen] = useState<Record<string, boolean>>({});
  const [comment, setComment] = useState('');

  const answers: RsRevealAnswer[] = result?.detail?.answers ?? [];

  // Round scoreboard — ranked by round total, with reading + signal breakdown.
  const scoreboard = useMemo(() => {
    if (!result) return [];
    const total = (result.total_points || {}) as Record<string, number>;
    const reading = (result.reading_points || {}) as Record<string, number>;
    const signal = (result.signal_points || {}) as Record<string, number>;
    const uids = new Set<string>([
      ...Object.keys(total), ...Object.keys(reading), ...Object.keys(signal),
    ]);
    return Array.from(uids)
      .map((uid) => ({
        uid,
        total: Number(total[uid] ?? 0),
        reading: Number(reading[uid] ?? 0),
        signal: Number(signal[uid] ?? 0),
      }))
      .sort((a, b) => b.total - a.total || b.signal - a.signal);
  }, [result]);
  const topScore = scoreboard[0]?.total ?? 0;

  if (round.voided || answers.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-sm font-bold mb-1">Round {round.round_number} was voided</p>
        <p className="text-[12px] text-muted-foreground/70">
          Fewer than 3 answers came in, so no points were awarded. On to the next round.
        </p>
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
      {/* ───────── Round Scoreboard ───────── */}
      {scoreboard.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/15 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/70">
              Round {round.round_number} · Scoreboard
            </h3>
          </div>
          <ul className="divide-y divide-border/10">
            {scoreboard.map((row, i) => {
              const isTop = row.total > 0 && row.total === topScore;
              return (
                <li key={row.uid} className={cn('flex items-center gap-3 px-4 py-2', isTop && 'bg-gold/[0.05]')}>
                  <span className={cn('w-4 text-center text-[11px] font-extrabold tabular-nums',
                    isTop ? 'text-gold' : 'text-muted-foreground/60')}>{i + 1}</span>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                    style={{ background: 'hsl(var(--primary) / 0.14)', color: 'hsl(var(--primary))' }}>
                    {initialsOf(row.uid)}
                  </div>
                  <span className="flex-1 text-[13px] font-bold truncate">{nameOf(row.uid)}</span>
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums whitespace-nowrap">
                    {row.reading}<span className="opacity-60">R</span>
                    {' · '}
                    {row.signal}<span className="opacity-60">S</span>
                  </span>
                  <span className={cn('text-[16px] font-black tabular-nums w-9 text-right',
                    isTop ? 'text-gold' : 'text-foreground')}>
                    +{row.total}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="px-4 py-1.5 border-t border-border/10 text-[9.5px] text-muted-foreground/55 text-center uppercase tracking-[0.14em]">
            R = Reading · S = Signal
          </div>
        </div>
      )}

      {/* ───────── Awards ───────── */}
      {awards.length > 0 && (
        <div className="glass-card p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Award className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
            <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/60">Round Awards</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {awards.map((a) => (
              <span key={a.id} className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                style={{ background: 'hsl(var(--gold) / 0.12)', color: 'hsl(var(--gold))' }}>
                {a.label}: {nameOf(a.user_id)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ───────── Answers ───────── */}
      {answers.map((ans) => {
        const hsl = signalHsl(ans.signal);
        const showReact = !!reactOpen[ans.answerId];
        return (
          <div key={ans.answerId} className="glass-card p-4">
            {/* Header: author + signal + points */}
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                style={{ background: `hsl(${hsl} / 0.16)`, color: `hsl(${hsl})` }}>
                {initialsOf(ans.authorUserId)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold leading-none truncate">{nameOf(ans.authorUserId)}</div>
                {ans.signal === 'FRAME' && (
                  <div className="text-[10.5px] text-muted-foreground/70 mt-0.5 truncate">
                    framing <strong>{nameOf(ans.frameTargetUserId)}</strong>
                  </div>
                )}
              </div>
              <SignalBadge signal={ans.signal} size="sm" />
              <span className="text-[16px] font-black tabular-nums w-9 text-right"
                style={{ color: `hsl(${hsl})` }}>+{ans.signalPoints}</span>
            </div>

            {/* Answer body */}
            <p className="text-[14.5px] leading-snug mb-3 italic text-foreground/90">"{ans.body}"</p>

            {/* Guesses — quiet chips */}
            {ans.guesses.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {ans.guesses.map((g, i) => {
                  const correct = g.guessed === ans.authorUserId;
                  const target = ans.signal === 'FRAME' && g.guessed === ans.frameTargetUserId;
                  return (
                    <span key={i} className={cn(
                      'text-[10.5px] font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-1',
                      correct ? 'bg-success/15 text-success'
                        : target ? 'bg-primary/12 text-primary'
                        : 'bg-muted/40 text-muted-foreground/75')}>
                      {g.strong && <Star className="w-2.5 h-2.5 fill-current" />}
                      {nameOf(g.reader)} → {nameOf(g.guessed)}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Bonuses on one quiet line */}
            {ans.bonuses.length > 0 && (
              <p className="text-[10px] text-muted-foreground/60 mb-2">
                {ans.bonuses.map((b) => `${b.name} +${b.points}`).join(' · ')}
              </p>
            )}

            {/* Reactions — collapsed by default */}
            <div className="pt-2 border-t border-border/15">
              {!showReact ? (
                <button
                  onClick={() => setReactOpen((p) => ({ ...p, [ans.answerId]: true }))}
                  className="text-[11px] font-bold text-muted-foreground/70 hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  <Smile className="w-3 h-3" /> React
                </button>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {REACTIONS.map((r) => {
                    const active = reacted[`${ans.answerId}:${r.key}`];
                    return (
                      <button key={r.key} onClick={() => react(ans.answerId, r.key)}
                        className={cn('text-[10px] font-bold px-2 py-1 rounded-full transition-colors btn-press',
                          active
                            ? 'bg-primary/20 text-primary border border-primary/40'
                            : 'bg-muted/40 text-muted-foreground/70 border border-transparent')}>
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* ───────── Comments ───────── */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground/60" />
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/60">Comments</h3>
        </div>
        <div className="space-y-2 mb-3">
          {comments.length === 0 && <p className="text-[12px] text-muted-foreground/60">Be the first to react.</p>}
          {comments.map((c) => (
            <div key={c.id} className="text-[12.5px]">
              <span className="font-bold">{c.profiles?.display_name || 'Player'}</span>{' '}
              <span className="text-foreground/85">{c.content}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={comment} onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="Add a comment…"
            className="form-input flex-1 h-10"
            onKeyDown={(e) => { if (e.key === 'Enter') postComment(); }} />
          <button onClick={postComment} disabled={!comment.trim()}
            className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
