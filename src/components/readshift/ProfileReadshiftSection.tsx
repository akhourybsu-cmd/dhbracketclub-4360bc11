// READSHIFT — Profile section
//
// Compact, self-only stats card on the caller's Profile page. Renders
// nothing unless the plugin is installed for the active club and the
// player has stats. Reads the caller's own row (own-row RLS).
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { VenetianMask, Eye, Star, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useClubAssets } from '@/hooks/useClubAssets';
import { withTimeout, QUERY_TIMEOUT_MS } from '@/lib/asyncGuards';
import * as api from '@/lib/readshift/api';
import type { RsStats } from '@/lib/readshift/dbTypes';

const ACCENT = '265 85% 66%';

function pct(num: number, den: number) {
  if (!den) return '—';
  return `${Math.round((num / den) * 100)}%`;
}

export function ProfileReadshiftSection() {
  const { user } = useAuth();
  const { club } = useClub();
  const { isInstalled } = useClubAssets();
  const [stats, setStats] = useState<RsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const installed = isInstalled('readshift');

  useEffect(() => {
    if (!installed || !club?.id || !user?.id) { setLoading(false); return; }
    let live = true;
    (async () => {
      try { const s = await withTimeout(api.getMyStats(club.id, user.id), QUERY_TIMEOUT_MS, 'rs stats'); if (live) setStats(s); }
      catch { /* leave null */ }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [installed, club?.id, user?.id]);

  if (!installed || loading) return null;
  if (!stats || stats.rounds_played === 0) return null;

  const readAccuracy = pct(stats.correct_reads, stats.eligible_reads);
  const strongAccuracy = pct(stats.correct_strong_reads, stats.strong_reads);
  const bestSignal = (() => {
    const opts: [string, number, number][] = [
      ['Tell', stats.tell_success, stats.tell_rounds],
      ['Blur', stats.blur_success, stats.blur_rounds],
      ['Frame', stats.frame_success, stats.frame_rounds],
    ].filter((row) => (row[2] as number) > 0) as [string, number, number][];
    if (!opts.length) return null;
    opts.sort((a, b) => (b[1] / b[2]) - (a[1] / a[2]));
    return `${opts[0][0]} (${pct(opts[0][1], opts[0][2])})`;
  })();

  const tiles = [
    { icon: Trophy, label: 'Games won', value: `${stats.games_won}/${stats.games_played}` },
    { icon: Eye, label: 'Read accuracy', value: readAccuracy },
    { icon: Star, label: 'Strong reads', value: strongAccuracy },
    { icon: VenetianMask, label: 'Best signal', value: bestSignal ?? '—' },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden mb-4"
      style={{ background: 'linear-gradient(180deg, hsl(var(--card)), hsl(var(--card) / 0.92))', border: `1px solid hsl(${ACCENT} / 0.24)` }}
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5 border-b border-border/15"
        style={{ background: `radial-gradient(ellipse 80% 60% at 100% 0%, hsl(${ACCENT} / 0.12), transparent 70%)` }}>
        <VenetianMask className="w-3 h-3 flex-shrink-0" style={{ color: `hsl(${ACCENT})` }} />
        <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]" style={{ color: `hsl(${ACCENT})` }}>Readshift</p>
        <span className="ml-auto text-[10px] font-semibold text-muted-foreground/60">{stats.total_score} pts · {stats.rounds_played} rounds</span>
      </div>
      <div className="grid grid-cols-2 gap-px bg-border/10">
        {tiles.map((t) => (
          <div key={t.label} className="bg-card px-3.5 py-3 flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `hsl(${ACCENT} / 0.12)`, color: `hsl(${ACCENT})` }}>
              <t.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold leading-tight truncate">{t.value}</p>
              <p className="text-[10px] text-muted-foreground/65 leading-tight">{t.label}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.section>
  );
}
