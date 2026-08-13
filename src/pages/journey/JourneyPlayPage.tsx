import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, Coins } from 'lucide-react';
import { JourneyLayout, JourneyError, JourneySkeleton } from '@/components/journey/JourneyLayout';
import { SceneBlocks } from '@/components/journey/SceneBlocks';
import { ChoiceList } from '@/components/journey/ChoiceList';
import { SceneAtmosphere } from '@/components/journey/SceneAtmosphere';
import { useJourneyRun } from '@/hooks/useJourneyRun';
import { useJourneyEnding } from '@/hooks/useJourneyEnding';
import { EndingScreen } from '@/components/journey/EndingScreen';

/** The reading surface: scene prose, then choices. Everything else is elsewhere. */
export default function JourneyPlayPage() {
  const { runId } = useParams<{ runId: string }>();
  const {
    run, campaign, scene, chapterTitle, locationName, blocks, choices, state,
    loading, busy, error, notices, clearNotices, refresh, chooseChoice, advance,
  } = useJourneyRun(runId);
  const topRef = useRef<HTMLDivElement>(null);
  const ended = run?.status === 'completed' || Boolean(scene?.is_terminal);
  const { ending, loading: endingLoading } = useJourneyEnding(ended ? runId : undefined, ended);
  // Choices only appear once the scene has finished being narrated.
  const [told, setTold] = useState(false);
  useEffect(() => { setTold(false); }, [scene?.scene_key, blocks]);

  // Each new scene starts at the top — mid-scene scroll position carrying
  // over made long chapters feel broken on mobile.
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start' });
    window.scrollTo({ top: 0 });
  }, [scene?.scene_key]);

  useEffect(() => {
    if (notices.length === 0) return;
    const t = setTimeout(clearNotices, 4000);
    return () => clearTimeout(t);
  }, [notices, clearNotices]);

  if (loading) {
    return <JourneyLayout><div className="pt-6"><JourneySkeleton lines={8} /></div></JourneyLayout>;
  }
  if (error || !run) {
    return <JourneyLayout><div className="pt-6"><JourneyError message={error ?? 'This journey could not be loaded.'} onRetry={refresh} /></div></JourneyLayout>;
  }

  return (
    <JourneyLayout>
      <div ref={topRef} />
      <SceneAtmosphere
        sceneKey={scene?.scene_key}
        sceneType={scene?.scene_type}
        backgroundAsset={scene?.background_asset}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="jy-chip">
          <Heart className="h-3 w-3" aria-hidden /> {state.health}/{state.max_health}
        </span>
        <span className="jy-chip">Level {state.level}</span>
        <span className="jy-chip">
          <Coins className="h-3 w-3" aria-hidden /> {state.gold}
        </span>
        {run.is_test_run && <span className="jy-chip jy-chip-blood">Test run</span>}
      </div>

      <header className="jy-focal mb-6">
        <div className="jy-eyebrow">
          {[campaign?.title, chapterTitle, locationName].filter(Boolean).join(' · ')}
        </div>
        {scene?.title && <h1 className="jy-title mt-1">{scene.title}</h1>}
        {scene?.subtitle && <p className="jy-secondary text-sm italic">{scene.subtitle}</p>}
      </header>

      {scene ? (
        <>
          <SceneBlocks blocks={blocks} onDone={() => setTold(true)} />

          {ended ? (
            told && <EndingScreen payload={ending} loading={endingLoading} campaignTitle={campaign?.title} />
          ) : (
            told && <div className="jy-fade-in"><ChoiceList choices={choices} busy={busy} onChoose={chooseChoice} /></div>
          )}

          {told && !ended && choices.length === 0 && scene?.has_auto_next && (
            <div className="mt-8 text-center">
              <button
                type="button"
                className="jy-btn jy-btn-primary"
                disabled={busy}
                onClick={() => { void advance(); }}
              >
                {busy ? 'The tale moves…' : 'Continue'}
              </button>
            </div>
          )}

          {told && !ended && choices.length === 0 && !scene?.has_auto_next && (
            <div className="jy-panel mt-8 p-4 text-center">
              <p className="jy-secondary text-sm">
                No path leads onward from here yet. This is an authoring gap, not your doing.
              </p>
              <Link className="jy-btn jy-btn-ghost mt-3" to="/journey">Return to the campaign hall</Link>
            </div>
          )}
        </>
      ) : (
        <JourneyError message="The next scene is missing from this campaign." onRetry={refresh} />
      )}

      {notices.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-40 mx-auto max-w-sm px-4" role="status" aria-live="polite">
          <div className="jy-panel-raised space-y-1 p-3 text-center text-sm" style={{ color: 'hsl(var(--jy-gold))' }}>
            {notices.map((n, i) => <div key={i}>{n}</div>)}
          </div>
        </div>
      )}
    </JourneyLayout>
  );
}
