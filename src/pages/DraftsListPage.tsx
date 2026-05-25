import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import {
  Bookmark, Plus, ArrowRight, Users, Play, Trophy, Award, Target, Archive,
  Calendar, TrendingUp, Crown, Swords, Shield, ChevronRight, ChevronDown,
  Medal, Sparkles, X, Loader2, RefreshCw, Flame,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getDerivedDraftTurn } from '@/lib/draftTurn';
import { springSnap, useCountUp } from '@/lib/draft/animations';
import { format, formatDistanceToNow } from 'date-fns';
import { useDraftListUpdates } from '@/hooks/useRealtimeSubscription';
import {
  useCurrentSeason,
  useSeasonStandings,
  useSeasonEntries,
  usePlayoffMatchesLive,
  usePlayoffMatchByDraftIds,
  useLifetimeStats,
  useIsCommissioner,
  useUnassignedDrafts,
  addDraftToSeason,
  removeDraftFromSeason,
  recalculateSeasonStandings,
  advancePlayoffs,
  suggestPlayoffTopics,
  startPlayoffMatch,
  getSeasonDraftTarget,
  type SeasonStanding,
  type PlayoffMatch,
} from '@/hooks/useDraftSeasons';
import {
  getOrdinalSuffix,
  getDraftLabel,
  getSeasonProgressText,
} from '@/lib/seasonUtils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { PlayoffBadge } from '@/components/draft/PlayoffBadge';
import { getPlayoffGameLabel } from '@/lib/playoffStyle';
import { StartNextSeasonSheet } from '@/components/draft/StartNextSeasonSheet';

import { forwardRef } from 'react';

const CountedNumber = forwardRef<HTMLSpanElement, { value: number }>(function CountedNumber({ value }, ref) {
  const animated = useCountUp(value);
  return <span ref={ref}>{Math.round(animated)}</span>;
});

/* ══════════════════════════════════════════════════════════
   SEASON HEADER CARD
   ══════════════════════════════════════════════════════════ */
