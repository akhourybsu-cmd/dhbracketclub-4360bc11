// DH Club — Narrative RPG · Campaign detail page (/narrative/:campaignId)
//
// Mobile-first campaign view. Tabs: Story (default), Characters, World,
// Log. The GM gets a floating "GM" button that opens the Console drawer.
// Pending/non-active campaigns render a status banner instead of
// the play surface.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, ScrollText, MessageSquareText, Users, Globe2, ListChecks,
  Sparkles, Plus, UserPlus, Settings2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useClub } from '@/contexts/ClubContext';
import { useNarrativeCampaign } from '@/hooks/useNarrativeCampaign';
import { useNarrativeCampaigns } from '@/hooks/useNarrativeCampaigns';
import { CampaignStatusPill } from '@/components/narrative/CampaignStatusPill';
import { StoryChat } from '@/components/narrative/StoryChat';
import { CharacterCreationSheet } from '@/components/narrative/CharacterCreationSheet';
import { CharacterSheetCard } from '@/components/narrative/CharacterSheetCard';
import { GMConsoleSheet } from '@/components/narrative/GMConsoleSheet';
import { MemberManagementSheet } from '@/components/narrative/MemberManagementSheet';
import { LiveSessionControls } from '@/components/narrative/LiveSessionControls';
import { LiveSessionPresence } from '@/components/narrative/LiveSessionPresence';
import { InviteRsvpBanner } from '@/components/narrative/InviteRsvpBanner';
import { ClockCard } from '@/components/narrative/ClockCard';
import { SectionHeader } from '@/components/home/SectionHeader';
import { StatusPill } from '@/components/ui/status-pill';
import { getTemplate, type TemplateKey } from '@/lib/narrative/templates';
import { computeCampaignStatus } from '@/lib/narrative/campaignStatus';
import { isFlamingoCampaign, FLAMINGO } from '@/lib/narrative/flamingoTheme';
import {
  FlamingoCampaignShell, FlamingoCampaignHeader, FlamingoTabs,
  FlamingoCharacterCard, FlamingoMeter, FlamingoClueMarker, clueAccent,
} from '@/components/narrative/flamingo';
import { NarrativePageHeader } from '@/components/narrative/NarrativePageHeader';
import { NarrativeDetailSheet, type DetailSheetSection } from '@/components/narrative/NarrativeDetailSheet';
import { WaitingOnSheet } from '@/components/narrative/WaitingOnSheet';
import { GmOnboardingSheet, gmOnboardingNeeded } from '@/components/narrative/GmOnboardingSheet';
import { Clock as ClockIcon } from 'lucide-react';
import { CHRONICLE_STATS, getStatMeta } from '@/lib/narrative/chronicleRuleset';
import type { NPC, Clue, Faction, Character, Location as NarrativeLocation } from '@/lib/narrative/types';

type Tab = 'story' | 'characters' | 'world' | 'log';
type DetailTarget =
  | { kind: 'npc'; row: NPC }
  | { kind: 'clue'; row: Clue }
  | { kind: 'faction'; row: Faction }
  | { kind: 'location'; row: NarrativeLocation }
  | { kind: 'character'; row: Character; showPrivate: boolean };

