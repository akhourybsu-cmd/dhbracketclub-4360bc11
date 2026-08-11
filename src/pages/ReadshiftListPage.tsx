import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { VenetianMask, Plus, ChevronRight, Users, Fingerprint, Waves } from 'lucide-react';
import { useClub } from '@/contexts/ClubContext';
import { useReadshiftGames } from '@/hooks/useReadshift';
import { HowToPlayDialog } from '@/components/readshift/HowToPlayDialog';
import type { RsGame } from '@/lib/readshift/dbTypes';
import type { Phase } from '@/lib/readshift/types';

const PHASE_META: Record<Phase, { label: string; hsl: string; live?: boolean }> = {
  lobby: { label: 'Gathering', hsl: '278 60% 70%' },
  shift: { label: 'Answering', hsl: '45 96% 62%', live: true },
  read: { label: 'Reading', hsl: '200 80% 60%', live: true },
  reveal: { label: 'Reveal', hsl: '305 82% 66%', live: true },
  completed: { label: 'Complete', hsl: '278 20% 70%' },
  paused: { label: 'Paused', hsl: '278 20% 70%' },
  cancelled: { label: 'Cancelled', hsl: '350 70% 62%' },
};

function GameRow({ g }: { g: RsGame }) {
  const meta = PHASE_META[g.phase] ?? PHASE_META.lobby;
  const roundLine = ['shift', 'read', 'reveal'].includes(g.phase)
    ? `Round ${g.current_round} of ${g.total_rounds}`
    : g.phase === 'completed' ? `${g.total_rounds} rounds played` : `${g.total_rounds}-round game`;
  return (
    <Link to={`/readshift/${g.id}`} className="block">
      <motion.div whileTap={{ scale: 0.985 }}
        className="glass-card p-4 flex items-center gap-3 relative overflow-hidden"
        style={{ borderColor: `hsl(${meta.hsl} / 0.3)` }}>
        {/* phase-tinted edge glow */}
        <div aria-hidden className="absolute inset-y-0 left-0 w-1" style={{ background: `hsl(${meta.hsl})`, boxShadow: `0 0 16px hsl(${meta.hsl} / 0.7)` }} />
        {/* faint mask watermark */}
        <VenetianMask aria-hidden className="absolute -right-3 -bottom-3 w-20 h-20 opacity-[0.06] rotate-12" style={{ color: `hsl(${meta.hsl})` }} />
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 relative z-10"
          style={{ background: `radial-gradient(circle at 30% 30%, hsl(${meta.hsl} / 0.3), transparent 70%), linear-gradient(135deg, hsl(268 40% 14%), hsl(270 50% 8%))`, border: `1px solid hsl(${meta.hsl} / 0.4)` }}>
          <VenetianMask className="w-5 h-5" style={{ color: `hsl(${meta.hsl})` }} />
        </div>
        <div className="min-w-0 flex-1 relative z-10">
          <h3 className="font-extrabold text-[14px] truncate">{g.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.1em]" style={{ color: `hsl(${meta.hsl})` }}>
              {meta.live && <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: `hsl(${meta.hsl})` }} />}
              {meta.label}
            </span>
            <span className="text-[11px] text-muted-foreground/60">·</span>
            <span className="text-[11px] text-muted-foreground/70">{roundLine}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/45 flex-shrink-0 relative z-10" />
      </motion.div>
    </Link>
  );
}

export default function ReadshiftListPage() {
  const { club } = useClub();
  const { games, loading } = useReadshiftGames(club?.id);

  const active = games.filter((g) => ['lobby', 'shift', 'read', 'reveal', 'paused'].includes(g.phase));
  const past = games.filter((g) => ['completed', 'cancelled'].includes(g.phase));

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Hero start panel */}
      <div className="glass-card p-5 relative overflow-hidden text-center"
        style={{ background: 'radial-gradient(120% 90% at 50% 0%, hsl(285 85% 40% / 0.18), transparent 62%), linear-gradient(180deg, hsl(268 40% 11% / 0.9), hsl(270 46% 6% / 0.94))' }}>
        {/* twin signal-mask motif */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {[{ i: Fingerprint, c: '152 66% 54%' }, { i: VenetianMask, c: '305 82% 66%' }, { i: Waves, c: '200 80% 60%' }].map(({ i: Icon, c }, k) => (
            <div key={k} className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `hsl(${c} / 0.14)`, border: `1px solid hsl(${c} / 0.32)` }}>
              <Icon className="w-4 h-4" style={{ color: `hsl(${c})` }} />
            </div>
          ))}
        </div>
        <h1 className="text-[19px] font-black tracking-tight mb-1">Can they read you?</h1>
        <p className="text-[12px] text-muted-foreground/75 leading-snug max-w-[300px] mx-auto mb-4">
          Answer prompts in a secret voice. Then unmask who wrote what. Play at your own pace.
        </p>
        <div className="flex gap-2">
          <Link to="/readshift/create" className="flex-1">
            <button className="rs-cta w-full h-12 rounded-xl btn-press">
              <Plus className="w-4 h-4" /> New Game
            </button>
          </Link>
          <HowToPlayDialog variant="icon" />
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4"><div className="h-4 w-1/3 rounded skeleton-shimmer mb-2" /><div className="h-3 w-1/2 rounded skeleton-shimmer" /></div>
          ))}
        </div>
      ) : games.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'hsl(280 85% 66% / 0.14)', border: '1px solid hsl(280 85% 66% / 0.3)' }}>
            <Users className="w-6 h-6" style={{ color: 'hsl(285 92% 78%)' }} />
          </div>
          <p className="text-sm font-bold mb-1">No games yet</p>
          <p className="text-[12px] text-muted-foreground/70">Start a game and gather 4+ players to begin reading each other.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.length > 0 && (
            <Stagger className="space-y-2.5">{active.map((g) => <StaggerItem key={g.id}><GameRow g={g} /></StaggerItem>)}</Stagger>
          )}
          {past.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-muted-foreground/55">The Archive</span>
                <div className="rs-divider flex-1" />
              </div>
              <Stagger className="space-y-2.5">{past.map((g) => <StaggerItem key={g.id}><GameRow g={g} /></StaggerItem>)}</Stagger>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
