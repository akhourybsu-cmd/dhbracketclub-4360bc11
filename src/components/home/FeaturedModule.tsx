// DH Club Home — Featured Module
//
// One richer block below the app dock. Chooses the most relevant
// spotlight given installed plugins and active state:
//   1. League standings if Draft Arena has an active season
//   2. Narrative campaign spotlight if a campaign is active
//   3. Nothing — caller renders no section
//
// The wrapper unifies the section label so each candidate doesn't have
// to render its own eyebrow.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Trophy, Crown, ScrollText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Surface } from './primitives/Surface';
import { SectionLabel } from './SectionLabel';

interface StandingLite {
  id: string;
  user_id: string;
  rank: number | null;
  season_points: number;
  profiles?: { display_name?: string } | null;
}

interface SeasonLite { id: string; name: string; status: string; season_label?: string | null }

interface CampaignLite {
  id: string;
  title: string;
  pitch: string | null;
  status: string;
}

interface Props {
  /** Active season — if present and Draft Arena installed, league spotlight wins. */
  season?: SeasonLite | null;
  standings?: StandingLite[];
  regularEntries?: number;
  seasonTarget?: number;
  userId?: string;
  /** Active narrative campaigns the user can see. */
  campaigns?: CampaignLite[];
}

export function FeaturedModule({
  season, standings = [], regularEntries = 0, seasonTarget = 0, userId, campaigns = [],
}: Props) {
  if (season) {
    return <LeagueFeatured season={season} standings={standings} regularEntries={regularEntries} seasonTarget={seasonTarget} userId={userId} />;
  }
  const activeCampaign = campaigns.find(c => c.status === 'active');
  if (activeCampaign) {
    return <CampaignFeatured campaign={activeCampaign} />;
  }
  return null;
}

/* ── League spotlight ───────────────────────────────────────────── */

function LeagueFeatured({ season, standings, regularEntries, seasonTarget, userId }: {
  season: SeasonLite; standings: StandingLite[]; regularEntries: number; seasonTarget: number; userId?: string;
}) {
  const isPlayoffs = season.status === 'playoffs';
  const progress = seasonTarget > 0 ? Math.min(100, Math.round((regularEntries / seasonTarget) * 100)) : 0;
  const top3 = standings.slice(0, 3);
  const myStanding = standings.find(s => s.user_id === userId);
  const myInTop3 = top3.some(s => s.user_id === userId);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6"
    >
      <SectionLabel
        label="Featured"
        sublabel={season.season_label ? `${season.season_label} · League` : 'League'}
        to="/drafts?tab=season"
        linkLabel="Open"
        icon={Trophy}
      />
      <Link to="/drafts?tab=season" className="block active:scale-[0.99] transition-transform">
        <Surface variant="hero" accent="45 95% 55%">
          <div className="relative p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-[16px] font-extrabold tracking-tight truncate flex-1">{season.name}</h3>
              {isPlayoffs ? (
                <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] px-2 py-0.5 rounded-md" style={{ background: 'hsl(var(--gold) / 0.18)', color: 'hsl(var(--gold))' }}>
                  Playoffs
                </span>
              ) : (
                <span className="text-[11px] font-bold tabular-nums text-muted-foreground/75 flex-shrink-0">
                  {regularEntries}/{seasonTarget}
                </span>
              )}
            </div>

            {top3.length > 0 && (
              <div className="space-y-1.5">
                {top3.map((s, idx) => {
                  const podium = ['hsl(var(--gold))', 'hsl(0 0% 75%)', 'hsl(35 60% 55%)'];
                  const isMe = s.user_id === userId;
                  return (
                    <div key={s.id} className="flex items-center gap-2">
                      <span
                        className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-extrabold flex-shrink-0"
                        style={{ background: `${podium[idx]}26`, color: podium[idx], border: `1px solid ${podium[idx]}55` }}
                      >
                        {idx + 1}
                      </span>
                      <span className={cn('text-[12.5px] font-semibold truncate flex-1', isMe && 'text-[hsl(var(--gold))]')}>
                        {s.profiles?.display_name || 'Unknown'}{isMe && ' · you'}
                      </span>
                      {idx === 0 && <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'hsl(var(--gold))' }} />}
                      <span className="text-[12.5px] font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                        {s.season_points}
                      </span>
                    </div>
                  );
                })}
                {!myInTop3 && myStanding && (
                  <div className="flex items-center gap-2 pt-1.5 mt-1.5 border-t border-border/20">
                    <span className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-extrabold text-muted-foreground/80 bg-muted/40 flex-shrink-0">
                      #{myStanding.rank ?? '—'}
                    </span>
                    <span className="text-[12.5px] font-semibold truncate flex-1 text-[hsl(var(--gold))]">You</span>
                    <span className="text-[12.5px] font-extrabold tabular-nums" style={{ color: 'hsl(var(--gold))' }}>
                      {myStanding.season_points}
                    </span>
                  </div>
                )}
              </div>
            )}

            {!isPlayoffs && seasonTarget > 0 && (
              <div className="mt-3 h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted) / 0.4)' }}>
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, hsl(var(--gold) / 0.7), hsl(var(--gold)))',
                    boxShadow: '0 0 8px hsl(var(--gold) / 0.4)',
                  }}
                />
              </div>
            )}
          </div>
        </Surface>
      </Link>
    </motion.section>
  );
}

/* ── Narrative campaign spotlight ───────────────────────────────── */

function CampaignFeatured({ campaign }: { campaign: CampaignLite }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6"
    >
      <SectionLabel
        label="Featured"
        sublabel="Active campaign"
        to="/narrative"
        linkLabel="All"
        icon={ScrollText}
      />
      <Link to={`/narrative/${campaign.id}`} className="block active:scale-[0.99] transition-transform">
        <Surface variant="hero" accent="270 70% 65%">
          <div className="relative p-4 flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, hsl(270 70% 65% / 0.22), hsl(270 70% 65% / 0.04))',
                color: 'hsl(270 70% 65%)',
                boxShadow: 'inset 0 0 0 1px hsl(270 70% 65% / 0.28)',
              }}
            >
              <ScrollText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-extrabold tracking-tight leading-tight line-clamp-1">{campaign.title}</h3>
              {campaign.pitch && (
                <p className="text-[11.5px] text-muted-foreground/75 leading-snug mt-0.5 line-clamp-2">{campaign.pitch}</p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground/65" />
          </div>
        </Surface>
      </Link>
    </motion.section>
  );
}