function SeasonHeaderCard({ season, entries }: { season: any; entries: any[] }) {
  const statusLabels: Record<string, { label: string; cls: string; dotCls: string }> = {
    upcoming: { label: 'Upcoming', cls: 'bg-muted text-muted-foreground', dotCls: 'bg-muted-foreground' },
    regular_season: { label: 'Regular Season', cls: 'bg-success/15 text-success border border-success/20', dotCls: 'bg-success' },
    playoffs: { label: 'Playoffs', cls: 'bg-gold/15 text-gold border border-gold/20', dotCls: 'bg-gold' },
    complete: { label: 'Complete', cls: 'bg-primary/10 text-primary', dotCls: 'bg-primary' },
  };
  const st = statusLabels[season.status] || statusLabels.upcoming;
  const isActive = season.status === 'regular_season' || season.status === 'playoffs';
  const totalDrafts = getSeasonDraftTarget(season);
  const completedDrafts = entries.filter(e => !e.is_playoff && e.drafts?.status === 'complete').length;
  const progressPct = totalDrafts > 0 ? Math.round((completedDrafts / totalDrafts) * 100) : 0;
  const progressText = getSeasonProgressText(completedDrafts, totalDrafts, season.status);

  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
      <div className="relative rounded-xl overflow-hidden">
        <div className="absolute inset-0 rounded-xl" style={{ background: 'var(--gradient-hero-gold)' }} />
        <div className="absolute inset-0 rounded-xl" style={{ background: 'var(--gradient-hero-gold-accent)' }} />
        <div className="glass-card p-0 relative overflow-hidden border-gold/10" style={{
          backgroundImage: 'var(--gradient-arena-edge-gold)',
          boxShadow: 'var(--shadow-gold)',
        }}>
          <div className="relative z-10 p-5 pb-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="font-extrabold text-xl tracking-tight leading-tight">{season.name}</h2>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {format(new Date(season.starts_at), 'MMM d')} — {format(new Date(season.ends_at), 'MMM d, yyyy')}
                </p>
              </div>
              <span className={cn('status-pill flex items-center gap-1.5 text-[10px] px-2.5 py-1', st.cls)}>
                {isActive && (
                  <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', st.dotCls)} />
                )}
                {st.label}
              </span>
            </div>
            <div className="flex items-center gap-0 mt-4 rounded-lg bg-muted/25 p-2.5">
              <div className="flex-1 text-center">
                <p className="text-sm font-extrabold tabular-nums">{totalDrafts}</p>
                <p className="text-[8px] text-muted-foreground/60 font-bold uppercase tracking-wider">Reg Drafts</p>
              </div>
              <div className="w-px h-7 bg-border/20" />
              <div className="flex-1 text-center">
                <p className="text-sm font-extrabold tabular-nums">Best {season.best_of}</p>
                <p className="text-[8px] text-muted-foreground/60 font-bold uppercase tracking-wider">Count</p>
              </div>
              <div className="w-px h-7 bg-border/20" />
              <div className="flex-1 text-center">
                <p className="text-sm font-extrabold tabular-nums">All 5</p>
                <p className="text-[8px] text-muted-foreground/60 font-bold uppercase tracking-wider">Playoffs</p>
              </div>
            </div>
            {season.status !== 'complete' && (
              <div className="mt-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-bold text-muted-foreground/70">{progressText}</span>
                  <span className="text-[9px] font-bold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                    {season.status === 'playoffs' ? 'Playoffs' : `Draft ${completedDrafts} of ${totalDrafts}`}
                  </span>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${season.status === 'playoffs' ? 100 : progressPct}%`,
                      background: 'linear-gradient(90deg, hsl(var(--gold) / 0.7), hsl(var(--gold)))',
                      boxShadow: '0 0 8px hsl(var(--gold) / 0.3)',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   NEXT DRAFT CARD
   ══════════════════════════════════════════════════════════ */
function NextDraftCard({ entries, totalDrafts }: { entries: any[]; totalDrafts: number }) {
  const regularEntries = entries.filter(e => !e.is_playoff);
  const completedCount = regularEntries.filter(e => e.drafts?.status === 'complete').length;
  const nextDraftNumber = completedCount + 1;
  const isRegularSeasonComplete = completedCount >= totalDrafts;
  const currentEntry = regularEntries.find(e => e.drafts?.status !== 'complete');
  const latestEntry = currentEntry || regularEntries[regularEntries.length - 1];
  const isLive = latestEntry?.drafts?.status === 'in_progress';
  const label = isRegularSeasonComplete ? 'Regular Season Complete' : getDraftLabel(nextDraftNumber, totalDrafts);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
      <div className={cn('glass-card p-4 relative overflow-hidden', isLive && 'border-success/20')}
        style={{ borderLeft: '3px solid hsl(var(--gold))' }}>
        <div className="flex items-center gap-2 mb-3">
          <Bookmark className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
          <h3 className="font-bold text-[13px]">{label}</h3>
          {isLive && (
            <StatusPill variant="live" size="xs" dot pulse>LIVE</StatusPill>
          )}
          {!isRegularSeasonComplete && (
            <span className="text-[9px] text-muted-foreground/60 ml-auto tabular-nums">
              Draft {Math.min(nextDraftNumber, totalDrafts)} of {totalDrafts}
            </span>
          )}
        </div>
        {latestEntry && !isRegularSeasonComplete ? (
          latestEntry.drafts?.status !== 'complete' ? (
            <Link to={`/drafts/${latestEntry.draft_id}`}>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <Bookmark className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate">{latestEntry.drafts?.topic || 'Draft'}</p>
                  <span className={cn('status-pill text-[9px] mt-1 inline-flex',
                    latestEntry.drafts?.status === 'in_progress' ? 'bg-success/12 text-success' : 'bg-muted text-muted-foreground')}>
                    {latestEntry.drafts?.status === 'in_progress' ? 'In Progress' : latestEntry.drafts?.status || 'Unknown'}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60" />
              </div>
            </Link>
          ) : (
            <div className="text-center py-4">
              <p className="text-[11px] text-muted-foreground/70 mb-3">No draft assigned yet</p>
              <Link to="/drafts/create">
                <button className="w-full h-10 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2 btn-press"
                  style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.15)' }}>
                  <Plus className="w-4 h-4" /> Create Draft {nextDraftNumber}
                </button>
              </Link>
            </div>
          )
        ) : isRegularSeasonComplete ? (
          <div className="text-center py-3">
            <p className="text-[12px] font-bold" style={{ color: 'hsl(var(--gold))' }}>
              🏆 All {totalDrafts} regular-season drafts complete
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Playoffs are unlocked!</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-[11px] text-muted-foreground/70 mb-3">No draft assigned yet</p>
            <Link to="/drafts/create">
              <button className="w-full h-10 rounded-lg text-[12px] font-bold transition-colors flex items-center justify-center gap-2 btn-press"
                style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.15)' }}>
                <Plus className="w-4 h-4" /> Create Draft {nextDraftNumber}
              </button>
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   STANDINGS CARD
   ══════════════════════════════════════════════════════════ */
function StandingsCard({ standings, userId }: { standings: SeasonStanding[]; userId?: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (standings.length === 0) {
    return (
      <div className="glass-card p-6 text-center">
        <Trophy className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No standings yet — complete a draft to get on the board.</p>
      </div>
    );
  }

  const leaderPts = standings[0]?.season_points || 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
      <div className="glass-card overflow-hidden" style={{ boxShadow: 'var(--shadow-elevated)' }}>
        <div className="p-3.5 border-b border-border/20">
          <h3 className="font-bold text-[13px] flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} />
            Season Standings
          </h3>
        </div>
        <div className="divide-y divide-border/10">
          {standings.map((s, i) => {
            const isMe = s.user_id === userId;
            const isExpanded = expanded === s.id;
            const rank = s.rank || i + 1;
            const isPodium = rank <= 3;
            const gap = rank === 1 ? null : leaderPts - s.season_points;
            const seedBg =
              s.playoff_seed === 1 ? 'hsl(var(--gold))' :
              s.playoff_seed === 2 ? 'hsl(var(--silver))' :
              s.playoff_seed === 3 ? 'hsl(var(--bronze))' :
              'hsl(var(--muted-foreground))';

            return (
              <div key={s.id}>
                <button
                  type="button"
                  className={cn('flex items-center gap-3 px-4 py-3.5 transition-colors cursor-pointer w-full text-left',
                    rank === 1 && 'relative', isMe && !isPodium && 'border-l-2 border-l-gold/40')}
                  style={rank === 1 ? { background: 'linear-gradient(90deg, hsl(var(--gold) / 0.08), transparent)' } : undefined}
                  onClick={() => setExpanded(isExpanded ? null : s.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="w-7 flex-shrink-0 flex items-center justify-center">
                    {isPodium ? (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold"
                        style={{ background: `${seedBg}20`, color: seedBg, border: `1.5px solid ${seedBg}40` }}>
                        {rank}
                      </div>
                    ) : (
                      <span className="text-[12px] font-bold text-muted-foreground">{rank}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={cn('text-[13px] font-bold truncate', isMe && 'text-gold', rank === 1 && !isMe && 'text-foreground')}>
                        {(s.profiles as any)?.display_name || 'Unknown'}
                      </p>
                      {isMe && <span className="text-[8px] text-muted-foreground bg-gold/10 px-1 py-0.5 rounded font-bold">YOU</span>}
                      {rank === 1 && <Crown className="w-3 h-3 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">{s.drafts_played} drafted</span>
                      <span className="text-[9px] text-muted-foreground">·</span>
                      <span className="text-[9px] text-muted-foreground">{s.wins}W {s.podiums}P</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>{s.season_points}</p>
                    {gap !== null ? (
                      <p className="text-[8px] text-muted-foreground/50 tabular-nums font-bold">-{gap} pts</p>
                    ) : (
                      <p className="text-[8px] font-bold uppercase" style={{ color: 'hsl(var(--gold) / 0.6)' }}>Leader</p>
                    )}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 pt-0">
                    <div className="grid grid-cols-4 gap-px rounded-lg overflow-hidden bg-border/10">
                      {[
                        { v: s.avg_finish.toFixed(1), l: 'Avg Finish' },
                        { v: s.avg_score.toFixed(1), l: 'Avg Score' },
                        { v: s.best_score.toFixed(1), l: 'Best', cls: 'text-success' },
                        { v: s.worst_score.toFixed(1), l: 'Worst', cls: 'text-destructive' },
                      ].map(stat => (
                        <div key={stat.l} className="text-center bg-muted/30 p-2.5">
                          <p className={cn('text-[12px] font-bold tabular-nums', stat.cls)}>{stat.v}</p>
                          <p className="text-[7px] text-muted-foreground/60 font-bold uppercase tracking-wider">{stat.l}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   TOPIC PICKER DIALOG
   ══════════════════════════════════════════════════════════ */
function TopicPickerDialog({ open, onOpenChange, seasonId, match, onStarted }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  seasonId: string; match: PlayoffMatch; onStarted: () => void;
}) {
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const fetchTopics = useCallback(async () => {
    setLoading(true); setTopics([]);
    try {
      const list = await suggestPlayoffTopics(seasonId, match.id);
      setTopics(list);
    } catch (err: any) {
      toast.error(err.message || 'Failed to get suggestions');
    } finally { setLoading(false); }
  }, [seasonId, match.id]);

  useEffect(() => { if (open) fetchTopics(); }, [open, fetchTopics]);

  const handlePick = async (topic: string) => {
    setSubmitting(topic);
    try {
      await startPlayoffMatch(match.id, topic);
      toast.success('Matchup created!');
      onOpenChange(false); onStarted();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start matchup');
    } finally { setSubmitting(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Sparkles className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
            Choose your matchup topic
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {match.round === 'final' && match.match_number === 2
              ? 'As the lower seed, you pick the topic for Game 2.'
              : 'As the higher seed, you get to pick the topic for this draft.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg skeleton-shimmer" />)}
            </div>
          ) : (
            <>
              {topics.map(t => (
                <button key={t} onClick={() => handlePick(t)} disabled={!!submitting}
                  className="w-full text-left p-3 rounded-lg border border-border/30 hover:border-gold/40 hover:bg-gold/5 transition-all disabled:opacity-40">
                  <p className="font-bold text-[13px]">{t}</p>
                  {submitting === t && (
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Creating draft…
                    </p>
                  )}
                </button>
              ))}
              <button onClick={fetchTopics} disabled={loading || !!submitting}
                className="w-full mt-2 h-9 rounded-lg bg-muted/50 text-[11px] font-bold text-foreground/80 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40">
                <RefreshCw className="w-3 h-3" /> Regenerate options
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════
   PLAYOFF FORMAT GUIDE
   ══════════════════════════════════════════════════════════ */
function PlayoffFormatGuide({ embedded = false }: { embedded?: boolean }) {
  const rules = [
    { icon: <Users className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />, label: 'Field', body: 'Top 5 in Season Points qualify. #1, #2, #3 get a first-round bye.' },
    { icon: <Swords className="w-3 h-3" style={{ color: 'hsl(var(--primary))' }} />, label: 'Bracket', body: 'Play-In: #4 vs #5 (Bo1). Semis: #1 vs Play-In winner & #2 vs #3 (Bo1 each).' },
    { icon: <Crown className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />, label: 'Final', body: 'Best-of-3. First to 2 game wins is Champion.' },
    { icon: <Award className="w-3 h-3" style={{ color: 'hsl(var(--bronze))' }} />, label: '3rd Place', body: 'Bo1 between the two semifinal losers — the winner takes bronze.' },
    { icon: <Sparkles className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />, label: 'Topic Picker', body: 'Higher seed picks the draft topic. In the Final, picker rotates: G1 higher, G2 lower, G3 higher.' },
    { icon: <Target className="w-3 h-3" style={{ color: 'hsl(var(--success))' }} />, label: 'Tiebreaks', body: 'Match winner = highest draft score. Series clinched at 2 wins ends the Final.' },
  ];
  return (
    <div className={cn(embedded ? 'mt-3' : 'mt-4 pt-3 border-t border-border/15')}>
      <div className="flex items-center gap-1.5 mb-2">
        <Trophy className="w-3 h-3" style={{ color: 'hsl(var(--gold))' }} />
        <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'hsl(var(--gold))' }}>Playoff Format</p>
      </div>
      <ul className="space-y-1.5">
        {rules.map(r => (
          <li key={r.label} className="flex items-start gap-2 p-2 rounded-md bg-muted/20">
            <span className="mt-0.5 flex-shrink-0">{r.icon}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold leading-tight">{r.label}</p>
              <p className="text-[10px] text-muted-foreground/80 leading-snug mt-0.5">{r.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   PLAYOFF PICTURE
   ══════════════════════════════════════════════════════════ */
function PlayoffPicture({ standings, matches, seasonId }: { standings: SeasonStanding[]; matches: PlayoffMatch[]; seasonId: string | undefined }) {
  const { user } = useAuth();
  const [pickerMatch, setPickerMatch] = useState<PlayoffMatch | null>(null);
  const seeds = standings.filter(s => s.playoff_seed).sort((a, b) => (a.playoff_seed || 99) - (b.playoff_seed || 99));
  const getName = (seed: number) => { const s = seeds.find(s => s.playoff_seed === seed); return s ? (s.profiles as any)?.display_name || '?' : 'TBD'; };
  const getNameByUser = (userId: string | null) => { if (!userId) return 'TBD'; const s = standings.find(s => s.user_id === userId); return (s?.profiles as any)?.display_name || '?'; };

  if (seeds.length === 0 && matches.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
        <div className="glass-card p-4">
          <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-3">
            <Crown className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} /> Playoff Picture
          </h3>
          <p className="text-[11px] text-muted-foreground/70 text-center py-3">Complete all regular-season drafts to unlock playoffs.</p>
        </div>
      </motion.div>
    );
  }

  const qfMatches = matches.filter(m => m.round === 'qf').sort((a, b) => a.match_number - b.match_number);
  const sfMatches = matches.filter(m => m.round === 'sf').sort((a, b) => a.match_number - b.match_number);
  const finalMatches = matches.filter(m => m.round === 'final').sort((a, b) => a.match_number - b.match_number);
  const thirdPlaceMatch = matches.find(m => m.round === 'third_place');

  const finalWinCount: Record<string, number> = {};
  for (const m of finalMatches) {
    if (m.status === 'complete' && m.winner_user_id) finalWinCount[m.winner_user_id] = (finalWinCount[m.winner_user_id] || 0) + 1;
  }
  const finalsPlayers = finalMatches[0] ? [finalMatches[0].user_a, finalMatches[0].user_b] : [];
  const champion = finalsPlayers.find(p => p && (finalWinCount[p] || 0) >= 2) || null;
  const seriesScore = finalsPlayers.length === 2 ? `${finalWinCount[finalsPlayers[0]!] || 0}–${finalWinCount[finalsPlayers[1]!] || 0}` : null;

  const MatchCard = ({ m, placeholder, gameLabel }: { m?: PlayoffMatch; placeholder?: { roundLabel: string }; gameLabel?: string }) => {
    if (!m) {
      return (
        <div className="rounded-lg bg-muted/20 p-2.5 border border-dashed border-border/20 text-center">
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider">{placeholder?.roundLabel}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">Awaiting prior round</p>
        </div>
      );
    }
    const isAwaitingTopic = m.status === 'awaiting_topic';
    const isCallerPicker = isAwaitingTopic && user?.id === m.topic_picker_user_id;
    const pickerName = getNameByUser(m.topic_picker_user_id);
    let statusLabel = 'Pending';
    let statusClass = 'bg-muted text-muted-foreground';
    if (m.status === 'complete') { statusLabel = 'Final'; statusClass = 'bg-primary/15 text-primary'; }
    else if (m.status === 'in_progress') { statusLabel = 'Live'; statusClass = 'bg-success/15 text-success'; }
    else if (isAwaitingTopic) { statusLabel = 'Topic'; statusClass = 'bg-gold/15 text-gold'; }
    return (
      <div className="rounded-lg bg-muted/30 p-2.5 border border-border/15 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">{gameLabel || `M${m.match_number}`}</span>
          <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded', statusClass)}>{statusLabel}</span>
        </div>
        <div className="space-y-0.5">
          <p className={cn('text-[10px] font-bold flex items-center gap-1', m.winner_user_id === m.user_a && 'text-gold')}>
            <span className="text-muted-foreground/70">#{m.seed_a}</span>
            <span className="truncate">{getNameByUser(m.user_a)}</span>
            {m.winner_user_id === m.user_a && <Trophy className="w-2.5 h-2.5 ml-auto" style={{ color: 'hsl(var(--gold))' }} />}
          </p>
          <p className={cn('text-[10px] font-bold flex items-center gap-1', m.winner_user_id === m.user_b && 'text-gold')}>
            <span className="text-muted-foreground/70">#{m.seed_b}</span>
            <span className="truncate">{getNameByUser(m.user_b)}</span>
            {m.winner_user_id === m.user_b && <Trophy className="w-2.5 h-2.5 ml-auto" style={{ color: 'hsl(var(--gold))' }} />}
          </p>
        </div>
        {isAwaitingTopic && isCallerPicker && (
          <button onClick={() => setPickerMatch(m)} className="block w-full text-[9px] font-bold text-center py-1 rounded bg-gold/15 hover:bg-gold/25 transition-colors flex items-center justify-center gap-1" style={{ color: 'hsl(var(--gold))' }}>
            <Sparkles className="w-2.5 h-2.5" /> Choose topic
          </button>
        )}
        {isAwaitingTopic && !isCallerPicker && (
          <p className="text-[9px] text-center py-1 text-muted-foreground/70 italic truncate">Waiting for {pickerName}…</p>
        )}
        {m.draft_id && (
          <Link to={`/drafts/${m.draft_id}`} className="block">
            <div className="text-[9px] font-bold text-center py-1 rounded bg-gold/10 hover:bg-gold/15 transition-colors flex items-center justify-center gap-1" style={{ color: 'hsl(var(--gold))' }}>
              Open Draft <ChevronRight className="w-2.5 h-2.5" />
            </div>
          </Link>
        )}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
      <div className="glass-card p-4">
        <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-4">
          <Crown className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} /> Playoff Picture
        </h3>
        {champion && (
          <div className="mb-4 p-3 rounded-lg text-center" style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.2), hsl(var(--gold) / 0.05))', border: '1px solid hsl(var(--gold) / 0.3)' }}>
            <Trophy className="w-6 h-6 mx-auto mb-1" style={{ color: 'hsl(var(--gold))' }} />
            <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Champion</p>
            <p className="text-[14px] font-black mt-0.5" style={{ color: 'hsl(var(--gold))' }}>{getNameByUser(champion)}</p>
            {seriesScore && <p className="text-[10px] text-muted-foreground mt-1">Series {seriesScore}</p>}
          </div>
        )}
        {matches.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center">Play-In</p>
                <MatchCard m={qfMatches[0]} placeholder={{ roundLabel: 'Play-In' }} />
              </div>
              <div className="space-y-2">
                <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center">Semis</p>
                <MatchCard m={sfMatches[0]} placeholder={{ roundLabel: 'SF 1' }} />
                <MatchCard m={sfMatches[1]} placeholder={{ roundLabel: 'SF 2' }} />
              </div>
              <div className="space-y-2">
                <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50 text-center">Final · Bo3</p>
                {seriesScore && finalMatches.length > 0 && !champion && (
                  <p className="text-[8px] font-bold text-center text-gold">Series {seriesScore}</p>
                )}
                {finalMatches.length === 0 ? (
                  <MatchCard placeholder={{ roundLabel: 'Final' }} />
                ) : (
                  finalMatches.map(fm => <MatchCard key={fm.id} m={fm} gameLabel={`Game ${fm.match_number}`} />)
                )}
              </div>
            </div>
            {sfMatches.length === 2 && sfMatches.every(m => m.status === 'complete') && (
              <div className="mt-3 pt-3 border-t border-border/15">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <Award className="w-3 h-3" style={{ color: 'hsl(var(--bronze))' }} />
                  <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/70 text-center">3rd Place · Bo1</p>
                </div>
                <div className="max-w-[200px] mx-auto">
                  {thirdPlaceMatch ? <MatchCard m={thirdPlaceMatch} gameLabel="3rd Place" /> : <MatchCard placeholder={{ roundLabel: '3rd Place' }} />}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 mb-3">
              {['Play-In', 'Semis', 'Finals'].map(r => (
                <div key={r} className="text-center"><span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/50">{r}</span></div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <div className="rounded-lg bg-muted/30 p-2.5 border border-border/10">
                <p className="text-[10px] font-bold">#{4} <span className="text-muted-foreground font-normal">{getName(4)}</span></p>
                <p className="text-[10px] font-bold mt-1">#{5} <span className="text-muted-foreground font-normal">{getName(5)}</span></p>
              </div>
              <div className="rounded-lg bg-muted/30 p-2.5 border border-border/10">
                <p className="text-[10px] font-bold">#{1} <span className="text-muted-foreground font-normal">{getName(1)}</span></p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))' }}>BYE</span>
                </div>
                <div className="h-px bg-border/20 my-1.5" />
                <p className="text-[9px] text-muted-foreground">vs Play-In ✦</p>
              </div>
              <div className="rounded-lg p-2.5 border border-gold/15" style={{ background: 'hsl(var(--gold) / 0.05)' }}>
                <div className="text-center">
                  <Trophy className="w-4 h-4 mx-auto mb-1" style={{ color: 'hsl(var(--gold) / 0.5)' }} />
                  <p className="text-[9px] font-bold" style={{ color: 'hsl(var(--gold))' }}>Championship</p>
                  <p className="text-[8px] text-muted-foreground mt-0.5">Best of 3</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 items-center">
              <div />
              <div className="rounded-lg bg-muted/30 p-2.5 border border-border/10">
                <p className="text-[10px] font-bold">#{2} <span className="text-muted-foreground font-normal">{getName(2)}</span></p>
                <div className="h-px bg-border/20 my-1.5" />
                <p className="text-[10px] font-bold">#{3} <span className="text-muted-foreground font-normal">{getName(3)}</span></p>
              </div>
              <div />
            </div>
            <div className="flex items-center justify-center gap-1.5 pt-2">
              <Award className="w-3 h-3" style={{ color: 'hsl(var(--bronze))' }} />
              <p className="text-[9px] font-bold" style={{ color: 'hsl(var(--bronze))' }}>3rd Place · Bo1</p>
              <span className="text-[9px] text-muted-foreground/60">— SF losers face off</span>
            </div>
          </div>
        )}
      </div>
      {pickerMatch && seasonId && (
        <TopicPickerDialog
          open={!!pickerMatch}
          onOpenChange={(v) => { if (!v) setPickerMatch(null); }}
          seasonId={seasonId}
          match={pickerMatch}
          onStarted={() => {}}
        />
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   PLAYOFF CONTROL CENTER
   ══════════════════════════════════════════════════════════ */
function PlayoffControlCenter({ season, matches, standings, userId, onUpdate }: {
  season: any; matches: PlayoffMatch[]; standings: SeasonStanding[];
  userId: string | undefined; onUpdate: () => void;
}) {
  const [pickerMatch, setPickerMatch] = useState<PlayoffMatch | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [hasReadyWork, setHasReadyWork] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(true);

  const seasonId = season?.id as string | undefined;
  const onboardingKey = seasonId ? `playoff_onboarding_dismissed_${seasonId}` : null;

  useEffect(() => { if (!onboardingKey) return; setOnboardingDismissed(localStorage.getItem(onboardingKey) === '1'); }, [onboardingKey]);
  const dismissOnboarding = () => { if (onboardingKey) localStorage.setItem(onboardingKey, '1'); setOnboardingDismissed(true); };

  const getNameByUser = useCallback((uid: string | null): string => {
    if (!uid) return 'TBD';
    const s = standings.find(s => s.user_id === uid);
    return (s?.profiles as any)?.display_name || '?';
  }, [standings]);

  useEffect(() => {
    if (!seasonId) { setHasReadyWork(false); return; }
    const candidateDraftIds = matches.filter(m => m.draft_id && m.status !== 'complete').map(m => m.draft_id as string);
    if (candidateDraftIds.length === 0) { setHasReadyWork(false); return; }
    let cancelled = false;
    supabase.from('drafts').select('id, status').in('id', candidateDraftIds).then(({ data }) => {
      if (cancelled) return;
      setHasReadyWork((data || []).some((d: any) => d.status === 'complete'));
    });
    return () => { cancelled = true; };
  }, [seasonId, matches]);

  const handleAdvance = async () => {
    if (!seasonId) return;
    setAdvancing(true);
    try {
      const res: any = await advancePlayoffs(seasonId);
      if (res?.log?.length) toast.success(`Playoffs: ${res.log.join(' • ')}`);
      else toast.success('Up to date');
      onUpdate();
    } catch (err: any) { toast.error(err.message || 'Failed to advance'); }
    finally { setAdvancing(false); }
  };

  const roundLabelForMatch = (m: PlayoffMatch): string => {
    if (m.round === 'qf') return 'Play-In';
    if (m.round === 'sf') return `Semi ${m.match_number}`;
    if (m.round === 'final') return `Final · G${m.match_number}`;
    if (m.round === 'third_place') return '3rd Place';
    return m.round;
  };

  const order: Record<string, number> = { awaiting_topic: 0, in_progress: 1, pending: 2, complete: 3 };
  const activeMatches = [...matches].filter(m => m.status !== 'complete').sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9)).slice(0, 3);

  const sfDone = matches.filter(m => m.round === 'sf' && m.status === 'complete').length;
  const finalWinByUser: Record<string, number> = {};
  for (const m of matches) {
    if (m.round === 'final' && m.status === 'complete' && m.winner_user_id)
      finalWinByUser[m.winner_user_id] = (finalWinByUser[m.winner_user_id] || 0) + 1;
  }
  const champion = Object.entries(finalWinByUser).find(([, n]) => n >= 2)?.[0] || null;
  const playoffsStarted = season?.status === 'playoffs' || matches.length > 0;
  const playInDone = matches.some(m => m.round === 'qf' && m.status === 'complete') || sfDone > 0;

  type StepState = 'done' | 'active' | 'todo';
  const steps: { label: string; state: StepState }[] = [
    { label: 'Regular', state: playoffsStarted ? 'done' : 'active' },
    { label: 'Play-In', state: !playoffsStarted ? 'todo' : (playInDone ? 'done' : 'active') },
    { label: 'Semis', state: !playInDone ? 'todo' : (sfDone >= 2 ? 'done' : 'active') },
    { label: 'Finals', state: sfDone < 2 ? 'todo' : (champion ? 'done' : 'active') },
    { label: 'Champ', state: champion ? 'done' : 'todo' },
  ];

  if (champion) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
        <div className="rounded-2xl p-4 text-center"
          style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.04))', border: '1px solid hsl(var(--gold) / 0.35)' }}>
          <Trophy className="w-7 h-7 mx-auto mb-1.5" style={{ color: 'hsl(var(--gold))' }} />
          <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Season Champion</p>
          <p className="text-[16px] font-black mt-1" style={{ color: 'hsl(var(--gold))' }}>{getNameByUser(champion)}</p>
          <p className="text-[10px] text-muted-foreground/80 mt-1">Playoffs complete — see the bracket below for full results.</p>
        </div>
      </motion.div>
    );
  }

  const showOnboarding = season?.status === 'playoffs' && !onboardingDismissed && matches.filter(m => m.status === 'complete').length === 0;
  const statusPillLabel = season?.status === 'playoffs' ? 'Playoffs Live' : season?.status === 'regular_season' ? 'Regular Season' : 'Off-season';
  const statusPillTone = season?.status === 'playoffs' ? 'gold' : 'muted';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
      <div className="glass-card overflow-hidden" style={{ border: '1px solid hsl(var(--gold) / 0.22)' }}>
        <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ background: 'hsl(var(--gold) / 0.06)', borderBottom: '1px solid hsl(var(--border) / 0.4)' }}>
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
            <h3 className="font-bold text-[13px] truncate">Playoff Control Center</h3>
          </div>
          <span className={cn('text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full', statusPillTone === 'gold' ? 'text-gold' : 'text-muted-foreground')}
            style={{ background: statusPillTone === 'gold' ? 'hsl(var(--gold) / 0.15)' : 'hsl(var(--muted) / 0.6)' }}>
            {statusPillLabel}
          </span>
        </div>

        {showOnboarding && (
          <div className="px-3 py-2 flex items-start gap-2" style={{ background: 'hsl(var(--gold) / 0.08)', borderBottom: '1px solid hsl(var(--border) / 0.3)' }}>
            <span className="text-[14px] leading-none mt-0.5">🏆</span>
            <p className="text-[10.5px] leading-snug flex-1 text-foreground/80">
              Playoffs have started! <strong>Higher seeds pick topics</strong>, then both players draft.
            </p>
            <button onClick={dismissOnboarding} className="text-muted-foreground/60 hover:text-foreground transition-colors p-0.5" aria-label="Dismiss">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <div className="px-3 pt-3">
          <div className="flex items-center justify-between gap-1">
            {steps.map((s, i) => (
              <div key={s.label} className="flex items-center flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold',
                    s.state === 'done' && 'bg-success/20 text-success',
                    s.state === 'active' && 'text-gold',
                    s.state === 'todo' && 'bg-muted/40 text-muted-foreground/50')}
                    style={s.state === 'active' ? { background: 'hsl(var(--gold) / 0.18)', boxShadow: '0 0 0 2px hsl(var(--gold) / 0.25)' } : undefined}>
                    {s.state === 'done' ? '✓' : i + 1}
                  </div>
                  <span className={cn('text-[8.5px] font-bold uppercase tracking-wider truncate',
                    s.state === 'active' && 'text-gold',
                    s.state === 'done' && 'text-foreground/70',
                    s.state === 'todo' && 'text-muted-foreground/50')}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={cn('h-px flex-shrink-0 w-2 -mt-3.5', s.state === 'done' ? 'bg-success/40' : 'bg-border/30')} />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="p-3 space-y-2">
          {activeMatches.length === 0 ? (
            <div className="rounded-lg bg-muted/20 p-3 text-center">
              <p className="text-[11px] font-bold text-foreground/80">
                {season?.status === 'playoffs' ? 'Awaiting next round' : 'Regular season in progress'}
              </p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">
                {season?.status === 'playoffs' ? 'Matches will appear here as soon as the next round is created.' : 'Once all regular drafts complete, playoffs unlock automatically.'}
              </p>
            </div>
          ) : (
            activeMatches.map(m => {
              const isPicker = m.status === 'awaiting_topic' && userId && userId === m.topic_picker_user_id;
              const pickerName = getNameByUser(m.topic_picker_user_id);
              const aName = getNameByUser(m.user_a);
              const bName = getNameByUser(m.user_b);
              const isFinalsG2 = m.round === 'final' && m.match_number === 2;
              const pickerRoleLabel = isFinalsG2 ? 'lower seed' : 'higher seed';
              let statusSentence = '';
              if (m.status === 'awaiting_topic') statusSentence = isPicker ? `You're the ${pickerRoleLabel} for this game — choose the draft topic to begin.` : `Waiting for ${pickerName} (${pickerRoleLabel}) to choose a topic.`;
              else if (m.status === 'in_progress') statusSentence = 'Draft is live — make your picks before the timer runs out.';
              else if (m.status === 'pending') statusSentence = 'Match created — open the draft to start picking.';
              return (
                <div key={m.id} className="rounded-lg p-3 border space-y-2"
                  style={{ background: 'hsl(var(--muted) / 0.25)', borderColor: m.status === 'awaiting_topic' ? 'hsl(var(--gold) / 0.3)' : 'hsl(var(--border) / 0.3)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">{roundLabelForMatch(m)}</span>
                    <span className={cn('text-[8.5px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
                      m.status === 'awaiting_topic' && 'bg-gold/15 text-gold',
                      m.status === 'in_progress' && 'bg-success/15 text-success',
                      m.status === 'pending' && 'bg-muted text-muted-foreground')}>
                      {m.status === 'awaiting_topic' ? 'Pick Topic' : m.status === 'in_progress' ? 'Live' : 'Pending'}
                    </span>
                  </div>
                  <p className="text-[11.5px] font-bold leading-snug">
                    <span className="text-muted-foreground/70 font-semibold">#{m.seed_a}</span> {aName}
                    <span className="text-muted-foreground mx-1.5">vs</span>
                    <span className="text-muted-foreground/70 font-semibold">#{m.seed_b}</span> {bName}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground/85 leading-snug">{statusSentence}</p>
                  {m.status === 'awaiting_topic' && isPicker && (
                    <button onClick={() => setPickerMatch(m)} className="w-full h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 btn-press transition-colors" style={{ background: 'hsl(var(--gold) / 0.18)', color: 'hsl(var(--gold))' }}>
                      <Sparkles className="w-3.5 h-3.5" /> Choose Topic
                    </button>
                  )}
                  {m.status === 'awaiting_topic' && !isPicker && (
                    <button onClick={() => toast.success(`Reminder sent to ${pickerName}`)} className="w-full h-9 rounded-lg text-[11px] font-bold bg-muted/50 text-foreground/70 hover:bg-muted/70 transition-colors flex items-center justify-center gap-1.5">
                      Nudge {pickerName}
                    </button>
                  )}
                  {(m.status === 'in_progress' || m.status === 'pending') && m.draft_id && (
                    <Link to={`/drafts/${m.draft_id}`} className="block">
                      <button className="w-full h-9 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 btn-press transition-colors" style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))' }}>
                        Open Draft <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-3 pb-3 space-y-2">
          <button onClick={handleAdvance} disabled={advancing}
            className="w-full h-10 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 btn-press transition-all disabled:opacity-50"
            style={{ background: hasReadyWork ? 'hsl(var(--gold) / 0.22)' : 'hsl(var(--muted) / 0.5)', color: hasReadyWork ? 'hsl(var(--gold))' : 'hsl(var(--muted-foreground))', boxShadow: hasReadyWork ? '0 0 0 1px hsl(var(--gold) / 0.3)' : undefined }}>
            {advancing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Advancing…</> : <><Trophy className="w-3.5 h-3.5" /> Advance Playoffs</>}
          </button>
          <p className="text-[10px] text-muted-foreground/70 text-center leading-snug">
            {hasReadyWork ? 'Tap to score completed games and create the next round.' : 'Up to date · auto-advances after each draft.'}
          </p>
          <button onClick={() => setShowRules(v => !v)} className="w-full h-8 rounded-lg text-[10.5px] font-bold text-foreground/70 hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5">
            How it works <ChevronDown className={cn('w-3 h-3 transition-transform', showRules && 'rotate-180')} />
          </button>
          {showRules && <PlayoffFormatGuide embedded />}
        </div>
      </div>
      {pickerMatch && seasonId && (
        <TopicPickerDialog open={!!pickerMatch} onOpenChange={(v) => { if (!v) setPickerMatch(null); }} seasonId={seasonId} match={pickerMatch} onStarted={() => onUpdate()} />
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   SEASON DRAFT HISTORY
   ══════════════════════════════════════════════════════════ */
function SeasonDraftHistory({ entries, totalDrafts }: { entries: any[]; totalDrafts: number }) {
  const regularEntries = entries.filter(e => !e.is_playoff);
  const [isOpen, setIsOpen] = useState(regularEntries.length <= 4);
  if (regularEntries.length === 0) return null;
  const displayEntries = isOpen ? regularEntries : regularEntries.slice(0, 3);
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <div className="glass-card overflow-hidden bg-card/60">
        <div className="p-3 border-b border-border/20 flex items-center justify-between">
          <h3 className="font-bold text-[13px] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} /> Draft History
          </h3>
          {regularEntries.length > 3 && (
            <button onClick={() => setIsOpen(!isOpen)} className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-0.5 hover:text-muted-foreground transition-colors">
              {isOpen ? 'Collapse' : `Show all ${regularEntries.length}`}
              <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-180')} />
            </button>
          )}
        </div>
        <div className="divide-y divide-border/10">
          {displayEntries.map((e, i) => {
            const isComplete = e.drafts?.status === 'complete';
            const isActive = e.drafts?.status === 'in_progress';
            return (
              <Link key={e.id} to={`/drafts/${e.draft_id}`} className="block">
                <div className={cn('flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors', i % 2 === 1 && 'bg-muted/8')}>
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', isComplete ? 'bg-success/12' : isActive ? 'bg-gold/12' : 'bg-muted/50')}>
                    {isComplete ? <span className="text-[10px]">✓</span> : <span className="text-[10px] font-bold text-muted-foreground">#{e.week_number}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-bold truncate">{e.drafts?.topic || 'Draft'}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-muted-foreground/50">#{e.week_number} of {totalDrafts}</span>
                      <span className="text-[9px] text-muted-foreground/30">·</span>
                      <span className={cn('text-[9px] font-semibold', isComplete ? 'text-primary' : isActive ? 'text-success' : 'text-muted-foreground')}>
                        {isComplete ? 'Complete' : isActive ? 'In Progress' : e.drafts?.status || 'unknown'}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   LIFETIME STATS
   ══════════════════════════════════════════════════════════ */
function LifetimeStatsCard({ userId }: { userId?: string }) {
  const { stats, loading } = useLifetimeStats(userId);
  if (loading || !stats) return null;
  const items = [
    { label: 'Seasons', value: stats.totalSeasons },
    { label: 'Wins', value: stats.totalWins },
    { label: 'Podiums', value: stats.totalPodiums },
    { label: 'Playoffs', value: stats.totalPlayoffs },
    { label: 'Championships', value: stats.totalChampionships, highlight: true },
    { label: 'Avg Finish', value: stats.avgSeasonFinish > 0 ? getOrdinalSuffix(Math.round(stats.avgSeasonFinish)) : '—' },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
      <div className="glass-card p-4 bg-card/60">
        <h3 className="font-bold text-[13px] flex items-center gap-1.5 mb-3">
          <Medal className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} /> Lifetime Stats
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {items.map(item => (
            <div key={item.label} className={cn('text-center rounded-lg p-2', item.highlight && 'ring-1 ring-gold/20')}
              style={item.highlight ? { background: 'hsl(var(--gold) / 0.06)' } : undefined}>
              <p className={cn('text-lg font-extrabold leading-none tabular-nums', item.highlight && 'text-gold')}>{item.value}</p>
              <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════
   COMMISSIONER PANEL
   ══════════════════════════════════════════════════════════ */
function CommissionerPanel({ season, entries, onUpdate }: { season: any; entries: any[]; onUpdate: () => void }) {
  const { drafts: unassigned, loading, refetch: refetchUnassigned } = useUnassignedDrafts(season?.id);
  const [busy, setBusy] = useState<string | null>(null);
  const totalDrafts = getSeasonDraftTarget(season);
  const regularEntries = entries.filter(e => !e.is_playoff);
  const slotsFilled = regularEntries.length;
  const slotsRemaining = Math.max(0, totalDrafts - slotsFilled);

  const handleAdd = async (draftId: string) => {
    setBusy(draftId);
    try {
      const num = await addDraftToSeason(season.id, draftId);
      await recalculateSeasonStandings(season.id);
      toast.success(`Added as Season Draft #${num}`);
      refetchUnassigned(); onUpdate();
    } catch (err: any) { toast.error(err.message || 'Failed to add'); }
    finally { setBusy(null); }
  };

  const handleRemove = async (draftId: string) => {
    setBusy(draftId);
    try {
      await removeDraftFromSeason(draftId);
      await recalculateSeasonStandings(season.id);
      toast.success('Removed from season');
      refetchUnassigned(); onUpdate();
    } catch (err: any) { toast.error(err.message || 'Failed to remove'); }
    finally { setBusy(null); }
  };

  return (
    <div className="glass-card overflow-hidden border" style={{ borderColor: 'hsl(var(--gold) / 0.2)' }}>
      <div className="p-3.5 border-b border-border/20 flex items-center justify-between" style={{ background: 'hsl(var(--gold) / 0.05)' }}>
        <h3 className="font-bold text-[13px] flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} /> Season Drafts
        </h3>
        <span className="text-[10px] font-bold tabular-nums" style={{ color: slotsRemaining > 0 ? 'hsl(var(--gold))' : 'hsl(var(--success))' }}>
          {slotsFilled} / {totalDrafts} slots
        </span>
      </div>
      {unassigned.length > 0 && slotsRemaining > 0 && (
        <div className="p-3 border-b border-border/10">
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">Unassigned Drafts</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {unassigned.map(d => (
              <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <Bookmark className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--gold) / 0.5)' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate">{d.topic}</p>
                  <span className={cn('text-[9px] font-semibold', d.status === 'complete' ? 'text-primary' : d.status === 'in_progress' ? 'text-success' : 'text-muted-foreground')}>{d.status}</span>
                </div>
                <button onClick={() => handleAdd(d.id)} disabled={busy === d.id}
                  className="px-2 py-1 rounded-md text-[9px] font-bold transition-colors flex items-center gap-1 btn-press"
                  style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))' }}>
                  {busy === d.id ? '…' : <><Plus className="w-3 h-3" /> Add</>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {regularEntries.length > 0 && (
        <div className="p-3">
          <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider mb-2">Season Drafts</p>
          <div className="space-y-1">
            {regularEntries.map(e => (
              <div key={e.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/20 transition-colors">
                <span className="text-[10px] font-bold text-muted-foreground w-5 text-center">#{e.week_number}</span>
                <p className="text-[11px] font-semibold flex-1 truncate">{e.drafts?.topic || 'Draft'}</p>
                <span className={cn('text-[9px] font-semibold', e.drafts?.status === 'complete' ? 'text-primary' : e.drafts?.status === 'in_progress' ? 'text-success' : 'text-muted-foreground')}>
                  {e.drafts?.status || '?'}
                </span>
                <button onClick={() => handleRemove(e.draft_id)} disabled={busy === e.draft_id}
                  className="p-1 rounded text-muted-foreground/40 hover:text-destructive transition-colors" title="Remove from season">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {slotsRemaining === 0 && (
        <div className="p-3 text-center">
          <p className="text-[10px] font-bold" style={{ color: 'hsl(var(--success))' }}>✓ All {totalDrafts} season slots filled</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   NO SEASON STATE
   ══════════════════════════════════════════════════════════ */
function NoSeasonState() {
  const [activeDrafts, setActiveDrafts] = useState(0);
  useEffect(() => {
    supabase.from('drafts').select('*', { count: 'exact', head: true }).neq('status', 'complete').then(({ count }) => setActiveDrafts(count || 0));
  }, []);
  return (
    <div className="space-y-3">
      <div className="glass-card arena-edge p-6 text-center">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 relative z-10"
          style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.05))' }}>
          <Trophy className="w-7 h-7" style={{ color: 'hsl(var(--gold) / 0.6)' }} />
        </div>
        <h3 className="text-base font-extrabold relative z-10 mb-1">Draft League</h3>
        <p className="text-[11px] text-muted-foreground leading-relaxed relative z-10 mb-4">
          No season is active yet. A commissioner can start a season to track standings, playoffs, and championships.
        </p>
        <Link to="/drafts">
          <button className="flex items-center gap-2 font-bold rounded-xl px-4 py-2.5 text-[12px] btn-press mx-auto" style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))' }}>
            <Bookmark className="w-4 h-4" /> View Drafts
            {activeDrafts > 0 && <span className="text-[9px] opacity-70">({activeDrafts} active)</span>}
          </button>
        </Link>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */
export default function DraftsListPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'drafts';

  // Draft list state
  const [drafts, setDrafts] = useState<any[]>([]);
  const [participantCounts, setParticipantCounts] = useState<Map<string, number>>(new Map());
  const [draftWinners, setDraftWinners] = useState<Map<string, { user_id: string; display_name: string }>>(new Map());
  const [myDraftStats, setMyDraftStats] = useState({ totalPoints: 0, wins: 0, draftsRated: 0, podiums: 0, bestFinish: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);
  // Season grouping: map every draft id → { seasonId, seasonName, startsAt, status }
  const [seasonByDraft, setSeasonByDraft] = useState<Map<string, { seasonId: string; name: string; startsAt: string; status: string }>>(new Map());
  const [allSeasons, setAllSeasons] = useState<Array<{ id: string; name: string; startsAt: string; status: string }>>([]);


  // Season state
  const { season, loading: seasonLoading, refetch: refetchSeason } = useCurrentSeason();
  const { standings, loading: standingsLoading, refetch: refetchStandings } = useSeasonStandings(season?.id);
  const { entries, loading: entriesLoading, refetch: refetchEntries } = useSeasonEntries(season?.id);
  const { matches } = usePlayoffMatchesLive(season?.id);
  const isCommissioner = useIsCommissioner(season);
  const [isAppAdmin, setIsAppAdmin] = useState(false);
  const [startNextOpen, setStartNextOpen] = useState(false);

  const seasonDraftIds = new Set(entries.map(e => e.draft_id));
  const playoffDraftIds = entries.filter(e => e.is_playoff).map(e => e.draft_id);
  const playoffMatchByDraft = usePlayoffMatchByDraftIds(playoffDraftIds);
  const totalDrafts = season ? getSeasonDraftTarget(season) : 12;

  useEffect(() => {
    if (!user?.id) { setIsAppAdmin(false); return; }
    supabase.rpc('is_app_admin', { _user_id: user.id }).then(({ data }) => setIsAppAdmin(!!data));
  }, [user?.id]);

  const handleSeasonUpdate = useCallback(() => {
    refetchEntries(); refetchStandings();
  }, [refetchEntries, refetchStandings]);

  // Visibility-based refetch
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && season?.id) { refetchStandings(); refetchEntries(); }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [season?.id, refetchStandings, refetchEntries]);

  // Auto-recalc stale standings
  useEffect(() => {
    if (!season?.id || standingsLoading || entriesLoading) return;
    const completedEntries = entries.filter(e => !e.is_playoff && e.drafts?.status === 'complete');
    const maxDraftsPlayed = standings.length > 0 ? Math.max(...standings.map(s => s.drafts_played)) : 0;
    if (completedEntries.length > 0 && maxDraftsPlayed < completedEntries.length) {
      recalculateSeasonStandings(season.id).then(() => refetchStandings()).catch(err => console.error('Auto-recalc failed:', err));
    }
  }, [season?.id, standings, entries, standingsLoading, entriesLoading, refetchStandings]);

  // Auto-advance playoffs
  useEffect(() => {
    if (!season?.id) return;
    if (season.status !== 'regular_season' && season.status !== 'playoffs') return;
    let cancelled = false;
    const tryAdvance = () => {
      advancePlayoffs(season.id).then(() => { if (!cancelled) { refetchEntries(); refetchStandings(); } }).catch(() => {});
    };
    tryAdvance();
    const onVis = () => { if (document.visibilityState === 'visible') tryAdvance(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; document.removeEventListener('visibilitychange', onVis); };
  }, [season?.id, season?.status, refetchEntries, refetchStandings]);

  const fetchDrafts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('drafts')
      .select('*, competitions(title, status), profiles:created_by(display_name), current_pick_profiles:current_pick_user_id(display_name)')
      .order('created_at', { ascending: false });

    if (data) {
      const draftIds = data.map(d => d.id);
      if (draftIds.length > 0) {
        const [{ data: parts }, { data: picks }, { data: seasonEntriesAll }, { data: seasonsAll }] = await Promise.all([
          supabase.from('draft_participants').select('draft_id, user_id, pick_order, profiles:user_id(display_name)').in('draft_id', draftIds),
          supabase.from('draft_picks').select('draft_id').in('draft_id', draftIds),
          supabase.from('draft_season_entries' as any).select('draft_id, season_id').in('draft_id', draftIds),
          supabase.from('draft_seasons' as any).select('id, name, starts_at, status').order('starts_at', { ascending: false }),
        ]);
        // Build season-by-draft map and seasons list
        const seasonsById = new Map<string, { id: string; name: string; startsAt: string; status: string }>();
        (seasonsAll || []).forEach((s: any) => {
          seasonsById.set(s.id, { id: s.id, name: s.name, startsAt: s.starts_at, status: s.status });
        });
        const sbd = new Map<string, { seasonId: string; name: string; startsAt: string; status: string }>();
        (seasonEntriesAll || []).forEach((e: any) => {
          const s = seasonsById.get(e.season_id);
          if (s) sbd.set(e.draft_id, { seasonId: s.id, name: s.name, startsAt: s.startsAt, status: s.status });
        });
        setSeasonByDraft(sbd);
        setAllSeasons(Array.from(seasonsById.values()));

        const participantsByDraft = new Map<string, any[]>();
        if (parts) {
          const counts = new Map<string, number>();
          parts.forEach(p => {
            counts.set(p.draft_id, (counts.get(p.draft_id) || 0) + 1);
            const existing = participantsByDraft.get(p.draft_id) || [];
            existing.push(p); participantsByDraft.set(p.draft_id, existing);
          });
          setParticipantCounts(counts);
        }
        const pickCounts = new Map<string, number>();
        if (picks) picks.forEach(p => pickCounts.set(p.draft_id, (pickCounts.get(p.draft_id) || 0) + 1));
        const partCounts = new Map<string, number>();
        if (parts) parts.forEach(p => partCounts.set(p.draft_id, (partCounts.get(p.draft_id) || 0) + 1));
        const fixIds: string[] = [];
        const updatedData = data.map(d => {
          if (d.status === 'in_progress') {
            const numParts = partCounts.get(d.id) || 0;
            const numPicks = pickCounts.get(d.id) || 0;
            if (numParts > 0 && numPicks >= numParts * d.num_rounds) { fixIds.push(d.id); return { ...d, status: 'complete' }; }
          }
          return d;
        });
        for (const id of fixIds) await supabase.from('drafts').update({ status: 'complete' }).eq('id', id);
        setDrafts(updatedData.map(d => ({
          ...d,
          ...getDerivedDraftTurn(d, participantsByDraft.get(d.id) || [], pickCounts.get(d.id) || 0),
        })));
        if (draftIds.length > 0) {
          const { data: allResults } = await supabase.from('draft_results' as any).select('draft_id, user_id, rank, points_awarded, total_score').in('draft_id', draftIds);
          if (allResults) {
            const winners = new Map<string, { user_id: string; display_name: string }>();
            const winnerUserIds = new Set<string>();
            for (const r of allResults as any[]) { if (r.rank === 1) { winners.set(r.draft_id, { user_id: r.user_id, display_name: '' }); winnerUserIds.add(r.user_id); } }
            if (winnerUserIds.size > 0) {
              const { data: wp } = await supabase.from('profiles').select('id, display_name').in('id', [...winnerUserIds]);
              if (wp) { const pm = new Map(wp.map(p => [p.id, p.display_name])); for (const [, w] of winners) w.display_name = pm.get(w.user_id) || 'Unknown'; }
            }
            setDraftWinners(winners);
            const myResults = (allResults as any[]).filter((r: any) => r.user_id === user?.id);
            const podiums = myResults.filter((r: any) => r.rank <= 3).length;
            const bestFinish = myResults.length > 0 ? Math.min(...myResults.map((r: any) => r.rank)) : 0;
            const avgScore = myResults.length > 0 ? myResults.reduce((s: number, r: any) => s + (r.total_score || 0), 0) / myResults.length : 0;
            setMyDraftStats({ totalPoints: myResults.reduce((s: number, r: any) => s + (r.points_awarded || 0), 0), wins: myResults.filter((r: any) => r.rank === 1).length, draftsRated: myResults.length, podiums, bestFinish, avgScore });
          }
        }
      } else {
        setDrafts(data);
      }
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);
  useDraftListUpdates(fetchDrafts, !!user);

  const statusConfig: Record<string, { label: string; cls: string }> = {
    setup: { label: 'Setup', cls: 'da-status-setup' },
    in_progress: { label: 'In Progress', cls: 'da-status-live' },
    complete: { label: 'Complete', cls: 'da-status-complete' },
  };

  const canSeeCommissioner = isCommissioner || isAppAdmin;

  return (
    <div className="pb-6">
      <Tabs defaultValue={defaultTab} className="w-full">
        {/* Tab bar */}
        <div className="flex items-center justify-between mb-4 gap-3">
          <TabsList className="flex gap-1 p-1 rounded-xl h-auto" style={{ background: 'hsl(45 95% 55% / 0.08)', border: '1px solid hsl(45 95% 55% / 0.18)' }}>
            <TabsTrigger value="drafts"
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg data-[state=active]:text-[hsl(160_30%_6%)] data-[state=inactive]:text-white/60"
              style={{ '--tw-ring-color': 'transparent' } as any}>
              Drafts
            </TabsTrigger>
            <TabsTrigger value="season"
              className="text-[10px] font-bold px-3 py-1.5 rounded-lg data-[state=active]:text-[hsl(160_30%_6%)] data-[state=inactive]:text-white/60">
              Season
            </TabsTrigger>
            {canSeeCommissioner && (
              <TabsTrigger value="commissioner"
                className="text-[10px] font-bold px-3 py-1.5 rounded-lg data-[state=active]:text-[hsl(160_30%_6%)] data-[state=inactive]:text-white/60">
                Commissioner
              </TabsTrigger>
            )}
          </TabsList>

          {/* Create button always visible */}
          <Link to="/drafts/create">
            <Button size="sm" className="gap-1.5 rounded-lg font-bold btn-press da-cta flex-shrink-0">
              <Plus className="w-4 h-4" /> Create
            </Button>
          </Link>
        </div>

        {/* ── DRAFTS TAB ── */}
        <TabsContent value="drafts" className="mt-0">
          {myDraftStats.draftsRated > 0 && (
            <div className="da-glass p-4 mb-4">
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { v: myDraftStats.totalPoints, l: 'Total Pts' },
                  { v: myDraftStats.wins, l: 'Wins' },
                  { v: myDraftStats.podiums, l: 'Podiums' },
                ].map(stat => (
                  <div key={stat.l} className="text-center">
                    <p className="text-lg font-extrabold leading-none tabular-nums"><CountedNumber value={stat.v} /></p>
                    <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">{stat.l}</p>
                  </div>
                ))}
              </div>
              <hr className="da-divider mb-2.5" />
              <div className="pt-0.5 flex items-center justify-around">
                <div className="text-center">
                  <p className="text-sm font-bold leading-none">{myDraftStats.avgScore.toFixed(1)}</p>
                  <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">Avg Score</p>
                </div>
                <div className="w-px h-6 bg-gold/15" />
                <div className="text-center">
                  <p className="text-sm font-bold leading-none">{myDraftStats.bestFinish > 0 ? `${myDraftStats.bestFinish}${myDraftStats.bestFinish === 1 ? 'st' : myDraftStats.bestFinish === 2 ? 'nd' : myDraftStats.bestFinish === 3 ? 'rd' : 'th'}` : '—'}</p>
                  <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">Best Finish</p>
                </div>
                <div className="w-px h-6 bg-gold/15" />
                <div className="text-center">
                  <p className="text-sm font-bold leading-none">{myDraftStats.draftsRated}</p>
                  <p className="text-[9px] text-muted-foreground/60 font-medium mt-0.5">Rated</p>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2.5">
              {[1, 2].map(i => (
                <div key={i} className="da-glass p-5">
                  <div className="h-4 rounded-lg w-1/3 mb-2.5 da-shimmer" />
                  <div className="h-3 rounded-lg w-1/2 da-shimmer" />
                </div>
              ))}
            </div>
          ) : drafts.length === 0 ? (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="empty-state">
              <div className="da-page-icon" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '1rem' }}>
                <Bookmark className="w-7 h-7" />
              </div>
              <p className="empty-state-title">No drafts yet</p>
              <p className="empty-state-desc mb-6">Run a snake draft on any topic with your crew.</p>
              <Link to="/drafts/create">
                <Button className="font-bold rounded-xl gap-2 btn-press da-cta"><Plus className="w-4 h-4" /> Create Draft</Button>
              </Link>
            </motion.div>
          ) : (() => {
            // ── Group drafts by season, with a fallback "Miscellaneous" bucket ──
            type Group = { id: string; name: string; status: string | null; startsAt: string | null; drafts: any[] };
            const groupsMap = new Map<string, Group>();
            for (const s of allSeasons) {
              groupsMap.set(s.id, { id: s.id, name: s.name, status: s.status, startsAt: s.startsAt, drafts: [] });
            }
            const misc: Group = { id: '__misc__', name: 'Miscellaneous', status: null, startsAt: null, drafts: [] };
            for (const d of drafts) {
              const meta = seasonByDraft.get(d.id);
              if (meta && groupsMap.has(meta.seasonId)) groupsMap.get(meta.seasonId)!.drafts.push(d);
              else misc.drafts.push(d);
            }
            // Only show seasons that have drafts. Sort newest → oldest.
            const seasonGroups = Array.from(groupsMap.values())
              .filter(g => g.drafts.length > 0)
              .sort((a, b) => (b.startsAt || '').localeCompare(a.startsAt || ''));
            const orderedGroups: Group[] = [...seasonGroups];
            if (misc.drafts.length > 0) orderedGroups.push(misc);

            // Default-open: current/most-recent active season + misc (if no seasons present).
            const defaultOpen = orderedGroups
              .filter((g, idx) => idx === 0 || g.status === 'regular_season' || g.status === 'playoffs')
              .map(g => g.id);

            const statusChip = (g: Group): { label: string; cls: string; live: boolean } | null => {
              if (g.id === '__misc__') return null;
              switch (g.status) {
                case 'regular_season': return { label: 'In Progress', cls: 'bg-success/15 text-success border border-success/25', live: true };
                case 'playoffs': return { label: 'Playoffs', cls: 'bg-gold/15 text-gold border border-gold/25', live: true };
                case 'complete': return { label: 'Complete', cls: 'bg-muted/40 text-muted-foreground border border-border/30', live: false };
                case 'upcoming': return { label: 'Upcoming', cls: 'bg-muted/40 text-muted-foreground border border-border/30', live: false };
                default: return null;
              }
            };

            const renderRow = (d: any, i: number) => {
              const count = participantCounts.get(d.id) || 0;
              const sc = statusConfig[d.status] || statusConfig.setup;
              const winner = draftWinners.get(d.id);
              const playoffMatch = playoffMatchByDraft.get(d.id);
              const isPlayoff = !!playoffMatch;
              const isLive = d.status === 'in_progress';
              const isMyTurn = isLive && d.current_pick_user_id === user?.id;
              const staggerIdx = Math.min(i, 8);
              return (
                <motion.div key={d.id} variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { ...springSnap, delay: staggerIdx * 0.04 } } }}>
                  <Link to={`/drafts/${d.id}`} className="block group">
                    <div className={cn('da-glass p-4 hover-lift cursor-pointer relative overflow-hidden transition-transform',
                      isPlayoff && 'arena-edge', isLive && !isPlayoff && 'draft-row-live', isMyTurn && !isPlayoff && 'draft-row-mine')}
                      style={isPlayoff ? {
                        borderLeft: '3px solid hsl(45 93% 52%)',
                        background: 'linear-gradient(135deg, hsl(45 93% 52% / 0.08), transparent 60%), linear-gradient(180deg, hsl(160 35% 7% / 0.88), hsl(160 50% 4% / 0.94))',
                        boxShadow: '0 0 18px -4px hsl(45 93% 52% / 0.25)',
                      } : undefined}>
                      {isPlayoff && <div className="absolute -right-2 -top-2 text-3xl opacity-10 select-none pointer-events-none" aria-hidden>✦</div>}
                      {isLive && !isPlayoff && <div className="absolute -right-2 -top-2 text-2xl opacity-[0.07] select-none pointer-events-none" aria-hidden>✦</div>}
                      <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={isPlayoff ? { background: 'linear-gradient(135deg, hsl(45 93% 52% / 0.28), hsl(38 92% 50% / 0.10))', boxShadow: '0 0 10px hsl(45 93% 52% / 0.25)' } : { background: 'linear-gradient(135deg, hsl(var(--gold) / 0.15), hsl(var(--gold) / 0.04))' }}>
                            {isPlayoff ? <Trophy className="w-5 h-5" style={{ color: 'hsl(45 93% 52%)' }} strokeWidth={2.5} /> : <Bookmark className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />}
                          </div>
                          <div className="min-w-0">
                            {isPlayoff && <div className="mb-0.5"><PlayoffBadge round={playoffMatch!.round} matchNumber={playoffMatch!.match_number} size="xs" /></div>}
                            <h3 className="font-bold text-sm truncate">{d.topic}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              {isPlayoff ? (
                                <span className="text-[10px] font-bold tracking-wide" style={{ color: 'hsl(45 93% 52%)' }}>{getPlayoffGameLabel(playoffMatch!.round, playoffMatch!.match_number)}</span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground/70 font-medium">{d.num_rounds} rounds</span>
                              )}
                              <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/15" />
                              <span className="text-[10px] text-muted-foreground/70 flex items-center gap-0.5 font-medium"><Users className="w-2.5 h-2.5" /> {count}</span>
                              {winner && (
                                <><span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/15" /><span className="text-[10px] flex items-center gap-0.5 font-semibold" style={{ color: 'hsl(var(--gold))' }}><Trophy className="w-2.5 h-2.5" /> {winner.display_name}</span></>
                              )}
                            </div>
                            {d.status === 'in_progress' && d.current_pick_user_id && (
                              <motion.p initial={isMyTurn ? { y: 0 } : false} animate={isMyTurn ? { y: [0, -2, 0] } : undefined} transition={{ duration: 0.6, ease: 'easeOut' }}
                                className="text-[10px] font-semibold mt-0.5" style={{ color: isMyTurn ? 'hsl(var(--gold))' : 'hsl(var(--success))' }}>
                                🎯 {isMyTurn ? 'Your pick!' : `${(d as any).current_pick_profiles?.display_name || 'Someone'}'s pick`}
                              </motion.p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={cn(isPlayoff ? 'da-status-complete' : sc.cls)}>
                            {d.status === 'in_progress' && <Play className="w-2.5 h-2.5 mr-0.5" />}
                            {sc.label}
                          </span>
                          <ArrowRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-muted-foreground draft-chevron" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            };

            return (
              <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-2.5">
                {orderedGroups.map(g => {
                  const chip = statusChip(g);
                  const liveCount = g.drafts.filter(d => d.status === 'in_progress').length;
                  return (
                    <AccordionItem
                      key={g.id}
                      value={g.id}
                      className="border-0 rounded-xl overflow-hidden da-glass"
                    >
                      <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0 text-left">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: g.id === '__misc__' ? 'hsl(var(--muted) / 0.5)' : 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.06))' }}>
                            {g.id === '__misc__'
                              ? <Archive className="w-4 h-4 text-muted-foreground" />
                              : <Trophy className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-[13px] truncate">{g.name}</span>
                              {chip && (
                                <span className={cn('inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-[2px] rounded-full', chip.cls)}>
                                  {chip.live && <span className="w-1 h-1 rounded-full bg-current animate-pulse" />}
                                  {chip.label}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 font-medium mt-0.5">
                              {g.drafts.length} {g.drafts.length === 1 ? 'draft' : 'drafts'}
                              {liveCount > 0 && <> · <span style={{ color: 'hsl(var(--success))' }}>{liveCount} in progress</span></>}
                            </p>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-2 pb-2 pt-0">
                        <motion.div className="space-y-2" initial="hidden" animate="show"
                          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}>
                          {g.drafts.map((d, i) => renderRow(d, i))}
                        </motion.div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            );
          })()}



          {/* Seasons archive link */}
          <div className="mt-4">
            <Link to="/drafts/seasons">
              <button className="w-full h-9 rounded-lg bg-muted/40 text-[11px] font-bold text-foreground/70 transition-colors flex items-center justify-center gap-1.5 btn-press hover:bg-muted/60">
                <Archive className="w-3.5 h-3.5" /> Seasons Archive <ChevronRight className="w-3 h-3" />
              </button>
            </Link>
          </div>
        </TabsContent>

        {/* ── SEASON TAB ── */}
        <TabsContent value="season" className="mt-0">
          {seasonLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="glass-card p-5">
                  <div className="h-4 rounded-lg w-1/3 mb-2.5 skeleton-shimmer" />
                  <div className="h-3 rounded-lg w-1/2 skeleton-shimmer" />
                </div>
              ))}
            </div>
          ) : season ? (
            <div className="space-y-3">
              <SeasonHeaderCard season={season} entries={entries} />
              {season.status === 'complete' ? (
                <>
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <Link to={`/drafts/seasons/${season.id}`}>
                      <div className="glass-card p-4 flex items-center gap-3 border-gold/15 hover-lift"
                        style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.08), transparent 60%), hsl(var(--card))', borderLeft: '3px solid hsl(var(--gold))' }}>
                        <Trophy className="w-5 h-5 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
                        <div className="flex-1">
                          <p className="text-[13px] font-extrabold">Season Complete</p>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">View the full archive & podium</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
                      </div>
                    </Link>
                  </motion.div>
                  {canSeeCommissioner && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
                      <div className="glass-card p-4 flex items-center gap-3"
                        style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.10), transparent 60%), hsl(var(--card))', border: '1px solid hsl(var(--gold) / 0.25)', boxShadow: '0 0 24px -10px hsl(var(--gold) / 0.45)' }}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.06))', border: '1px solid hsl(var(--gold) / 0.3)' }}>
                          <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-extrabold">Ready for the next season?</p>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5 leading-snug">Archive {season.name} and open fresh standings.</p>
                        </div>
                        <button onClick={() => setStartNextOpen(true)}
                          className="h-9 px-3 rounded-lg text-[11px] font-extrabold btn-press flex items-center gap-1.5 flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.95), hsl(var(--gold) / 0.7))', color: 'hsl(0 0% 8%)', boxShadow: '0 4px 12px -4px hsl(var(--gold) / 0.5)' }}>
                          <Plus className="w-3.5 h-3.5" /> Start
                        </button>
                      </div>
                    </motion.div>
                  )}
                  <StandingsCard standings={standings} userId={user?.id} />
                  <LifetimeStatsCard userId={user?.id} />
                  <StartNextSeasonSheet open={startNextOpen} onOpenChange={setStartNextOpen} previousSeason={season} onCreated={() => { refetchSeason(); }} />
                </>
              ) : (
                <>
                  <NextDraftCard entries={entries} totalDrafts={totalDrafts} />
                  <StandingsCard standings={standings} userId={user?.id} />
                  <PlayoffControlCenter season={season} matches={matches} standings={standings} userId={user?.id} onUpdate={handleSeasonUpdate} />
                  <PlayoffPicture standings={standings} matches={matches} seasonId={season?.id} />
                  <SeasonDraftHistory entries={entries} totalDrafts={totalDrafts} />
                  <LifetimeStatsCard userId={user?.id} />
                </>
              )}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                <Link to="/drafts/seasons" className="block">
                  <button className="w-full h-9 rounded-lg bg-muted/50 text-[11px] font-bold text-foreground/80 transition-colors flex items-center justify-center gap-1.5 btn-press">
                    Seasons Archive <ChevronRight className="w-3 h-3" />
                  </button>
                </Link>
              </motion.div>
            </div>
          ) : (
            <NoSeasonState />
          )}
        </TabsContent>

        {/* ── COMMISSIONER TAB ── */}
        {canSeeCommissioner && (
          <TabsContent value="commissioner" className="mt-0">
            {seasonLoading ? (
              <div className="glass-card p-5"><div className="h-4 rounded-lg w-1/3 mb-2.5 skeleton-shimmer" /></div>
            ) : season ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(var(--gold) / 0.15)', border: '1px solid hsl(var(--gold) / 0.3)' }}>
                    <Shield className="w-4 h-4" style={{ color: 'hsl(var(--gold))' }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-extrabold" style={{ color: 'hsl(var(--gold))' }}>Commissioner Tools</p>
                    <p className="text-[10px] text-muted-foreground/70">{season.name}</p>
                  </div>
                </div>
                <CommissionerPanel season={season} entries={entries} onUpdate={handleSeasonUpdate} />
                {season.status !== 'complete' && (
                  <div className="glass-card p-4 space-y-2">
                    <h3 className="text-[12px] font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" style={{ color: 'hsl(var(--gold))' }} /> Season Actions
                    </h3>
                    <Link to={`/drafts/seasons/${season.id}`} className="block">
                      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <Archive className="w-4 h-4" style={{ color: 'hsl(var(--gold) / 0.6)' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-bold">Season Detail Page</p>
                          <p className="text-[10px] text-muted-foreground/60">Full season history and settings</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                      </div>
                    </Link>
                  </div>
                )}
                {season.status === 'complete' && (
                  <div className="glass-card p-4 flex items-center gap-3"
                    style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.10), transparent 60%), hsl(var(--card))', border: '1px solid hsl(var(--gold) / 0.25)' }}>
                    <Sparkles className="w-5 h-5 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-extrabold">Start a new season?</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">Archive {season.name} and open fresh standings.</p>
                    </div>
                    <button onClick={() => setStartNextOpen(true)}
                      className="h-9 px-3 rounded-lg text-[11px] font-extrabold btn-press flex items-center gap-1.5 flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, hsl(var(--gold) / 0.95), hsl(var(--gold) / 0.7))', color: 'hsl(0 0% 8%)' }}>
                      <Plus className="w-3.5 h-3.5" /> Start
                    </button>
                  </div>
                )}
                <StartNextSeasonSheet open={startNextOpen} onOpenChange={setStartNextOpen} previousSeason={season} onCreated={() => { refetchSeason(); }} />
              </div>
            ) : (
              <div className="glass-card p-6 text-center">
                <Shield className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm font-bold mb-1">No active season</p>
                <p className="text-[11px] text-muted-foreground/70">Create a season first to manage it here.</p>
                <Link to="/drafts/seasons" className="mt-4 inline-block">
                  <Button size="sm" variant="outline" className="gap-1.5 rounded-lg font-bold btn-press border-gold/30 text-gold hover:bg-gold/10">
                    <Archive className="w-3.5 h-3.5" /> Seasons
                  </Button>
                </Link>
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
