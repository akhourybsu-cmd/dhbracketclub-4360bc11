// DH Club — Narrative RPG · Campaigns list page (route: /narrative)
//
// Lands here from the drawer Community section once the asset is
// installed. Lists campaigns the current user can see (RLS does the
// filtering): active first, then drafts/pending/needs-changes the user
// owns, then completed/archived at the bottom.
//
// CTA: "Propose a campaign" — anyone in the club can pitch.

import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { STAGGER_CHILD, STAGGER_PARENT, TAP_PRESS } from '@/lib/narrative/motion';
import { ScrollText, Plus, ChevronRight, Users, Sparkles } from 'lucide-react';
import { useNarrativeCampaigns } from '@/hooks/useNarrativeCampaigns';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { SectionHeader } from '@/components/home/SectionHeader';
import { CampaignStatusPill } from '@/components/narrative/CampaignStatusPill';
import { getTemplate } from '@/lib/narrative/templates';
import { isFlamingoCampaign, FLAMINGO } from '@/lib/narrative/flamingoTheme';
import { FlamingoBrandBadge } from '@/components/narrative/flamingo/FlamingoStatusPill';
import type { Campaign } from '@/lib/narrative/types';

export default function NarrativeCampaignsPage() {
  const { user, loading: authLoading } = useAuth();
  const { club, isClubAdmin } = useClub();
  const { campaigns, loading } = useNarrativeCampaigns();
  const navigate = useNavigate();

  // Categorize for visual hierarchy: active campaigns lead, in-flight
  // proposals for admins next, the user's own drafts/pending after,
  // then everything else.
  const { live, mine, pending, completed } = useMemo(() => {
    const live: Campaign[] = [];
    const mine: Campaign[] = [];
    const pending: Campaign[] = [];
    const completed: Campaign[] = [];
    for (const c of campaigns) {
      if (c.status === 'active' || c.status === 'paused') {
        live.push(c);
      } else if (isClubAdmin && c.status === 'pending_approval') {
        pending.push(c);
      } else if (
        user
        && (c.created_by === user.id || c.gm_id === user.id || c.proposed_gm_id === user.id)
        && (c.status === 'draft' || c.status === 'needs_changes' || c.status === 'rejected'
            // For non-admins, pending_approval belongs in "Your proposals".
            // For admins, it's already shown under "Awaiting your approval",
            // so we drop it here to avoid the duplicate row (review bug #12).
            || (c.status === 'pending_approval' && !isClubAdmin))
      ) {
        mine.push(c);
      } else if (c.status === 'completed' || c.status === 'archived') {
        completed.push(c);
      }
    }
    return { live, mine, pending, completed };
  }, [campaigns, isClubAdmin, user]);

  return (
    <div
      className="px-4 pt-3 pb-6"
      style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="mb-4 flex items-start justify-between gap-2"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/70 inline-flex items-center gap-1.5">
            <ScrollText className="w-3 h-3" /> Narrative RPG
          </p>
          <h1 className="text-[22px] font-extrabold tracking-tight mt-0.5">
            {club?.name ? `${club.name} Campaigns` : 'Campaigns'}
          </h1>
          <p className="text-[11.5px] text-muted-foreground/75 mt-1 leading-snug">
            Pitch a campaign, get club-owner approval, then run cinematic story scenes with the Chronicle Engine.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/narrative/new')}
          aria-label="Propose a campaign"
          className="flex-shrink-0 inline-flex items-center gap-1 h-10 px-3 rounded-xl text-[11.5px] font-extrabold uppercase tracking-wider"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
            color: 'hsl(var(--primary-foreground))',
            boxShadow: '0 4px 14px hsl(var(--primary) / 0.4)',
          }}
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={3} /> New
        </button>
      </motion.div>

      {/* Loading — show skeleton while EITHER auth or data is hydrating.
          Prevents the empty-state flash when auth resolves a moment
          before the data fetch completes. */}
      {(authLoading || loading) && campaigns.length === 0 && (
        <div className="space-y-2 mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[88px] rounded-2xl skeleton-shimmer" />
          ))}
        </div>
      )}

      {/* Empty — only after both auth + data have settled. */}
      {!authLoading && !loading && campaigns.length === 0 && (
        <div className="glass-card text-center p-6 mb-4">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-primary/10">
            <ScrollText className="w-6 h-6 text-primary/80" />
          </div>
          <p className="text-[14px] font-extrabold tracking-tight">No campaigns yet</p>
          <p className="text-[11.5px] text-muted-foreground/75 mt-1 leading-snug">
            Create a campaign proposal and send it to your club owner for approval.
          </p>
          <button
            type="button"
            onClick={() => navigate('/narrative/new')}
            className="mt-4 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-[12px] font-extrabold"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))',
              color: 'hsl(var(--primary-foreground))',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" /> Propose a campaign
          </button>
        </div>
      )}

      {/* Pending approval (admins only) */}
      {isClubAdmin && pending.length > 0 && (
        <section className="mb-5">
          <SectionHeader label="Awaiting your approval" accent="38 95% 50%" count={pending.length} />
          <motion.div className="space-y-2" variants={STAGGER_PARENT} initial="initial" animate="animate">
            {pending.map(c => <CampaignRow key={c.id} campaign={c} highlight="warning" />)}
          </motion.div>
        </section>
      )}

      {/* Live / Active campaigns */}
      {live.length > 0 && (
        <section className="mb-5">
          <SectionHeader label="Active Campaigns" count={live.length} />
          <motion.div className="space-y-2" variants={STAGGER_PARENT} initial="initial" animate="animate">
            {live.map(c => <CampaignRow key={c.id} campaign={c} />)}
          </motion.div>
        </section>
      )}

      {/* My pending / draft */}
      {mine.length > 0 && (
        <section className="mb-5">
          <SectionHeader label="Your proposals" count={mine.length} />
          <motion.div className="space-y-2" variants={STAGGER_PARENT} initial="initial" animate="animate">
            {mine.map(c => <CampaignRow key={c.id} campaign={c} />)}
          </motion.div>
        </section>
      )}

      {/* Completed / archived */}
      {completed.length > 0 && (
        <section className="mb-5">
          <SectionHeader label="Past campaigns" count={completed.length} />
          <motion.div className="space-y-2" variants={STAGGER_PARENT} initial="initial" animate="animate">
            {completed.map(c => <CampaignRow key={c.id} campaign={c} />)}
          </motion.div>
        </section>
      )}
    </div>
  );
}

