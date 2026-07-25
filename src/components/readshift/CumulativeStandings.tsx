// READSHIFT — Cumulative standings across all scored rounds in a game.
// Shared by Shift / Read / Reveal so players always see the running scoreboard.
import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import * as api from '@/lib/readshift/api';
import type { RsGame, RsParticipant, RsRoundResult } from '@/lib/readshift/dbTypes';

interface Props {
  game: RsGame;
  participants: RsParticipant[];
  /** Bumped by parent (e.g. round id or phase) so we refetch when a new round scores. */
  refreshKey?: string | number;
  /** Compact = single stripe view; full = card with header. */
  variant?: 'compact' | 'full';
}

interface Row {
  uid: string;
  total: number;
  reading: number;
  signal: number;
  rounds: number;
}

export function CumulativeStandings({ game, participants, refreshKey, variant = 'full' }: Props) {
  const [results, setResults] = useState<RsRoundResult[]>([]);
  const [loading, setLoading] = useState(true);

  const nameOf = (uid: string) =>
    participants.find((p) => p.user_id === uid)?.profiles?.display_name || 'Player';
  const initialsOf = (uid: string) =>
    nameOf(uid).split(' ').map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    let live = true;
    (async () => {
      setLoading(true);
      try {
        const r = await withTimeout(api.getGameResults(game.id), QUERY_TIMEOUT_MS, 'rs cumulative');
        if (live) setResults(r);
      } catch { /* non-fatal */ }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [game.id, refreshKey]);

  const rows: Row[] = useMemo(() => {
    const agg: Record<string, Row> = {};
    const base = (uid: string) => (agg[uid] ??= { uid, total: 0, reading: 0, signal: 0, rounds: 0 });
    const roundsByUser: Record<string, Set<string>> = {};
    for (const r of results) {
      for (const [uid, pts] of Object.entries(r.total_points || {})) {
        base(uid).total += Number(pts);
        (roundsByUser[uid] ??= new Set()).add(r.round_id);
      }
      for (const [uid, pts] of Object.entries(r.reading_points || {})) base(uid).reading += Number(pts);
      for (const [uid, pts] of Object.entries(r.signal_points || {})) base(uid).signal += Number(pts);
    }
    // Seed every active participant so they show even at 0.
    for (const p of participants) if (p.active) base(p.user_id);
    for (const uid of Object.keys(agg)) agg[uid].rounds = roundsByUser[uid]?.size ?? 0;
    return Object.values(agg).sort((a, b) => b.total - a.total || b.signal - a.signal);
  }, [results, participants]);

  const scoredRounds = new Set(results.map((r) => r.round_id)).size;
  if (loading || scoredRounds === 0) return null;
  const topScore = rows[0]?.total ?? 0;

  if (variant === 'compact') {
    // Tiny inline pill list — for the top of Shift/Read.
    return (
      <div className="glass-card px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <TrendingUp className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
          <span className="text-[9.5px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/70">
            Standings · through round {scoredRounds}
          </span>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {rows.map((row, i) => {
            const isTop = row.total > 0 && row.total === topScore;
            return (
              <li key={row.uid}
                className={cn(
                  'text-[10.5px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 tabular-nums',
                  isTop ? 'bg-gold/15 text-gold' : 'bg-muted/50 text-muted-foreground/85',
                )}>
                <span className="opacity-60">{i + 1}.</span>
                <span className="truncate max-w-[90px]">{nameOf(row.uid)}</span>
                <span className={cn('font-black', isTop && 'text-gold')}>{row.total}</span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/15 flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground/70">
          Overall Standings
        </h3>
        <span className="ml-auto text-[10px] font-semibold text-muted-foreground/60 tabular-nums">
          through round {scoredRounds}/{game.total_rounds}
        </span>
      </div>
      <ul className="divide-y divide-border/10">
        {rows.map((row, i) => {
          const isTop = row.total > 0 && row.total === topScore;
          return (
            <li key={row.uid} className={cn('flex items-center gap-3 px-4 py-2', isTop && 'bg-gold/[0.05]')}>
              <span className={cn('w-4 text-center text-[11px] font-extrabold tabular-nums',
                isTop ? 'text-gold' : 'text-muted-foreground/60')}>{i + 1}</span>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold flex-shrink-0 relative"
                style={{ background: 'hsl(var(--primary) / 0.14)', color: 'hsl(var(--primary))' }}>
                {initialsOf(row.uid)}
                {isTop && (
                  <Crown className="w-3 h-3 absolute -top-1.5 -right-1.5" style={{ color: 'hsl(var(--gold))' }} />
                )}
              </div>
              <span className="flex-1 text-[13px] font-bold truncate">{nameOf(row.uid)}</span>
              <span className="text-[10px] text-muted-foreground/60 tabular-nums whitespace-nowrap">
                {row.reading}<span className="opacity-60">R</span>
                {' · '}
                {row.signal}<span className="opacity-60">S</span>
              </span>
              <span className={cn('text-[16px] font-black tabular-nums w-10 text-right',
                isTop ? 'text-gold' : 'text-foreground')}>
                {row.total}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