export default function NarrativeCampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isClubAdmin } = useClub();
  const { submitForApproval } = useNarrativeCampaigns();
  const data = useNarrativeCampaign(campaignId);
  const [tab, setTab] = useState<Tab>('story');
  const [creatingChar, setCreatingChar] = useState(false);
  const [gmOpen, setGmOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [waitingOpen, setWaitingOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  // Auto-open GM onboarding once per (campaign, device) — only after
  // data has loaded and only for the actual GM / creator. New campaigns
  // start as a blank canvas; this sheet explains the setting, offers
  // an opt-in starter-asset pre-fill, and gives a console tour.
  useEffect(() => {
    if (data.loading) return;
    if (!data.campaign || !user) return;
    const isGmForThis =
      data.isGm
      || data.campaign.gm_id === user.id
      || data.campaign.created_by === user.id;
    if (!isGmForThis) return;
    if (!gmOnboardingNeeded(data.campaign.id)) return;
    setOnboardingOpen(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loading, data.campaign?.id, data.isGm]);
  // Open-detail target for World tab cards — tapping any NPC / clue /
  // faction / location card opens a bottom sheet with the full info,
  // so the row itself can stay tight on mobile.
  const [detailTarget, setDetailTarget] = useState<DetailTarget | null>(null);

  const isActive = data.campaign?.status === 'active' || data.campaign?.status === 'paused';

  const publicClocks   = useMemo(() => data.clocks.filter(c => c.visibility === 'public'), [data.clocks]);
  const publicNpcs     = useMemo(() => data.npcs.filter(n => n.visibility === 'public'),   [data.npcs]);
  const publicClues    = useMemo(() => data.clues.filter(c => c.visibility === 'public' || data.isGm),  [data.clues, data.isGm]);
  const publicFactions = useMemo(() => data.factions.filter(f => f.visibility === 'public' || data.isGm), [data.factions, data.isGm]);

  // Skeleton conditions:
  //   1. Auth context is still hydrating (authLoading=true) — we can't
  //      yet know if the user is signed in.
  //   2. Data hook is hydrating AND we don't have a campaign yet.
  // Either keeps the skeleton up. Once both resolve, we either render
  // the campaign or fall through to the "Campaign not found" state.
  if (authLoading || (data.loading && !data.campaign)) {
    // Layout-matching skeleton — same chrome shapes as the real page so
    // there's no jank when content swaps in. Each block uses the
    // skeleton-shimmer animation defined in index.css.
    return (
      <div className="flex flex-col h-[calc(100dvh-3rem-env(safe-area-inset-top,0px))]">
        {/* Header skeleton */}
        <div className="flex-shrink-0 px-3 py-2.5 border-b border-border/15 flex items-center gap-2" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}>
          <div className="w-9 h-9 rounded-lg skeleton-shimmer" />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-24 rounded-full skeleton-shimmer" />
            <div className="h-3.5 w-40 rounded-md skeleton-shimmer" />
          </div>
          <div className="w-9 h-9 rounded-lg skeleton-shimmer" />
        </div>
        {/* Tab strip skeleton */}
        <div className="px-3 py-2 border-b border-border/10 grid grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg skeleton-shimmer" />)}
        </div>
        {/* Scene + chat skeleton */}
        <div className="px-4 py-3 space-y-2.5">
          <div className="h-14 rounded-xl skeleton-shimmer" />
          <div className="flex justify-start"><div className="h-10 w-2/3 rounded-2xl skeleton-shimmer" /></div>
          <div className="flex justify-end"><div className="h-10 w-1/2 rounded-2xl skeleton-shimmer" /></div>
          <div className="flex justify-start"><div className="h-14 w-3/4 rounded-2xl skeleton-shimmer" /></div>
          <div className="flex justify-start"><div className="h-10 w-1/2 rounded-2xl skeleton-shimmer" /></div>
        </div>
      </div>
    );
  }

  if (!data.campaign) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-[13px] font-extrabold">Campaign not found</p>
        <button onClick={() => navigate('/narrative')} className="mt-3 text-[11px] font-bold text-primary">
          Back to campaigns
        </button>
      </div>
    );
  }

  const campaign = data.campaign;
  const template = getTemplate(campaign.template_key as TemplateKey);
  const flamingo = isFlamingoCampaign(campaign.template_key);
  const computedStatus = computeCampaignStatus({ campaign, recentMessages: data.messages });
  const pendingAiCount = data.aiSuggestions.filter(s => s.status === 'pending' || s.status === 'edited').length;

  // Flamingo Protocol campaigns render inside the neon shell. Other
  // campaigns use a plain flex column (calm shell).
  const PageWrap = (flamingo
    ? FlamingoCampaignShell
    : ({ children }: { children: ReactNode }) => <>{children}</>
  ) as (props: { children: ReactNode }) => JSX.Element;

  return (
    <div className="flex flex-col h-[calc(100dvh-3rem-env(safe-area-inset-top,0px))]">
      <PageWrap>
      {/* Compact header — Flamingo or calm depending on template. */}
      {flamingo ? (
        <FlamingoCampaignHeader
          campaign={campaign}
          computedStatus={computedStatus}
          onBack={() => navigate('/narrative')}
          pendingAiCount={pendingAiCount}
          canOpenGmConsole={data.isGm && isActive}
          onOpenGmConsole={() => setGmOpen(true)}
          canManageMembers={(data.isGm || data.myRole === 'game_master' || isClubAdmin) && isActive}
          onManageMembers={() => setMembersOpen(true)}
        />
      ) : (
      <div
        className="flex-shrink-0 px-3 py-2.5 border-b border-border/20 bg-background/90 backdrop-blur-md flex items-center gap-2"
        style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0px))' }}
      >
        <button
          onClick={() => navigate('/narrative')}
          aria-label="Back"
          className="w-9 h-9 rounded-lg bg-muted/30 flex items-center justify-center active:scale-95 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5 flex-wrap">
            <h1 className="text-[14px] font-extrabold tracking-tight leading-[1.2] line-clamp-2 break-words">{campaign.title}</h1>
            <CampaignStatusPill
              status={computeCampaignStatus({ campaign, recentMessages: data.messages })}
              withPulse
            />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65">
            {template.name}
          </p>
        </div>
        {(data.isGm || data.myRole === 'game_master' || isClubAdmin) && isActive && (
          <button
            type="button"
            onClick={() => setMembersOpen(true)}
            aria-label="Manage members"
            className="h-9 w-9 rounded-lg text-muted-foreground/75 bg-muted/30 border border-border/40 inline-flex items-center justify-center active:scale-95 transition"
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        )}
        {data.isGm && isActive && (() => {
          // Open suggestions = pending + edited (edited still needs final approval).
          const pendingCount = data.aiSuggestions.filter(s => s.status === 'pending' || s.status === 'edited').length;
          return (
            <button
              type="button"
              onClick={() => setGmOpen(true)}
              aria-label={pendingCount > 0 ? `Open GM Console — ${pendingCount} pending` : 'Open GM Console'}
              className="relative h-9 px-2.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1 active:scale-95 transition"
              style={{ background: 'hsl(var(--gold) / 0.18)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.4)' }}
            >
              <Sparkles className="w-3 h-3" /> GM
              {pendingCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold tabular-nums inline-flex items-center justify-center ring-2 ring-background"
                  style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
                >
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </button>
          );
        })()}
      </div>
      )}

      {/* Pending / approval banner */}
      {!isActive && (
        <div className="px-4 py-4 space-y-3">
          {campaign.status === 'draft' && (
            <BannerCard
              title="This campaign is a draft"
              body="Submit it for club-owner approval when you're ready to play."
              cta={user?.id === campaign.created_by ? { label: 'Submit for approval', onClick: async () => { await submitForApproval(campaign.id); toast.success('Submitted.'); data.refresh(); } } : undefined}
            />
          )}
          {campaign.status === 'pending_approval' && (
            <BannerCard
              title="Awaiting approval"
              body="A club owner will review this campaign before it goes live."
            />
          )}
          {campaign.status === 'needs_changes' && (
            <BannerCard
              title="Changes requested"
              body={campaign.approval_notes ?? 'A club owner has asked for changes — edit the proposal and re-submit.'}
              cta={user?.id === campaign.created_by ? { label: 'Submit again', onClick: async () => { await submitForApproval(campaign.id); toast.success('Re-submitted.'); data.refresh(); } } : undefined}
            />
          )}
          {campaign.status === 'rejected' && (
            <BannerCard
              title="Campaign rejected"
              body={campaign.approval_notes ?? 'A club owner declined this campaign.'}
            />
          )}
          {campaign.pitch && (
            <div className="rounded-2xl bg-card border border-border/40 p-3.5">
              <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">Pitch</p>
              <p className="text-[12.5px] text-foreground/85 leading-snug mt-1">{campaign.pitch}</p>
            </div>
          )}
          {campaign.opening_premise && (
            <div className="rounded-2xl bg-card border border-border/40 p-3.5">
              <p className="text-[9.5px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground/65">Opening premise</p>
              <p className="text-[12.5px] text-foreground/85 leading-snug mt-1 whitespace-pre-wrap">{campaign.opening_premise}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab strip (only for active/paused campaigns) — Flamingo flavor
          on Flamingo Protocol campaigns, calm grid otherwise. */}
      {isActive && (flamingo ? (
        <FlamingoTabs value={tab as any} onChange={(next) => setTab(next as Tab)} />
      ) : (
        <div className="px-3 py-2 border-b border-border/15 flex-shrink-0">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted/30 p-1">
            {(['story', 'characters', 'world', 'log'] as Tab[]).map(t => {
              const selected = tab === t;
              const Icon = t === 'story' ? MessageSquareText : t === 'characters' ? Users : t === 'world' ? Globe2 : ListChecks;
              return (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`inline-flex items-center justify-center gap-1 h-9 rounded-lg text-[11px] font-extrabold uppercase tracking-wider transition ${selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground/75'}`}
                >
                  <Icon className="w-3 h-3" /> {t}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Pending invite — viewer was invited but hasn't accepted yet.
          Rendered above the live strip so it's the first thing they see. */}
      {isActive && user && (() => {
        const invite = data.members.find(m => m.user_id === user.id && m.status === 'invited');
        if (!invite) return null;
        return (
          <InviteRsvpBanner
            invitation={invite}
            campaignTitle={campaign.title}
            onResponded={data.refresh}
          />
        );
      })()}

      {/* Live session strip — shown on active campaigns when GM (controls)
          OR for everyone if already live (read-only "Live Now" pill).
          Presence row sits next to the controls so the table can see who
          else is actively in the campaign right now. */}
      {isActive && (data.isGm || campaign.live_session_id) && (
        <div className="px-3 py-2 border-b border-border/15 flex items-center gap-2 flex-wrap">
          <LiveSessionControls
            campaign={campaign}
            currentScene={data.currentScene}
            onChanged={data.refresh}
            readOnly={!data.isGm}
          />
          <LiveSessionPresence
            campaignId={campaign.id}
            myCharacterId={data.myCharacter?.id ?? null}
            myCharacterName={data.myCharacter?.name ?? null}
          />
          {/* GM-only: pin who the GM is waiting on. Persists across
              refresh and feeds the campaign status pill. The button
              shows the current pin state at a glance. */}
          {data.isGm && (() => {
            const w = campaign.waiting_on_state ?? {};
            const isPinned = w.mode === 'all' || w.mode === 'specific';
            const label = w.mode === 'all'
              ? 'Waiting · all'
              : w.mode === 'specific'
                ? `Waiting · ${(w.player_ids ?? []).length}`
                : 'Waiting on…';
            return (
              <button
                type="button"
                onClick={() => setWaitingOpen(true)}
                aria-label="Set waiting-on pin"
                className="inline-flex items-center gap-1 h-9 px-3 rounded-lg text-[11px] font-extrabold uppercase tracking-wider active:scale-95 transition"
                style={isPinned
                  ? { background: 'hsl(var(--gold) / 0.2)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.55)' }
                  : { background: 'hsl(var(--muted) / 0.3)', color: 'hsl(var(--muted-foreground) / 0.85)', border: '1px solid hsl(var(--border) / 0.5)' }}
              >
                <ClockIcon className="w-3 h-3" /> {label}
              </button>
            );
          })()}
        </div>
      )}

      {/* Tab content */}
      {isActive && tab === 'story' && (
        <StoryChat
          campaign={campaign}
          isGm={data.isGm}
          myRole={data.myRole}
          myCharacter={data.myCharacter}
          characters={data.characters}
          members={data.members}
          scenes={data.scenes}
          currentScene={data.currentScene}
          messages={data.messages}
          clocks={publicClocks}
          onPost={data.postMessage as any}
          onRoll={data.rollDice as any}
        />
      )}

      {isActive && tab === 'characters' && (
        <div className="flex-1 overflow-y-auto pb-3 space-y-3">
          <NarrativePageHeader
            label={flamingo ? 'Cast' : 'Characters'}
            subtitle={flamingo ? 'Players & NPCs in the crew.' : 'Player characters and active personalities.'}
            flamingo={flamingo}
          />
        <div className="px-4 space-y-3">
          {/* Active player/GM with no character yet → primary CTA. */}
          {!data.myCharacter && (data.myRole === 'player' || data.myRole === 'game_master') && (
            <div className="rounded-2xl bg-card border border-dashed border-primary/40 p-4 text-center">
              <ScrollText className="w-6 h-6 mx-auto text-primary mb-2" />
              <p className="text-[13px] font-extrabold">Create your character before entering the story.</p>
              <button
                onClick={() => setCreatingChar(true)}
                className="mt-3 inline-flex items-center gap-1.5 h-10 px-4 rounded-xl text-[12px] font-extrabold"
                style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))', color: 'hsl(var(--primary-foreground))' }}
              >
                <UserPlus className="w-3.5 h-3.5" /> Create character
              </button>
            </div>
          )}
          {/* No member row at all → explain how to join. RLS would
              reject the insert anyway; surfacing a clear message
              prevents the silent-failure path the user reported. */}
          {!data.myCharacter && data.myRole === null && user?.id !== campaign.created_by && campaign.gm_id !== user?.id && (
            <div className="rounded-2xl bg-card border border-dashed border-warning/40 p-4 text-center">
              <ScrollText className="w-6 h-6 mx-auto text-warning mb-2" />
              <p className="text-[13px] font-extrabold">You're viewing this campaign, but you haven't joined yet.</p>
              <p className="text-[11.5px] text-muted-foreground/75 mt-1 leading-snug">
                Ask the Game Master to invite you. Once you accept the invite you'll be able to create a character.
              </p>
            </div>
          )}
          {data.myCharacter && (
            <>
              <SectionHeader label={flamingo ? 'Your dossier' : 'Your character'} accent="var(--primary)" />
              {flamingo ? (
                <FlamingoCharacterCard character={data.myCharacter} showPrivate />
              ) : (
                <CharacterSheetCard character={data.myCharacter} showPrivate />
              )}
            </>
          )}
          {data.characters.filter(c => c.id !== data.myCharacter?.id).length > 0 && (
            <>
              <SectionHeader label={flamingo ? 'The crew' : 'The party'} count={data.characters.length} />
              <div className="space-y-2">
                {data.characters.filter(c => c.id !== data.myCharacter?.id).map(c => (
                  // Collapsed crew row — name + archetype + mini stat
                  // strip. Tap opens the full character sheet (with
                  // stats grid, backstory, conditions, etc.) in the
                  // shared NarrativeDetailSheet. Keeps the Cast tab
                  // scannable on mobile.
                  <CompactCharacterRow
                    key={c.id}
                    character={c}
                    flamingo={flamingo}
                    onOpen={() => setDetailTarget({ kind: 'character', row: c, showPrivate: data.isGm })}
                  />
                ))}
              </div>
            </>
          )}
          </div>
        </div>
      )}

      {isActive && tab === 'world' && (() => {
        // Build each section as a keyed node so we can reorder for
        // narrative flow without duplicating JSX. Flamingo order goes
        // stakes → heat → evidence → cast → places. Non-Flamingo keeps
        // the cast-first order familiar from trad RPG tools.
        const npcsSection = publicNpcs.length > 0 && (
            <section key="npcs">
              <SectionHeader label={flamingo ? 'Known players' : 'Notable NPCs'} count={publicNpcs.length} />
              <div className="space-y-2">
                {publicNpcs.map(n => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setDetailTarget({ kind: 'npc', row: n })}
                    className="w-full text-left active:scale-[0.99] transition-transform"
                    aria-label={`Open details for ${n.name}`}
                  >
                    {flamingo ? (
                      <FlamingoEntityCard
                        title={n.name}
                        eyebrow={n.role ?? undefined}
                        body={n.description ? truncateOneLine(n.description) : undefined}
                        accent={FLAMINGO.gold}
                      />
                    ) : (
                      <div className="rounded-xl bg-card border border-border/40 p-3">
                        <p className="text-[12.5px] font-extrabold">{n.name}</p>
                        {n.role && <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65">{n.role}</p>}
                        {n.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1 line-clamp-2">{n.description}</p>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          );
        const cluesSection = publicClues.length > 0 && (
            <section key="clues">
              <SectionHeader label={flamingo ? 'Case board' : 'Clues'} count={publicClues.length} />
              <div className="space-y-2">
                {publicClues.map(c => (
                  flamingo ? (
                    // Flamingo clue card uses a status-driven left-rule
                    // accent + the icon marker instead of a status text
                    // pill. The shape carries the meaning at a glance.
                    // The `narrative-flash` class fires a one-shot pulse
                    // when this clue was just mutated by an approved
                    // AI state update (see useNarrativeCampaign.recentlyChanged).
                    // The whole card is a button that opens the detail
                    // sheet — full description stays out of the inline
                    // view so the World tab scrolls cleanly on mobile.
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDetailTarget({ kind: 'clue', row: c })}
                      aria-label={`Open details for ${c.name}`}
                      className={`w-full text-left rounded-xl p-3 relative overflow-hidden active:scale-[0.99] transition-transform ${data.recentlyChanged.has(c.id) ? 'narrative-flash' : ''}`}
                      style={{
                        background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
                        border: `1px solid hsl(${clueAccent(c.status)} / 0.4)`,
                        boxShadow: `0 0 12px -6px hsl(${clueAccent(c.status)} / 0.45)`,
                        color: `hsl(${FLAMINGO.paper})`,
                      }}
                    >
                      <div
                        aria-hidden
                        className="absolute left-0 top-0 bottom-0 w-1"
                        style={{ background: `hsl(${clueAccent(c.status)})` }}
                      />
                      <div className="pl-2 flex items-start gap-2">
                        <FlamingoClueMarker status={c.status} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-extrabold leading-tight break-words">{c.name}</p>
                          {c.description && (
                            <p
                              className="text-[11.5px] leading-snug mt-1 line-clamp-2"
                              style={{ color: `hsl(${FLAMINGO.paper} / 0.82)` }}
                            >
                              {c.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDetailTarget({ kind: 'clue', row: c })}
                      aria-label={`Open details for ${c.name}`}
                      className="w-full text-left rounded-xl bg-card border border-border/40 p-3 active:scale-[0.99] transition-transform"
                    >
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span className="text-[12.5px] font-extrabold break-words flex-1 min-w-0">{c.name}</span>
                        <StatusPill variant={c.status === 'solved' ? 'success' : c.status === 'false_lead' ? 'danger' : c.status === 'partial' ? 'warning' : 'info'} size="xs">
                          {c.status.replace('_', ' ')}
                        </StatusPill>
                      </div>
                      {c.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1 line-clamp-2">{c.description}</p>}
                    </button>
                  )
                ))}
              </div>
            </section>
          );
        const factionsSection = publicFactions.length > 0 && (
            <section key="factions">
              <SectionHeader label={flamingo ? 'Power players' : 'Factions'} count={publicFactions.length} />
              <div className="space-y-2">
                {publicFactions.map(f => (
                  flamingo ? (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDetailTarget({ kind: 'faction', row: f })}
                      aria-label={`Open details for ${f.name}`}
                      className={`w-full text-left rounded-xl p-3 relative overflow-hidden active:scale-[0.99] transition-transform ${data.recentlyChanged.has(f.id) ? 'narrative-flash' : ''}`}
                      style={{
                        background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
                        border: `1px solid hsl(${FLAMINGO.violet} / 0.4)`,
                        boxShadow: `0 0 12px -6px hsl(${FLAMINGO.violet} / 0.45)`,
                        color: `hsl(${FLAMINGO.paper})`,
                      }}
                    >
                      <div
                        aria-hidden
                        className="absolute left-0 top-0 bottom-0 w-1"
                        style={{ background: `hsl(${FLAMINGO.violet})` }}
                      />
                      <div className="pl-2 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12.5px] font-extrabold leading-tight line-clamp-2 break-words">{f.name}</p>
                          {f.attitude && (
                            <span
                              className="text-[9px] font-extrabold uppercase tracking-wider flex-shrink-0"
                              style={{ color: `hsl(${FLAMINGO.gold})` }}
                            >
                              {f.attitude}
                            </span>
                          )}
                        </div>
                        {f.description && (
                          <p
                            className="text-[11.5px] leading-snug"
                            style={{ color: `hsl(${FLAMINGO.paper} / 0.82)` }}
                          >
                            {f.description}
                          </p>
                        )}
                        {/* Heat meter — suspicion_score is naturally the
                            "heat" reading. Cyan→pink ramp signals risk. */}
                        <FlamingoMeter
                          label="Heat"
                          value={f.suspicion_score ?? 0}
                          max={10}
                          accent="heat"
                        />
                      </div>
                    </button>
                  ) : (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDetailTarget({ kind: 'faction', row: f })}
                      aria-label={`Open details for ${f.name}`}
                      className="w-full text-left rounded-xl bg-card border border-border/40 p-3 active:scale-[0.99] transition-transform"
                    >
                      <p className="text-[12.5px] font-extrabold break-words">{f.name}</p>
                      {f.attitude && (
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/65 mt-0.5">{f.attitude}</p>
                      )}
                      {f.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1 line-clamp-2">{f.description}</p>}
                    </button>
                  )
                ))}
              </div>
            </section>
          );
        const clocksSection = publicClocks.length > 0 && (
            <section key="clocks">
              <SectionHeader label={flamingo ? 'Heat & danger' : 'Active clocks'} count={publicClocks.length} />
              <div className="space-y-2">
                {publicClocks.map(c => (
                  <div key={c.id} className={data.recentlyChanged.has(c.id) ? 'narrative-flash rounded-2xl' : ''}>
                    <ClockCard clock={c} />
                  </div>
                ))}
              </div>
            </section>
          );
        const locationsSection = data.locations.length > 0 && (
            <section key="locations">
              <SectionHeader label={flamingo ? 'Velvetaine' : 'Locations'} count={data.locations.length} />
              <div className="space-y-2">
                {data.locations.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setDetailTarget({ kind: 'location', row: l })}
                    aria-label={`Open details for ${l.name}`}
                    className="w-full text-left active:scale-[0.99] transition-transform"
                  >
                    {flamingo ? (
                      <FlamingoEntityCard
                        title={l.name}
                        body={l.description ? truncateOneLine(l.description) : undefined}
                        accent={FLAMINGO.cyan}
                      />
                    ) : (
                      <div className="rounded-xl bg-card border border-border/40 p-3">
                        <p className="text-[12.5px] font-extrabold break-words">{l.name}</p>
                        {l.description && <p className="text-[11.5px] text-foreground/80 leading-snug mt-1 line-clamp-2">{l.description}</p>}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          );

        // Render order: Flamingo flows stakes-first (Power players →
        // Heat & danger → Case board → Known players → Velvetaine).
        // Calm shell keeps the cast-first reading order.
        const ordered = flamingo
          ? [factionsSection, clocksSection, cluesSection, npcsSection, locationsSection]
          : [npcsSection, cluesSection, factionsSection, clocksSection, locationsSection];
        const anyRendered = publicNpcs.length + publicClues.length + publicClocks.length + publicFactions.length + data.locations.length > 0;
        return (
          <div className="flex-1 overflow-y-auto pb-3">
            <NarrativePageHeader
              label={flamingo ? 'City' : 'World'}
              subtitle={flamingo
                ? 'Velvetaine — power players, heat, evidence, and locations.'
                : 'Locations, factions, clues, and active clocks.'}
              flamingo={flamingo}
            />
            <div className="px-4 space-y-4">
            {ordered}
            {!anyRendered && (
              <div
                className="rounded-xl p-4 text-center"
                style={flamingo ? {
                  background: `hsl(${FLAMINGO.ink} / 0.6)`,
                  border: `1px dashed hsl(${FLAMINGO.pink} / 0.3)`,
                } : {
                  background: 'hsl(var(--muted) / 0.25)',
                  border: '1px dashed hsl(var(--border) / 0.4)',
                }}
              >
                <p
                  className="text-[11.5px]"
                  style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.7)` : 'hsl(var(--muted-foreground) / 0.75)' }}
                >
                  {flamingo
                    ? 'Velvetaine sleeps. The GM lights the neon when the city wakes up.'
                    : 'The world is empty so far. The GM will populate it as the campaign unfolds.'}
                </p>
              </div>
            )}
            </div>
          </div>
        );
      })()}

      {isActive && tab === 'log' && (
        <div className="flex-1 overflow-y-auto pb-3">
          <NarrativePageHeader
            label={flamingo ? 'Chronicle' : 'Log'}
            subtitle={flamingo
              ? 'Episodes filed by chapter. Tap a chapter to jump.'
              : 'Scene cards, chapter transitions, and campaign summaries.'}
            flamingo={flamingo}
          />
          <div className="px-4">
          {(() => {
            const logEvents = data.messages.filter(m =>
              m.message_type === 'scene_card' ||
              m.message_type === 'chapter_transition' ||
              m.message_type === 'campaign_summary'
            );
            // Group log entries under their parent chapter. A chapter
            // starts at each chapter_transition message; everything
            // until the next transition belongs to that chapter. The
            // grouping is purely presentational — we don't touch the
            // underlying chapter table.
            type Group = { title: string; transition: typeof logEvents[number] | null; entries: typeof logEvents };
            const groups: Group[] = [];
            let current: Group = { title: 'Prologue', transition: null, entries: [] };
            for (const e of logEvents) {
              if (e.message_type === 'chapter_transition') {
                if (current.entries.length > 0 || current.transition) groups.push(current);
                current = { title: e.body || 'New Chapter', transition: e, entries: [] };
              } else {
                current.entries.push(e);
              }
            }
            if (current.entries.length > 0 || current.transition) groups.push(current);

            if (logEvents.length === 0) {
              return (
                <div
                  className="rounded-xl p-4 text-center"
                  style={flamingo ? {
                    background: `hsl(${FLAMINGO.ink} / 0.6)`,
                    border: `1px dashed hsl(${FLAMINGO.pink} / 0.3)`,
                  } : {
                    background: 'hsl(var(--muted) / 0.25)',
                    border: '1px dashed hsl(var(--border) / 0.4)',
                  }}
                >
                  <p style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.7)` : 'hsl(var(--muted-foreground) / 0.75)' }} className="text-[11.5px]">
                    {flamingo
                      ? 'No episodes filmed yet. The crew hasn\'t made the wire.'
                      : 'No log entries yet.'}
                  </p>
                </div>
              );
            }
            const labelMap: Record<string, string> = flamingo
              ? { scene_card: 'Scene · Roll Sound', campaign_summary: 'Episode Recap' }
              : { scene_card: 'Scene', campaign_summary: 'Campaign Summary' };
            return (
              <div className="space-y-4">
                {groups.map((g, gi) => (
                  <section key={gi}>
                    {/* Sticky chapter title bar — anchors at the top of
                        the scroll container so the reader always knows
                        which chapter they're in while scrolling a long
                        recap. backdrop-blur + alpha-mixed bg keeps the
                        entries readable through the bar. */}
                    <div
                      className="rounded-xl px-3 py-2 mb-2 flex items-center gap-2 sticky top-0 z-10 backdrop-blur"
                      style={flamingo ? {
                        background: `linear-gradient(135deg, hsl(${FLAMINGO.midnight} / 0.92), hsl(${FLAMINGO.ink} / 0.88))`,
                        border: `1px solid hsl(${FLAMINGO.pink} / 0.45)`,
                        boxShadow: `0 4px 12px -6px hsl(${FLAMINGO.pink} / 0.5)`,
                      } : {
                        background: 'hsl(var(--background) / 0.92)',
                        border: '1px solid hsl(var(--border) / 0.5)',
                      }}
                    >
                      <span
                        aria-hidden
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          background: flamingo ? `hsl(${FLAMINGO.pink})` : 'hsl(var(--primary))',
                          boxShadow: flamingo ? `0 0 6px hsl(${FLAMINGO.pink})` : undefined,
                        }}
                      />
                      <h3
                        className="text-[13px] font-extrabold tracking-tight leading-tight line-clamp-2 break-words flex-1 min-w-0"
                        style={flamingo ? {
                          backgroundImage: `linear-gradient(90deg, hsl(${FLAMINGO.paper}), hsl(${FLAMINGO.pink}))`,
                          WebkitBackgroundClip: 'text',
                          backgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          color: 'transparent',
                        } : undefined}
                      >
                        {g.title}
                      </h3>
                      <span
                        className="text-[9.5px] font-extrabold tabular-nums flex-shrink-0"
                        style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.5)` : 'hsl(var(--muted-foreground) / 0.6)' }}
                      >
                        {g.entries.length}
                      </span>
                    </div>
                    {g.entries.length === 0 ? (
                      <p
                        className="text-[10.5px] italic px-2"
                        style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.5)` : 'hsl(var(--muted-foreground) / 0.55)' }}
                      >
                        Nothing filed under this chapter yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {g.entries.map(e => {
                          const accent = flamingo
                            ? (e.message_type === 'campaign_summary' ? FLAMINGO.cyan : FLAMINGO.gold)
                            : null;
                          return (
                            <ChronicleLogEntry
                              key={e.id}
                              eyebrow={labelMap[e.message_type] ?? e.message_type.replace('_', ' ')}
                              body={e.body ?? ''}
                              accent={accent}
                              flamingo={flamingo}
                            />
                          );
                        })}
                      </div>
                    )}
                  </section>
                ))}
              </div>
            );
          })()}
          </div>
        </div>
      )}

      {/* Sheets / drawers */}
      <CharacterCreationSheet
        open={creatingChar}
        onClose={() => setCreatingChar(false)}
        templateKey={campaign.template_key as TemplateKey}
        onCreate={async (input) => data.createCharacter(input)}
      />
      {data.isGm && (
        <GMConsoleSheet
          open={gmOpen}
          onClose={() => setGmOpen(false)}
          campaign={campaign}
          currentScene={data.currentScene}
          scenes={data.scenes}
          npcs={data.npcs}
          clues={data.clues}
          items={data.items}
          factions={data.factions}
          clocks={data.clocks}
          locations={data.locations}
          aiSuggestions={data.aiSuggestions}
          onCreateScene={data.createScene as any}
          onEndScene={data.endScene}
          onAdvanceClock={data.advanceClock}
          onCreateClock={data.createClock as any}
          onCreateNpc={data.createNpc as any}
          onCreateClue={data.createClue as any}
          onCreateFaction={data.createFaction as any}
          onCreateItem={data.createItem as any}
          onChanged={data.refresh}
        />
      )}
      {/* Member management + danger zone — GM, campaign creator, or
          club admin. Club admins are included because they're the only
          ones who can hard-delete a campaign (RLS gates that path);
          without this they'd have no UI entry point. */}
      {(data.isGm || isClubAdmin) && (
        <MemberManagementSheet
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          campaign={campaign}
          members={data.members}
          onChanged={data.refresh}
        />
      )}
      {/* Entity detail bottom sheet — opens when any World tab card
          is tapped. Builds its sections per kind. */}
      {detailTarget && (
        <NarrativeDetailSheet
          open={!!detailTarget}
          onClose={() => setDetailTarget(null)}
          {...buildDetailSheetProps(detailTarget, flamingo, data.isGm)}
        />
      )}
      {/* Waiting-on pin sheet — GM-only. */}
      {data.isGm && (
        <WaitingOnSheet
          open={waitingOpen}
          onClose={() => setWaitingOpen(false)}
          campaign={campaign}
          members={data.members}
          flamingo={flamingo}
          onSet={data.setWaitingOn}
        />
      )}
      {/* GM onboarding sheet — auto-opens on first GM visit. */}
      <GmOnboardingSheet
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        campaign={campaign}
        flamingo={flamingo}
        onSeeded={data.refresh}
      />
      {/* Manual re-open from the header is on the roadmap — for now,
          the user can clear localStorage to see it again. */}
      </PageWrap>
    </div>
  );
}

// One-line truncate helper — used on World tab card previews so a
// 600-char description doesn't push the card to 5 lines tall.
function truncateOneLine(s: string, max = 100): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
}

/** Log entry with "Read more" affordance. Long campaign summaries
 *  + chapter recaps clamp to 3 lines by default; tapping anywhere on
 *  the card expands inline. Short entries (≤ ~140 chars / single line)
 *  skip the toggle entirely. */
function ChronicleLogEntry({
  eyebrow, body, accent, flamingo,
}: { eyebrow: string; body: string; accent: string | null; flamingo: boolean }) {
  const [expanded, setExpanded] = useState(false);
  // Only show the Read-more affordance when the body would actually
  // overflow 3 lines. Cheap heuristic — line count by newline + char
  // count threshold. Avoids dangling "Read more" on one-liners.
  const isLong = body.length > 180 || body.split('\n').length > 3;
  return (
    <button
      type="button"
      onClick={() => isLong && setExpanded(v => !v)}
      disabled={!isLong}
      aria-expanded={isLong ? expanded : undefined}
      className="w-full text-left rounded-xl p-3 relative overflow-hidden transition-transform active:scale-[0.998] disabled:active:scale-100"
      style={flamingo && accent ? {
        background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
        border: `1px solid hsl(${accent} / 0.4)`,
        boxShadow: `0 0 12px -8px hsl(${accent} / 0.5)`,
      } : {
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border) / 0.4)',
      }}
    >
      {flamingo && accent && (
        <div aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ background: `hsl(${accent})` }} />
      )}
      <div className={flamingo ? 'pl-2' : ''}>
        <p
          className="text-[9.5px] font-extrabold uppercase tracking-[0.22em]"
          style={{ color: flamingo && accent ? `hsl(${accent})` : 'hsl(var(--muted-foreground) / 0.65)' }}
        >
          {eyebrow}
        </p>
        <p
          className={`text-[12.5px] leading-snug mt-1 whitespace-pre-wrap ${isLong && !expanded ? 'line-clamp-3' : ''}`}
          style={{ color: flamingo ? `hsl(${FLAMINGO.paper} / 0.9)` : 'hsl(var(--foreground) / 0.85)' }}
        >
          {body}
        </p>
        {isLong && (
          <span
            className="inline-block mt-1.5 text-[10.5px] font-extrabold uppercase tracking-wider"
            style={{ color: flamingo ? `hsl(${accent ?? FLAMINGO.cyan})` : 'hsl(var(--primary))' }}
          >
            {expanded ? 'Read less ↑' : 'Read more →'}
          </span>
        )}
      </div>
    </button>
  );
}