function CampaignRow({ campaign, highlight }: { campaign: Campaign; highlight?: 'warning' }) {
  const template = getTemplate(campaign.template_key);
  const flamingo = isFlamingoCampaign(campaign.template_key);
  // Flamingo campaigns get a toned-down pink-glow edge in the list —
  // enough to read as "flagship" without overpowering the rest of the
  // campaigns surface or other parts of the app.
  const borderColor = flamingo
    ? `hsl(${FLAMINGO.pink} / 0.45)`
    : highlight === 'warning'
      ? 'hsl(38 95% 50% / 0.45)'
      : 'hsl(var(--border) / 0.4)';
  return (
    <motion.div
      variants={STAGGER_CHILD}
      whileHover={{ y: -2, transition: { type: 'spring', stiffness: 380, damping: 28 } }}
      whileTap={TAP_PRESS}
    >
    <Link
      to={`/narrative/${campaign.id}`}
      className="block"
    >
      <div
        className="rounded-2xl bg-card border p-3.5 flex items-start gap-3 transition-shadow"
        style={{
          borderColor,
          boxShadow: flamingo ? `0 0 14px -6px hsl(${FLAMINGO.pink} / 0.5)` : '0 1px 0 hsl(0 0% 0% / 0.08)',
        }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={
            flamingo
              ? {
                  background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.22), hsl(${FLAMINGO.cyan} / 0.12))`,
                  color: `hsl(${FLAMINGO.pink})`,
                  border: `1px solid hsl(${FLAMINGO.pink} / 0.4)`,
                }
              : {
                  background: 'linear-gradient(135deg, hsl(var(--primary) / 0.16), hsl(var(--primary) / 0.04))',
                  color: 'hsl(var(--primary))',
                }
          }
        >
          <ScrollText className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5 flex-wrap">
            <h3 className="text-[14px] font-extrabold tracking-tight leading-[1.2] line-clamp-2 break-words flex-1 min-w-0">{campaign.title}</h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <CampaignStatusPill status={campaign.status} withPulse={campaign.status === 'active' || campaign.status === 'pending_approval'} />
              {flamingo && <FlamingoBrandBadge />}
            </div>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mt-0.5">
            {template.name}
          </p>
          {campaign.pitch && (
            <p className="text-[11.5px] text-muted-foreground/80 mt-1 leading-snug line-clamp-2">
              {campaign.pitch}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground/60">
            <span className="inline-flex items-center gap-1"><Users className="w-2.5 h-2.5" />
              {campaign.player_limit ? `up to ${campaign.player_limit}` : 'open table'}
            </span>
            <span>·</span>
            <span className="uppercase tracking-wider font-bold">{campaign.play_mode}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-1.5" />
      </div>
    </Link>
    </motion.div>
  );
}
