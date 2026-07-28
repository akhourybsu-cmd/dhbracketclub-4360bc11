// READSHIFT — Round History
// A collapsed timeline of every completed round in the game. Each entry
// shows the prompt, the top scorer, and expands to reveal per-answer
// authors, signals, and points. Uses the immutable round_results detail
// that powers the Reveal screen, so nothing new is scored client-side.
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, History, Trophy } from 'lucide-react';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import * as api from '@/lib/readshift/api';
import { SignalBadge, signalHsl } from './SignalBadge';
import { cn } from '@/lib/utils';
import type { RsGame, RsParticipant, RsRound, RsRoundResult, RsRevealAnswer } from '@/lib/readshift/dbTypes';

interface Props {
  game: RsGame;
  participants: RsParticipant[];
  /** Optional: hide the round currently being revealed to avoid duplication. */
  excludeRoundId?: string | null;
  refreshKey?: string | number;
}

export function RoundHistory({ game, participants, excludeRoundId, refreshKey }: Props) {
  const [rounds, setRounds] = useState<RsRound[]>([]);
  const [results, setResults] = useState<RsRoundResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const nameOf = (uid: string | null) =>
    uid ? participants.find((p) => p.user_id === uid)?.profiles?.display_name || 'Player' : '—';

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const [rs, rr] = await Promise.all([
          withTimeout(api.getRounds(game.id), QUERY_TIMEOUT_MS, 'rs history rounds'),
          withTimeout(api.getGameResults(game.id), QUERY_TIMEOUT_MS, 'rs history results'),
        ]);
        if (!live) return;
        setRounds(rs);
        setResults(rr);
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [game.id, refreshKey]);

  const resultByRound = useMemo(() => {
    const m = new Map<string, RsRoundResult>();
    for (const r of results) m.set(r.round_id, r);
    return m;
  }, [results]);

  // Only surface rounds that have been scored (or voided) — i.e. history.
  const historyRounds = useMemo(() => {
    return rounds
      .filter((r) => r.id !== excludeRoundId)
      .filter((r) => r.voided || resultByRound.has(r.id))
      .sort((a, b) => b.round_number - a.round_number);
  }, [rounds, resultByRound, excludeRoundId]);

  if (loading) {
    return (
      <div className="glass-card p-4">
        <div className="h-4 w-1/3 rounded skeleton-shimmer mb-3" />
        <div className="h-3 w-2/3 rounded skeleton-shimmer" />
      </div>
    );
  }
  if (historyRounds.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2">
        <History className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
        <h3 className="font-bold text-[13px]">Round History</h3>
        <span className="ml-auto text-[11px] font-bold tabular-nums text-muted-foreground/70">
          {historyRounds.length}
        </span>
      </div>
      <ul className="divide-y divide-border/10">
        {historyRounds.map((round) => {
          const result = resultByRound.get(round.id);
          const isOpen = !!open[round.id];
          const answers: RsRevealAnswer[] = result?.detail?.answers ?? [];
          const totals = (result?.total_points || {}) as Record<string, number>;
          const topEntry = Object.entries(totals).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
          const topUid = topEntry?.[0];
          const topPts = topEntry ? Number(topEntry[1]) : 0;

          return (
            <li key={round.id}>
              <button
                onClick={() => setOpen((p) => ({ ...p, [round.id]: !p[round.id] }))}
                className="w-full text-left px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors"
              >
                <span className="w-6 text-center text-[11px] font-extrabold tabular-nums text-muted-foreground/70">
                  R{round.round_number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold truncate text-foreground/90">
                    {round.voided ? 'Voided round' : (round.prompt_snapshot || 'Prompt unavailable')}
                  </p>
                  {!round.voided && topUid && (
                    <p className="text-[10.5px] text-muted-foreground/70 mt-0.5 flex items-center gap-1 truncate">
                      <Trophy className="w-2.5 h-2.5" style={{ color: 'hsl(var(--gold))' }} />
                      Top: <span className="font-bold">{nameOf(topUid)}</span> · +{topPts}
                    </p>
                  )}
                </div>
                <ChevronDown className={cn('w-4 h-4 text-muted-foreground/50 transition-transform', isOpen && 'rotate-180')} />
              </button>

              {isOpen && !round.voided && result && (
                <div className="px-4 pb-3 pt-1 space-y-2 bg-muted/10">
                  {round.prompt_snapshot && (
                    <p className="text-[11.5px] italic text-muted-foreground/85 border-l-2 border-primary/40 pl-2">
                      "{round.prompt_snapshot}"
                    </p>
                  )}
                  {answers.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/60">No answers recorded.</p>
                  ) : (
                    answers.map((ans) => {
                      const hsl = signalHsl(ans.signal);
                      return (
                        <div key={ans.answerId} className="rounded-lg border border-border/20 p-2.5 bg-background/40">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[12px] font-bold truncate flex-1">{nameOf(ans.authorUserId)}</span>
                            <SignalBadge signal={ans.signal} size="sm" />
                            <span className="text-[13px] font-black tabular-nums w-8 text-right" style={{ color: `hsl(${hsl})` }}>
                              +{ans.signalPoints}
                            </span>
                          </div>
                          <p className="text-[12px] italic text-foreground/85 leading-snug">"{ans.body}"</p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {isOpen && round.voided && (
                <div className="px-4 pb-3 pt-1 text-[11px] text-muted-foreground/70 bg-muted/10">
                  Fewer than 3 answers came in — no points were awarded.
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
