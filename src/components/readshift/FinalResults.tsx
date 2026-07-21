// READSHIFT — end-of-game results: winner, leaderboard (with the documented
// tie-breaker chain), and per-player Reading/Signal breakdown. Aggregated
// from the immutable per-round results.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Crown, RotateCcw, ChevronLeft } from 'lucide-react';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import * as api from '@/lib/readshift/api';
import { buildLeaderboard } from '@/lib/readshift/leaderboard';
import type { PlayerAggregate } from '@/lib/readshift/types';
import type { RsGame, RsParticipant, RsRoundResult } from '@/lib/readshift/dbTypes';
import { cn } from '@/lib/utils';

export function FinalResults({ game, participants }: { game: RsGame; participants: RsParticipant[] }) {
  const [results, setResults] = useState<RsRoundResult[]>([]);
  const [loading, setLoading] = useState(true);
  const nameOf = (uid: string) => participants.find((p) => p.user_id === uid)?.profiles?.display_name || 'Player';

  useEffect(() => {
    let live = true;
    (async () => {
      try { const r = await withTimeout(api.getGameResults(game.id), QUERY_TIMEOUT_MS, 'rs final'); if (live) setResults(r); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [game.id]);

  const rows = useMemo(() => {
    const agg: Record<string, PlayerAggregate> = {};
    const base = (uid: string): PlayerAggregate => (agg[uid] ??= { userId: uid, totalScore: 0, readingScore: 0, signalScore: 0, correctReads: 0, correctStrongReads: 0 });
    for (const r of results) {
      for (const [uid, pts] of Object.entries(r.total_points || {})) base(uid).totalScore += Number(pts);
      for (const [uid, pts] of Object.entries(r.reading_points || {})) base(uid).readingScore += Number(pts);
      for (const [uid, pts] of Object.entries(r.signal_points || {})) base(uid).signalScore += Number(pts);
      const cr = (r.detail as any)?.correctReads as Record<string, number> | undefined;
      if (cr) for (const [uid, n] of Object.entries(cr)) base(uid).correctReads += Number(n);
      const sr = (r.detail as any)?.strongReadCorrect as Record<string, boolean> | undefined;
      if (sr) for (const [uid, ok] of Object.entries(sr)) if (ok) base(uid).correctStrongReads += 1;
    }
    return buildLeaderboard(Object.values(agg));
  }, [results]);

  const champion = rows.find((r) => r.rank === 1);

  return (
    <div className="space-y-4">
      <div className="glass-card p-5 text-center relative overflow-hidden" style={{ background: 'radial-gradient(120% 100% at 50% 0%, hsl(var(--gold) / 0.14), transparent 65%)' }}>
        <Crown className="w-6 h-6 mx-auto mb-1" style={{ color: 'hsl(var(--gold))' }} />
        <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground/60">Champion</p>
        <p className="text-[20px] font-extrabold mt-0.5">{champion ? nameOf(champion.userId) : '—'}</p>
        {champion && <p className="text-[12px] text-muted-foreground/70 mt-0.5">{champion.totalScore} points</p>}
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/20 flex items-center gap-2"><Trophy className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} /><h3 className="font-bold text-[13px]">Final Standings</h3></div>
        {loading ? (
          <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-6 rounded skeleton-shimmer" />)}</div>
        ) : (
          <div className="divide-y divide-border/10">
            {rows.map((r) => (
              <div key={r.userId} className={cn('flex items-center gap-3 px-4 py-2.5', r.rank === 1 && 'bg-gold/[0.06]')}>
                <span className={cn('w-6 text-center text-[13px] font-extrabold', r.rank === 1 ? 'text-gold' : 'text-muted-foreground')}>{r.rank}</span>
                <span className="flex-1 text-[13px] font-bold truncate">{nameOf(r.userId)}</span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums">{r.readingScore}R · {r.signalScore}S</span>
                <span className="text-[15px] font-black tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{r.totalScore}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Link to="/readshift" className="flex-1">
          <button className="w-full h-11 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-[13px] font-bold flex items-center justify-center gap-2 btn-press">
            <ChevronLeft className="w-4 h-4" /> Back to READSHIFT
          </button>
        </Link>
        <Link to="/readshift/create" className="flex-1">
          <button className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold flex items-center justify-center gap-2 btn-press">
            <RotateCcw className="w-4 h-4" /> Rematch
          </button>
        </Link>
      </div>
    </div>
  );
}