/** Collapsed crew row used in the Characters tab. Tap opens the full
 *  character sheet via NarrativeDetailSheet. Shows the same five
 *  Chronicle stats as a mini strip so glance-info is still there. */
function CompactCharacterRow({
  character, flamingo, onOpen,
}: { character: Character; flamingo: boolean; onOpen: () => void }) {
  const initial = character.name.charAt(0).toUpperCase();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${character.name}'s character sheet`}
      className="w-full text-left rounded-2xl p-3 active:scale-[0.99] transition-transform relative overflow-hidden"
      style={flamingo ? {
        background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}) 70%)`,
        border: `1px solid hsl(${FLAMINGO.pink} / 0.35)`,
        color: `hsl(${FLAMINGO.paper})`,
      } : {
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border) / 0.4)',
      }}
    >
      {flamingo && (
        <div
          aria-hidden
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: `linear-gradient(180deg, hsl(${FLAMINGO.pink}), hsl(${FLAMINGO.cyan}))` }}
        />
      )}
      <div className={`flex items-center gap-3 ${flamingo ? 'pl-2' : ''}`}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-extrabold flex-shrink-0"
          style={flamingo ? {
            background: `linear-gradient(135deg, hsl(${FLAMINGO.pink} / 0.28), hsl(${FLAMINGO.violet} / 0.18))`,
            color: `hsl(${FLAMINGO.paper})`,
            border: `1px solid hsl(${FLAMINGO.pink} / 0.5)`,
          } : {
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.04))',
            color: 'hsl(var(--primary))',
          }}
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-extrabold tracking-tight leading-tight break-words">{character.name}</p>
          {character.archetype && (
            <p
              className="text-[10.5px] font-bold uppercase tracking-wider mt-0.5 truncate"
              style={{ color: flamingo ? `hsl(${FLAMINGO.gold})` : 'hsl(var(--muted-foreground) / 0.7)' }}
            >
              {character.archetype}
            </p>
          )}
        </div>
        <ChevronLeft className="w-4 h-4 rotate-180 opacity-50 flex-shrink-0" />
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1">
        {CHRONICLE_STATS.map(s => {
          const meta = getStatMeta(s.id)!;
          const v = character[`stat_${s.id}` as keyof Character] as number;
          return (
            <div
              key={s.id}
              className="text-center rounded-md py-1"
              style={{ background: `hsl(${meta.accent} / 0.1)`, border: `1px solid hsl(${meta.accent} / 0.25)` }}
            >
              <p className="text-[7.5px] font-extrabold uppercase tracking-wider" style={{ color: `hsl(${meta.accent})` }}>
                {s.label.slice(0, 3)}
              </p>
              <p className="text-[12px] font-black tabular-nums leading-none mt-0.5" style={{ color: `hsl(${meta.accent})` }}>
                {v >= 0 ? `+${v}` : v}
              </p>
            </div>
          );
        })}
      </div>
    </button>
  );
}

/** Builds the props for NarrativeDetailSheet given a detail target.
 *  Lives outside the component body to keep the JSX above readable. */
function buildDetailSheetProps(
  target: DetailTarget,
  flamingo: boolean,
  isGm: boolean,
): {
  eyebrow?: string;
  title: string;
  accent?: string;
  sections: DetailSheetSection[];
  flamingo?: boolean;
} {
  switch (target.kind) {
    case 'npc': {
      const n = target.row;
      const sections: DetailSheetSection[] = [];
      if (n.role) sections.push({ label: 'Role', content: n.role });
      if (n.description) sections.push({ label: 'Description', content: n.description });
      if (n.location) sections.push({ label: 'Last seen', content: n.location });
      if (n.relationship) sections.push({ label: 'Relationship', content: n.relationship });
      if (n.voice_notes) sections.push({ label: 'Voice', content: n.voice_notes });
      if (isGm && n.motives) sections.push({ label: 'Motives', content: n.motives, gmOnly: true });
      if (isGm && n.secrets) sections.push({ label: 'Secrets', content: n.secrets, gmOnly: true });
      return { eyebrow: 'NPC', title: n.name, sections, flamingo, accent: flamingo ? FLAMINGO.gold : undefined };
    }
    case 'clue': {
      const c = target.row;
      const statusLabel = c.status.replace('_', ' ');
      const importanceLabel = c.importance ? c.importance.charAt(0).toUpperCase() + c.importance.slice(1) : null;
      const sections: DetailSheetSection[] = [];
      sections.push({ label: 'Status', content: statusLabel });
      if (importanceLabel) sections.push({ label: 'Importance', content: importanceLabel });
      if (c.description) sections.push({ label: 'Description', content: c.description });
      return {
        eyebrow: 'Evidence',
        title: c.name,
        sections,
        flamingo,
        accent: flamingo ? clueAccent(c.status) : undefined,
      };
    }
    case 'faction': {
      const f = target.row;
      const sections: DetailSheetSection[] = [];
      if (f.attitude) sections.push({ label: 'Attitude', content: f.attitude });
      sections.push({
        label: 'Heat',
        content: `${f.suspicion_score ?? 0} / 10`,
      });
      sections.push({
        label: 'Bond',
        content: `${f.relationship_score ?? 0} / 10`,
      });
      if (f.description) sections.push({ label: 'Description', content: f.description });
      if (f.public_notes) sections.push({ label: 'Notes', content: f.public_notes });
      if (isGm && f.gm_notes) sections.push({ label: 'GM notes', content: f.gm_notes, gmOnly: true });
      return { eyebrow: 'Faction', title: f.name, sections, flamingo, accent: flamingo ? FLAMINGO.violet : undefined };
    }
    case 'location': {
      const l = target.row;
      const sections: DetailSheetSection[] = [];
      if (l.region) sections.push({ label: 'Region', content: l.region });
      if (l.description) sections.push({ label: 'Description', content: l.description });
      return { eyebrow: 'Location', title: l.name, sections, flamingo, accent: flamingo ? FLAMINGO.cyan : undefined };
    }
    case 'character': {
      const c = target.row;
      // Stat grid as a single section so the 5-col layout survives the
      // sheet's vertical section stack. Reuses the same accent colors
      // the character cards use for visual consistency.
      const statGrid = (
        <div className="grid grid-cols-5 gap-1.5">
          {CHRONICLE_STATS.map(s => {
            const meta = getStatMeta(s.id)!;
            const v = c[`stat_${s.id}` as keyof Character] as number;
            return (
              <div
                key={s.id}
                className="rounded-lg p-1.5 text-center"
                style={{ background: `hsl(${meta.accent} / 0.12)`, border: `1px solid hsl(${meta.accent} / 0.4)` }}
              >
                <p className="text-[8px] font-extrabold uppercase tracking-wider" style={{ color: `hsl(${meta.accent})` }}>
                  {s.label.slice(0, 4)}
                </p>
                <p className="text-[15px] font-black tabular-nums leading-none mt-0.5" style={{ color: `hsl(${meta.accent})` }}>
                  {v >= 0 ? `+${v}` : v}
                </p>
              </div>
            );
          })}
        </div>
      );
      const conditions = Array.isArray(c.conditions) ? c.conditions : [];
      const inventory = Array.isArray(c.inventory) ? c.inventory : [];
      const sections: DetailSheetSection[] = [];
      sections.push({ label: 'Stats', content: statGrid });
      if (c.archetype) sections.push({ label: 'Archetype', content: c.archetype });
      if (c.signature_move) sections.push({ label: 'Signature move', content: c.signature_move });
      if (c.personality) sections.push({ label: 'Personality', content: c.personality });
      if (c.goal) sections.push({ label: 'Goal', content: c.goal });
      if (c.flaw) sections.push({ label: 'Flaw', content: c.flaw });
      if (c.backstory) sections.push({ label: 'Backstory', content: c.backstory });
      if (conditions.length > 0) {
        sections.push({
          label: 'Conditions',
          content: conditions.map((cond: any, i: number) =>
            <span key={i} className="inline-block mr-1.5 mb-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold" style={{ background: 'hsl(var(--danger) / 0.15)', color: 'hsl(var(--danger))', border: '1px solid hsl(var(--danger) / 0.4)' }}>{cond.label ?? String(cond)}</span>
          ),
        });
      }
      if (inventory.length > 0) {
        sections.push({
          label: 'Inventory',
          content: inventory.map((it: any, i: number) =>
            <span key={i} className="inline-block mr-1.5 mb-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold" style={{ background: 'hsl(var(--gold) / 0.15)', color: 'hsl(var(--gold))', border: '1px solid hsl(var(--gold) / 0.4)' }}>{it.name ?? String(it)}</span>
          ),
        });
      }
      if (target.showPrivate && c.notes_private) {
        sections.push({ label: 'Private notes', content: c.notes_private, gmOnly: true });
      }
      return {
        eyebrow: c.pronouns ? `Character · ${c.pronouns}` : 'Character',
        title: c.name,
        sections,
        flamingo,
        accent: flamingo ? FLAMINGO.pink : undefined,
      };
    }
  }
}

/** Small dossier/evidence card used in the Flamingo World tab for NPCs,
 *  clues, and locations. Status-pill style chip on the right when a
 *  `pill` label is provided (used for clue statuses). */
function FlamingoEntityCard({
  title, eyebrow, body, accent, pill, pillAccent,
}: {
  title: string;
  eyebrow?: string;
  body?: string;
  accent: string;
  pill?: string;
  pillAccent?: string;
}) {
  return (
    <div
      className="rounded-xl p-3 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, hsl(${FLAMINGO.ink}), hsl(${FLAMINGO.midnight}))`,
        border: `1px solid hsl(${accent} / 0.4)`,
        boxShadow: `0 0 12px -6px hsl(${accent} / 0.45)`,
        color: `hsl(${FLAMINGO.paper})`,
      }}
    >
      <div
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ background: `hsl(${accent})` }}
      />
      <div className="pl-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-extrabold leading-tight line-clamp-2 break-words">{title}</p>
          {eyebrow && (
            <p
              className="text-[10px] font-bold uppercase tracking-wider mt-0.5"
              style={{ color: `hsl(${accent})` }}
            >
              {eyebrow}
            </p>
          )}
          {body && (
            <p
              className="text-[11.5px] leading-snug mt-1"
              style={{ color: `hsl(${FLAMINGO.paper} / 0.82)` }}
            >
              {body}
            </p>
          )}
        </div>
        {pill && pillAccent && (
          <span
            className="flex-shrink-0 inline-block rounded-full px-1.5 py-[1px] text-[9px] font-extrabold uppercase tracking-[0.18em]"
            style={{
              background: `hsl(${pillAccent} / 0.2)`,
              color: `hsl(${pillAccent})`,
              border: `1px solid hsl(${pillAccent} / 0.5)`,
            }}
          >
            {pill}
          </span>
        )}
      </div>
    </div>
  );
}

function BannerCard({ title, body, cta }: { title: string; body: string; cta?: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-2xl bg-card border border-warning/35 p-3.5" style={{ background: 'hsl(38 95% 50% / 0.05)' }}>
      <p className="text-[12.5px] font-extrabold">{title}</p>
      <p className="text-[11.5px] text-foreground/80 leading-snug mt-1">{body}</p>
      {cta && (
        <button onClick={cta.onClick} className="mt-3 h-10 px-4 rounded-xl text-[12px] font-extrabold inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))', color: 'hsl(var(--primary-foreground))' }}>
          <Plus className="w-3.5 h-3.5" /> {cta.label}
        </button>
      )}
    </div>
  );
}
