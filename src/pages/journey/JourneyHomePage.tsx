import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Feather, Play, Plus, RotateCcw, PenTool } from 'lucide-react';
import { JourneyLayout, JourneyError, JourneySkeleton } from '@/components/journey/JourneyLayout';
import { StoryIntroduction } from '@/components/journey/StoryIntroduction';
import { prologueFor } from '@/lib/journey/prologues';
import { protagonistFor } from '@/lib/journey/protagonists';
import { useJourneyLibrary } from '@/hooks/useJourneyLibrary';
import { useClub } from '@/contexts/ClubContext';
import type { CampaignRow, HeroRow } from '@/lib/journey/types';


/** The campaign hall: continue an existing journey, or begin a new one. */
export default function JourneyHomePage() {
  const navigate = useNavigate();
  const { campaigns, runs, heroes, loading, error, refresh, createHero, startRun, currentRun } = useJourneyLibrary();
  const { isAppAdmin, isPlatformOwner } = useClub();
  const canAuthor = isAppAdmin || isPlatformOwner;
  const [picking, setPicking] = useState<CampaignRow | null>(null);
  const [intro, setIntro] = useState<CampaignRow | null>(null);
  const [starting, setStarting] = useState(false);


  const playable = useMemo(
    () => campaigns.filter((c) => c.status === 'published' || c.status === 'testing'),
    [campaigns],
  );
  const campaignById = useMemo(
    () => new Map(campaigns.map((c) => [c.id, c])), [campaigns],
  );
  const activeRuns = runs.filter((r) => r.status === 'active');

  const begin = async (campaign: CampaignRow, hero: HeroRow) => {
    setStarting(true);
    const run = await startRun(campaign.id, hero.id);
    setStarting(false);
    if (run) navigate(`/journey/play/${run.id}`);
  };

  // Campaigns written around an authored protagonist skip hero creation
  // entirely: the player steps straight into that character.
  const launch = async (campaign: CampaignRow) => {
    const fixed = protagonistFor(campaign.slug);
    if (!fixed) { setPicking(campaign); return; }
    setStarting(true);
    const existing = heroes.find((h) => h.name.toLowerCase() === fixed.name.toLowerCase());
    const hero = existing ?? await createHero({
      name: fixed.name, pronouns: fixed.pronouns, origin: fixed.origin,
    });
    if (!hero) { setStarting(false); return; }
    const run = await startRun(campaign.id, hero.id);
    setStarting(false);
    if (run) navigate(`/journey/play/${run.id}`);
  };

  return (
    <JourneyLayout>
      {loading ? (
        <JourneySkeleton lines={7} />
      ) : error ? (
        <JourneyError message={error} onRetry={refresh} />
      ) : (
        <div className="space-y-8">
          <header className="pt-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="jy-eyebrow">Mesoplasia awaits</div>
                <h1 className="jy-display mt-1 text-3xl">The Splendid Journey</h1>
                <p className="jy-secondary mt-1 text-sm italic">of Unimaginable Consequence</p>
              </div>
              {canAuthor && (
                <button
                  className="jy-btn jy-btn-ghost jy-btn-sm shrink-0"
                  onClick={() => navigate('/journey/studio')}
                  title="Author, import & publish campaigns"
                >
                  <PenTool className="h-4 w-4" aria-hidden /> Studio
                </button>
              )}
            </div>
            <div className="jy-rule mt-4" />
          </header>

          {currentRun && (
            <section className="jy-panel-raised overflow-hidden p-5">
              {campaignById.get(currentRun.campaign_id)?.cover_image && (
                <div className="jy-cover -mx-5 -mt-5 mb-4">
                  <img
                    src={campaignById.get(currentRun.campaign_id)!.cover_image}
                    alt=""
                    className="h-40 w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              )}
              <div className="jy-eyebrow">Your journey continues</div>
              <h2 className="jy-display mt-1 text-xl">
                {campaignById.get(currentRun.campaign_id)?.title ?? 'A journey in progress'}
              </h2>
              <p className="jy-muted mt-1 text-sm">
                {currentRun.current_chapter_key ? `Chapter: ${currentRun.current_chapter_key}` : 'The road lies open'}
              </p>
              <button
                className="jy-btn jy-btn-primary mt-4"
                onClick={() => navigate(`/journey/play/${currentRun.id}`)}
              >
                <Play className="h-4 w-4" aria-hidden /> Continue
              </button>
            </section>
          )}

          <section>
            <h2 className="jy-title mb-3 text-lg">Campaigns</h2>
            {playable.length === 0 ? (
              <div className="jy-panel p-6 text-center">
                <Feather className="mx-auto mb-2 h-5 w-5" style={{ color: 'hsl(var(--jy-gold))' }} aria-hidden />
                <p className="jy-secondary text-sm">
                  No campaigns have been published yet. Authors can import a campaign package from the Studio.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {playable.map((c) => {
                  const run = activeRuns.find((r) => r.campaign_id === c.id);
                  return (
                    <article key={c.id} className="jy-panel overflow-hidden p-4">
                      {c.cover_image && (
                        <div className="jy-cover -mx-4 -mt-4 mb-4">
                          <img src={c.cover_image} alt="" className="h-36 w-full object-cover" loading="lazy" decoding="async" />
                        </div>
                      )}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="jy-display text-lg">{c.title}</h3>
                          {c.subtitle && <p className="jy-secondary text-sm italic">{c.subtitle}</p>}
                        </div>
                        {c.status === 'testing' && <span className="jy-chip shrink-0">Testing</span>}
                      </div>
                      {c.description && <p className="jy-prose mt-2 text-sm">{c.description}</p>}
                      {protagonistFor(c.slug) && (
                        <p className="jy-secondary mt-2 text-sm italic">{protagonistFor(c.slug)!.blurb}</p>
                      )}
                      <div className="jy-muted mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {c.author && <span>By {c.author}</span>}
                        {c.estimated_length && <span>{c.estimated_length}</span>}
                        <span>Version {c.version}</span>
                      </div>
                      {c.content_notes && (
                        <p className="jy-muted mt-2 text-xs italic">Content notes: {c.content_notes}</p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {run ? (
                          <button className="jy-btn jy-btn-primary" onClick={() => navigate(`/journey/play/${run.id}`)}>
                            <Play className="h-4 w-4" aria-hidden /> Resume
                          </button>
                        ) : (
                          <button className="jy-btn jy-btn-primary" disabled={starting} onClick={() => { void launch(c); }}>
                            <Play className="h-4 w-4" aria-hidden /> {starting ? 'Beginning…' : 'Begin'}
                          </button>
                        )}
                        {prologueFor(c.slug) && (
                          <button className="jy-btn jy-btn-ghost" onClick={() => setIntro(c)}>
                            <BookOpen className="h-4 w-4" aria-hidden /> Story introduction
                          </button>
                        )}
                        {run && (
                          <button className="jy-btn jy-btn-ghost" disabled={starting} onClick={() => { void launch(c); }}>
                            <RotateCcw className="h-4 w-4" aria-hidden /> New run
                          </button>
                        )}
                      </div>

                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {picking && (
        <HeroPicker
          campaign={picking}
          heroes={heroes}
          busy={starting}
          onCancel={() => setPicking(null)}
          onCreate={createHero}
          onPick={(hero) => begin(picking, hero)}
        />
      )}

      {intro && prologueFor(intro.slug) && (
        <StoryIntroduction
          prologue={prologueFor(intro.slug)!}
          onClose={() => setIntro(null)}
          onLaunch={() => {
            const c = intro;
            setIntro(null);
            const run = activeRuns.find((r) => r.campaign_id === c.id);
            if (run) navigate(`/journey/play/${run.id}`);
            else void launch(c);
          }}
        />
      )}

    </JourneyLayout>
  );
}

function HeroPicker({
  campaign, heroes, busy, onCancel, onCreate, onPick,
}: {
  campaign: CampaignRow;
  heroes: HeroRow[];
  busy: boolean;
  onCancel: () => void;
  onCreate: (input: { name: string; pronouns?: string; origin?: string }) => Promise<HeroRow | null>;
  onPick: (hero: HeroRow) => void;
}) {
  const [name, setName] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [creating, setCreating] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const hero = await onCreate({ name: name.trim(), pronouns: pronouns.trim() || undefined });
    setCreating(false);
    if (hero) onPick(hero);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'hsl(28 14% 4% / 0.8)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Choose your hero"
    >
      <div className="jy-panel-raised max-h-[85dvh] w-full max-w-md overflow-auto p-5 sm:rounded-sm">
        <h2 className="jy-display text-xl">Who walks this road?</h2>
        <p className="jy-muted mt-1 text-sm">Choose a hero to begin {campaign.title}.</p>

        {heroes.length > 0 && (
          <div className="mt-4 space-y-2">
            {heroes.map((h) => (
              <button key={h.id} className="jy-choice" disabled={busy} onClick={() => onPick(h)}>
                <span className="block">{h.name}</span>
                <span className="jy-muted block text-xs">
                  Level {h.level}{h.origin ? ` · ${h.origin}` : ''}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="jy-rule my-5" />
        <div className="space-y-2">
          <label className="jy-eyebrow block" htmlFor="jy-hero-name">Forge a new hero</label>
          <input
            id="jy-hero-name"
            className="jy-input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          <input
            className="jy-input"
            placeholder="Pronouns (optional)"
            value={pronouns}
            onChange={(e) => setPronouns(e.target.value)}
            maxLength={30}
          />
        </div>

        <div className="mt-5 flex gap-2">
          <button className="jy-btn jy-btn-primary" disabled={!name.trim() || creating || busy} onClick={submit}>
            <Plus className="h-4 w-4" aria-hidden /> {creating || busy ? 'Beginning…' : 'Begin'}
          </button>
          <button className="jy-btn jy-btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
