import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy, Crown, Award, Flame, Target, Zap, Timer, TrendingUp,
  Sparkles, Medal, Loader2, RefreshCw, ChevronRight, ChevronDown,
  Gem, BarChart3, Users,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { useCountUp } from '@/lib/draft/animations';
import { useDraftStatsHub } from '@/hooks/useDraftStatsHub';
import {
  filterDatasetByScope,
  computeUserAggregate,
  computePickQuality,
  computeTiming,
  computeCareerPulse,
  computeLongestStreak,
  computeTopicTendencies,
  computeLeaderboard,
  computeFunAwards,
  computeIdentity,
  fmtDuration,
  displayName,
  type ScopeKey,
  type LeaderMetric,
} from '@/lib/draft/statsAggregators';

function Counter({ value, decimals = 0, suffix = '' }: { value: number; decimals?: number; suffix?: string }) {
  const animated = useCountUp(value);
  return <span>{decimals > 0 ? animated.toFixed(decimals) : Math.round(animated).toLocaleString()}{suffix}</span>;
}

function UserAvatar({ name, url, size = 28 }: { name: string; url: string | null; size?: number }) {
  return (
    <Avatar style={{ width: size, height: size }}>
      {url && <AvatarImage src={url} alt={name} />}
      <AvatarFallback className="text-[10px] font-bold">{name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function SectionLabel({ icon: Icon, children, accent }: { icon: any; children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2 mt-1 px-0.5">
      <Icon className="w-3.5 h-3.5" style={{ color: accent || 'hsl(var(--gold))' }} />
      <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/80">{children}</span>
    </div>
  );
}

/* ─── Scope bar ─── */
function ScopeBar({ scope, onScope, seasons }: {
  scope: ScopeKey;
  onScope: (s: ScopeKey) => void;
  seasons: { id: string; name: string }[];
}) {
  return (
    <div className="-mx-1 px-1 overflow-x-auto no-scrollbar mb-3">
      <div className="flex items-center gap-1.5 min-w-max pb-1">
        <button
          onClick={() => onScope('all')}
          className={cn('px-3 h-8 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors btn-press border',
            scope === 'all'
              ? 'bg-gold/20 text-gold border-gold/40'
              : 'bg-muted/30 text-muted-foreground border-border/30')}>
          All-Time
        </button>
        {seasons.map(s => (
          <button key={s.id} onClick={() => onScope(s.id)}
            className={cn('px-3 h-8 rounded-full text-[11px] font-bold whitespace-nowrap transition-colors btn-press border',
              scope === s.id
                ? 'bg-gold/20 text-gold border-gold/40'
                : 'bg-muted/30 text-muted-foreground border-border/30')}>
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Hero identity card ─── */
function HeroIdentity({ nickname, agg, totalPoints }: { nickname: string; agg: ReturnType<typeof computeUserAggregate>; totalPoints: number }) {
  if (!agg) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="relative rounded-2xl overflow-hidden p-5"
        style={{
          background: 'linear-gradient(135deg, hsl(var(--gold) / 0.18), hsl(var(--gold) / 0.04) 50%, transparent), linear-gradient(180deg, hsl(160 35% 7% / 0.92), hsl(160 50% 4% / 0.95))',
          border: '1px solid hsl(var(--gold) / 0.25)',
          boxShadow: '0 10px 40px -10px hsl(var(--gold) / 0.35)',
        }}>
        <div className="absolute -top-4 -right-4 text-[120px] leading-none opacity-[0.06] select-none pointer-events-none" aria-hidden>★</div>
        <div className="relative z-10">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">Your Draft Identity</p>
          <h2 className="text-2xl font-extrabold mt-1 tracking-tight" style={{ color: 'hsl(var(--gold))' }}>{nickname}</h2>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            {agg.draftsPlayed} draft{agg.draftsPlayed === 1 ? '' : 's'} · {(agg.winRate * 100).toFixed(0)}% win rate · {(agg.podiumRate * 100).toFixed(0)}% podium rate
          </p>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              { v: totalPoints, l: 'Lifetime Pts' },
              { v: agg.wins, l: 'Wins' },
              { v: agg.podiums, l: 'Podiums' },
            ].map(s => (
              <div key={s.l} className="text-center bg-background/30 rounded-xl py-2.5 border border-border/15">
                <p className="text-xl font-extrabold leading-none tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                  <Counter value={s.v} />
                </p>
                <p className="text-[9px] text-muted-foreground/70 font-bold mt-1 uppercase tracking-wider">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Trophy case ─── */
function TrophyCase({ agg, longestStreak, mvpPicks }: {
  agg: ReturnType<typeof computeUserAggregate>;
  longestStreak: number;
  mvpPicks: number;
}) {
  if (!agg) return null;
  const items = [
    { icon: Crown, label: 'Championships', value: agg.championships, color: 'hsl(var(--gold))' },
    { icon: Trophy, label: 'Regular Titles', value: agg.regularSeasonTitles, color: 'hsl(var(--gold))' },
    { icon: Award, label: 'Finals Apps', value: agg.finalsAppearances, color: 'hsl(45 90% 60%)' },
    { icon: Medal, label: '3rd Place', value: agg.thirdPlaceMedals, color: 'hsl(28 80% 55%)' },
    { icon: Sparkles, label: 'Podiums', value: agg.podiums, color: 'hsl(48 90% 60%)' },
    { icon: Gem, label: 'MVP Picks', value: mvpPicks, color: 'hsl(180 60% 55%)' },
    { icon: Flame, label: 'Hot Streak', value: longestStreak, color: 'hsl(15 80% 55%)' },
  ];
  return (
    <div>
      <SectionLabel icon={Trophy}>Trophy Case</SectionLabel>
      <div className="grid grid-cols-4 gap-1.5">
        {items.map(it => (
          <div key={it.label} className="da-glass p-2 text-center">
            <it.icon className="w-3.5 h-3.5 mx-auto mb-1" style={{ color: it.color }} />
            <p className="text-sm font-extrabold tabular-nums leading-none" style={{ color: it.value > 0 ? it.color : 'hsl(var(--muted-foreground) / 0.5)' }}>
              {it.value}
            </p>
            <p className="text-[8px] text-muted-foreground/60 font-bold mt-0.5 uppercase tracking-wider truncate">{it.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Career pulse sparkline ─── */
function CareerPulse({ points }: { points: ReturnType<typeof computeCareerPulse> }) {
  if (points.length < 2) return null;
  const scores = points.map(p => p.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const W = 320, H = 80, pad = 6;
  const innerW = W - pad * 2;
  const innerH = H - pad * 2;
  const xy = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * innerW;
    const y = pad + innerH - ((p.score - min) / range) * innerH;
    return [x, y] as const;
  });
  const path = xy.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${xy[xy.length - 1][0]} ${H - pad} L ${xy[0][0]} ${H - pad} Z`;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const trend = scores[scores.length - 1] - scores[0];
  return (
    <div>
      <SectionLabel icon={TrendingUp}>Career Pulse</SectionLabel>
      <div className="da-glass p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-wider">Score over time</p>
            <p className="text-lg font-extrabold tabular-nums">{avg.toFixed(1)} <span className="text-[10px] text-muted-foreground/60">avg</span></p>
          </div>
          <div className={cn('text-right')}>
            <p className="text-[10px] text-muted-foreground/70 font-bold uppercase tracking-wider">Trend</p>
            <p className={cn('text-sm font-extrabold tabular-nums', trend > 0 ? 'text-success' : trend < 0 ? 'text-destructive' : 'text-muted-foreground')}>
              {trend > 0 ? '↗' : trend < 0 ? '↘' : '→'} {Math.abs(trend).toFixed(1)}
            </p>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
          <defs>
            <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--gold))" stopOpacity="0.35" />
              <stop offset="100%" stopColor="hsl(var(--gold))" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#pulseFill)" />
          <path d={path} fill="none" stroke="hsl(var(--gold))" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {xy.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={points[i].rank === 1 ? 3 : 1.8}
              fill={points[i].rank === 1 ? 'hsl(var(--gold))' : 'hsl(var(--gold) / 0.6)'} />
          ))}
        </svg>
        <p className="text-[9px] text-muted-foreground/50 mt-1.5 text-center">{points.length} draft{points.length === 1 ? '' : 's'} · gold dot = win</p>
      </div>
    </div>
  );
}

/* ─── Pick quality ─── */
function PickQualityCard({ pq }: { pq: ReturnType<typeof computePickQuality> }) {
  if (pq.totalRated === 0) return null;
  const maxBucket = Math.max(...pq.histogram);
  return (
    <div>
      <SectionLabel icon={Target}>Pick Quality</SectionLabel>
      <div className="da-glass p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-base font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{pq.avgPickScore.toFixed(2)}</p>
            <p className="text-[9px] text-muted-foreground/70 font-bold mt-0.5">Avg Pick</p>
          </div>
          <div className="text-center">
            <p className="text-base font-extrabold tabular-nums text-success">{(pq.stealRate * 100).toFixed(0)}%</p>
            <p className="text-[9px] text-muted-foreground/70 font-bold mt-0.5">Steal Rate</p>
          </div>
          <div className="text-center">
            <p className="text-base font-extrabold tabular-nums text-destructive">{(pq.bustRate * 100).toFixed(0)}%</p>
            <p className="text-[9px] text-muted-foreground/70 font-bold mt-0.5">Bust Rate</p>
          </div>
        </div>
        <div>
          <div className="flex items-end gap-0.5 h-16 px-1">
            {pq.histogram.map((c, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full rounded-t transition-all"
                  style={{
                    height: `${maxBucket ? (c / maxBucket) * 100 : 0}%`,
                    background: i >= 7 ? 'hsl(var(--gold))' : i >= 5 ? 'hsl(var(--gold) / 0.5)' : 'hsl(var(--muted-foreground) / 0.35)',
                    minHeight: c > 0 ? '4px' : 0,
                  }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 px-1">
            <span className="text-[8px] text-muted-foreground/50">0</span>
            <span className="text-[8px] text-muted-foreground/50">5</span>
            <span className="text-[8px] text-muted-foreground/50">10</span>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-border/15">
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">Early</p>
            <p className="text-sm font-extrabold tabular-nums">{pq.earlyAvg.toFixed(2)}</p>
          </div>
          <div className="w-px h-8 bg-border/20" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">Late</p>
            <p className="text-sm font-extrabold tabular-nums">{pq.lateAvg.toFixed(2)}</p>
          </div>
          <div className="w-px h-8 bg-border/20" />
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">MVPs</p>
            <p className="text-sm font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{pq.topMvpPicks}</p>
          </div>
        </div>
        {pq.bestPick && (
          <div className="rounded-lg p-2.5 bg-success/10 border border-success/20">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Sparkles className="w-3 h-3 text-success" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-success">Best Pick</span>
              <span className="text-[10px] font-extrabold ml-auto tabular-nums text-success">{pq.bestPick.score.toFixed(1)}</span>
            </div>
            <p className="text-[12px] font-bold truncate">{pq.bestPick.text}</p>
            <p className="text-[9px] text-muted-foreground/60 truncate">{pq.bestPick.draftTopic}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Timing ─── */
function TimingCard({ t }: { t: ReturnType<typeof computeTiming> }) {
  if (t.sampleCount === 0) return null;
  return (
    <div>
      <SectionLabel icon={Timer}>Tempo</SectionLabel>
      <div className="da-glass p-4">
        <div className="grid grid-cols-4 gap-2">
          {[
            { l: 'Avg', v: fmtDuration(t.avgMs), c: 'hsl(var(--gold))' },
            { l: 'Fastest', v: fmtDuration(t.fastestMs), c: 'hsl(140 60% 55%)' },
            { l: 'Slowest', v: fmtDuration(t.slowestMs), c: 'hsl(28 80% 55%)' },
            { l: 'On Clock', v: fmtDuration(t.totalMs), c: 'hsl(var(--muted-foreground))' },
          ].map(s => (
            <div key={s.l} className="text-center">
              <p className="text-[12px] font-extrabold tabular-nums" style={{ color: s.c }}>{s.v}</p>
              <p className="text-[9px] text-muted-foreground/60 font-bold mt-0.5 uppercase tracking-wider">{s.l}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Leaderboard list ─── */
const LEADERBOARDS: { key: LeaderMetric; label: string; icon: any }[] = [
  { key: 'wins', label: 'Most Wins', icon: Crown },
  { key: 'championships', label: 'Most Championships', icon: Trophy },
  { key: 'podiums', label: 'Most Podiums', icon: Medal },
  { key: 'draftsPlayed', label: 'Most Drafts', icon: Users },
  { key: 'avgScore', label: 'Highest Avg Score', icon: TrendingUp },
  { key: 'highestSingleScore', label: 'Highest Single Score', icon: Sparkles },
  { key: 'consistency', label: 'Most Consistent', icon: Target },
  { key: 'mvpPicks', label: 'Most MVP Picks', icon: Gem },
  { key: 'longestStreak', label: 'Longest Hot Streak', icon: Flame },
  { key: 'fastestAvg', label: 'Fastest Average', icon: Zap },
];

function Leaderboards({ dataset, userId }: { dataset: any; userId?: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['wins', 'championships']));
  return (
    <div>
      <SectionLabel icon={BarChart3}>Leaderboards</SectionLabel>
      <div className="space-y-1.5">
        {LEADERBOARDS.map(lb => {
          const rows = computeLeaderboard(lb.key, dataset, userId).slice(0, 5);
          if (rows.length === 0) return null;
          const isOpen = expanded.has(lb.key);
          return (
            <div key={lb.key} className="da-glass overflow-hidden">
              <button
                onClick={() => setExpanded(prev => {
                  const n = new Set(prev);
                  if (n.has(lb.key)) n.delete(lb.key); else n.add(lb.key);
                  return n;
                })}
                className="w-full px-3.5 py-2.5 flex items-center gap-2 text-left">
                <lb.icon className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
                <span className="text-[12px] font-bold flex-1">{lb.label}</span>
                {!isOpen && rows[0] && (
                  <span className="text-[10px] text-muted-foreground/70 truncate max-w-[80px]">
                    {rows[0].name}
                  </span>
                )}
                <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground/60 transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="border-t border-border/15 divide-y divide-border/10">
                  {rows.map((r, i) => {
                    const isMe = r.userId === userId;
                    return (
                      <div key={r.userId} className={cn('flex items-center gap-2.5 px-3.5 py-2', isMe && 'bg-gold/8')}>
                        <span className={cn('w-5 text-center text-[11px] font-extrabold tabular-nums',
                          i === 0 ? 'text-gold' : 'text-muted-foreground/70')}>{i + 1}</span>
                        <UserAvatar name={r.name} url={r.avatar} size={22} />
                        <span className={cn('text-[12px] font-bold flex-1 truncate', isMe && 'text-gold')}>
                          {r.name}{isMe && <span className="ml-1 text-[8px] opacity-70">YOU</span>}
                        </span>
                        <span className="text-[12px] font-extrabold tabular-nums" style={{ color: i === 0 ? 'hsl(var(--gold))' : undefined }}>
                          {r.display}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Topic tendencies ─── */
function TopicTendencies({ tt }: { tt: ReturnType<typeof computeTopicTendencies> }) {
  if (tt.totalDraftsPlayed === 0) return null;
  const maxCount = Math.max(...tt.byCategory.map(c => c.count), 1);
  return (
    <div>
      <SectionLabel icon={Sparkles}>Topic Tendencies</SectionLabel>
      <div className="da-glass p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="text-center bg-muted/20 rounded-lg p-2">
            <p className="text-sm font-extrabold tabular-nums">{tt.draftsCreated}</p>
            <p className="text-[9px] text-muted-foreground/70 font-bold mt-0.5 uppercase tracking-wider">Drafts Created</p>
          </div>
          <div className="text-center bg-muted/20 rounded-lg p-2">
            <p className="text-sm font-extrabold tabular-nums">{tt.totalDraftsPlayed}</p>
            <p className="text-[9px] text-muted-foreground/70 font-bold mt-0.5 uppercase tracking-wider">Drafts Joined</p>
          </div>
        </div>
        {tt.byCategory.length > 0 && (
          <div className="space-y-1.5">
            {tt.byCategory.map(c => (
              <div key={c.category} className="flex items-center gap-2">
                <span className="text-[11px] font-bold flex-shrink-0 w-24 truncate">{c.category}</span>
                <div className="flex-1 h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full rounded-full" style={{
                    width: `${(c.count / maxCount) * 100}%`,
                    background: 'linear-gradient(90deg, hsl(var(--gold) / 0.6), hsl(var(--gold)))',
                  }} />
                </div>
                <span className="text-[11px] font-extrabold tabular-nums w-8 text-right">{c.count}</span>
                <span className="text-[10px] text-muted-foreground/60 tabular-nums w-10 text-right">{c.avgScore.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}
        {(tt.bestCategory || tt.worstCategory) && (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/15">
            {tt.bestCategory && (
              <div className="text-center">
                <p className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-wider">Best At</p>
                <p className="text-[12px] font-extrabold truncate text-success">{tt.bestCategory.category}</p>
                <p className="text-[10px] text-muted-foreground/60 tabular-nums">{tt.bestCategory.avgScore.toFixed(1)} avg</p>
              </div>
            )}
            {tt.worstCategory && (
              <div className="text-center">
                <p className="text-[9px] text-muted-foreground/70 font-bold uppercase tracking-wider">Toughest</p>
                <p className="text-[12px] font-extrabold truncate text-destructive">{tt.worstCategory.category}</p>
                <p className="text-[10px] text-muted-foreground/60 tabular-nums">{tt.worstCategory.avgScore.toFixed(1)} avg</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Fun awards ─── */
function FunAwards({ awards, userId }: { awards: ReturnType<typeof computeFunAwards>; userId?: string }) {
  if (awards.length === 0) return null;
  return (
    <div>
      <SectionLabel icon={Sparkles}>Hall of Fame</SectionLabel>
      <div className="grid grid-cols-2 gap-1.5">
        {awards.map(a => {
          const isMe = a.winnerId === userId;
          return (
            <div key={a.key}
              className={cn('da-glass p-3', isMe && 'ring-1 ring-gold/40')}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg leading-none">{a.icon}</span>
                <p className="text-[11px] font-extrabold flex-1 truncate" style={{ color: 'hsl(var(--gold))' }}>{a.title}</p>
              </div>
              <p className="text-[12px] font-bold truncate">{a.winnerName}{isMe && <span className="ml-1 text-[8px] text-gold/80">YOU</span>}</p>
              <p className="text-[9px] text-muted-foreground/70 truncate mt-0.5">{a.value}</p>
              <p className="text-[8px] text-muted-foreground/50 mt-0.5 truncate">{a.caption}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Season-by-season collapsible ─── */
function SeasonHistory({ dataset, userId }: { dataset: any; userId?: string }) {
  const rows = useMemo(() => {
    if (!userId) return [];
    return dataset.seasons
      .map((s: any) => {
        const st = dataset.standings.find((x: any) => x.season_id === s.id && x.user_id === userId);
        if (!st) return null;
        const isChampion = s.champion_user_id === userId;
        const isRunnerUp = s.runner_up_user_id === userId;
        const isThird = s.third_place_user_id === userId;
        const isRegChamp = s.regular_season_champion_user_id === userId;
        return { season: s, st, isChampion, isRunnerUp, isThird, isRegChamp };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.season.starts_at.localeCompare(a.season.starts_at));
  }, [dataset, userId]);

  if (rows.length === 0) return null;
  return (
    <div>
      <SectionLabel icon={Trophy}>Season-by-Season</SectionLabel>
      <div className="da-glass overflow-hidden divide-y divide-border/10">
        {rows.map((r: any) => (
          <div key={r.season.id} className="px-3.5 py-2.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[12px] font-bold truncate">{r.season.name}</p>
                {r.isChampion && <Crown className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />}
                {r.isRegChamp && !r.isChampion && <Trophy className="w-3 h-3 flex-shrink-0 text-muted-foreground/60" />}
              </div>
              <p className="text-[9px] text-muted-foreground/60">
                Rank {r.st.rank || '—'} · {r.st.wins}W · {r.st.podiums}P · σ {Number(r.st.consistency).toFixed(2)}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[14px] font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{r.st.season_points}</p>
              <p className="text-[8px] text-muted-foreground/60 font-bold uppercase tracking-wider">pts</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Loading skeleton ─── */
function LoadingState() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="da-glass p-5">
          <div className="h-4 rounded-lg w-1/3 mb-2.5 skeleton-shimmer" />
          <div className="h-3 rounded-lg w-1/2 skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}

/* ─── Main hub ─── */
export default function DraftStatsHub() {
  const { user } = useAuth();
  const { dataset, loading, error, refresh } = useDraftStatsHub();
  const [scope, setScope] = useState<ScopeKey>('all');

  const scoped = useMemo(() => filterDatasetByScope(dataset, scope), [dataset, scope]);

  const agg = useMemo(() => user ? computeUserAggregate(user.id, scoped) : null, [scoped, user]);
  const pq = useMemo(() => user ? computePickQuality(user.id, scoped) : null, [scoped, user]);
  const timing = useMemo(() => user ? computeTiming(user.id, scoped) : null, [scoped, user]);
  const pulse = useMemo(() => user ? computeCareerPulse(user.id, scoped) : [], [scoped, user]);
  const streak = useMemo(() => user ? computeLongestStreak(user.id, scoped) : 0, [scoped, user]);
  const tt = useMemo(() => user ? computeTopicTendencies(user.id, scoped) : null, [scoped, user]);
  const awards = useMemo(() => computeFunAwards(scoped), [scoped]);
  const nickname = useMemo(() => (agg && pq && timing) ? computeIdentity(agg, pq, timing) : 'Drafter', [agg, pq, timing]);

  const seasonChips = useMemo(() =>
    [...dataset.seasons].sort((a, b) => b.starts_at.localeCompare(a.starts_at)).map(s => ({ id: s.id, name: s.name })),
    [dataset.seasons],
  );

  if (loading) return <LoadingState />;
  if (error) return (
    <div className="da-glass p-5 text-center">
      <p className="text-[12px] font-bold mb-2">Couldn't load stats</p>
      <p className="text-[10px] text-muted-foreground mb-3">{error}</p>
      <button onClick={refresh} className="px-3 h-9 rounded-lg text-[11px] font-bold btn-press inline-flex items-center gap-1.5 bg-gold/15 text-gold">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );

  if (dataset.results.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state">
        <div className="da-page-icon" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem' }}>
          <BarChart3 className="w-7 h-7" />
        </div>
        <p className="empty-state-title">No stats yet</p>
        <p className="empty-state-desc">Complete a draft to start tracking lifetime stats, leaderboards, and awards.</p>
      </motion.div>
    );
  }

  const noPersonal = !agg || agg.draftsPlayed === 0;

  return (
    <div className="space-y-3 pb-4">
      <ScopeBar scope={scope} onScope={setScope} seasons={seasonChips} />

      {!noPersonal && agg && (
        <HeroIdentity nickname={nickname} agg={agg} totalPoints={agg.totalSeasonPoints} />
      )}

      {!noPersonal && agg && (
        <TrophyCase agg={agg} longestStreak={streak} mvpPicks={pq?.topMvpPicks || 0} />
      )}

      {pulse.length >= 2 && <CareerPulse points={pulse} />}

      {pq && pq.totalRated > 0 && <PickQualityCard pq={pq} />}

      {timing && timing.sampleCount > 0 && <TimingCard t={timing} />}

      <Leaderboards dataset={scoped} userId={user?.id} />

      {tt && <TopicTendencies tt={tt} />}

      <FunAwards awards={awards} userId={user?.id} />

      <SeasonHistory dataset={dataset} userId={user?.id} />

      <button onClick={refresh}
        className="w-full h-9 rounded-lg bg-muted/40 text-[11px] font-bold text-foreground/70 hover:bg-muted/60 btn-press flex items-center justify-center gap-1.5">
        <RefreshCw className="w-3.5 h-3.5" /> Refresh stats
      </button>
    </div>
  );
}
