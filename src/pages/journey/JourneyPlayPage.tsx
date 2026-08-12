import { useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, Coins, Sparkles } from 'lucide-react';
import { JourneyLayout, JourneyError, JourneySkeleton } from '@/components/journey/JourneyLayout';
import { SceneBlocks } from '@/components/journey/SceneBlocks';
import { ChoiceList } from '@/components/journey/ChoiceList';
import { useJourneyRun } from '@/hooks/useJourneyRun';

/** The reading surface: scene prose, then choices. Everything else is elsewhere. */
export default function JourneyPlayPage() {
  const { runId } = useParams<{ runId: string }>();
  const {
    run, campaign, scene, chapterTitle, locationName, blocks, choices, state,
    loading, busy, error, notices, clearNotices, refresh, chooseChoice, advance,
  } = useJourneyRun(runId);
  const topRef = useRef<HTMLDivElement>(null);

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

  const ended = run.status === 'completed' || scene?.is_terminal;

  return (
    <JourneyLayout>
      <div ref={topRef} />

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

      <header className="mb-6">
        <div className="jy-eyebrow">
          {[campaign?.title, chapterTitle, locationName].filter(Boolean).join(' · ')}
        </div>
        {scene?.title && <h1 className="jy-title mt-1">{scene.title}</h1>}
        {scene?.subtitle && <p className="jy-secondary text-sm italic">{scene.subtitle}</p>}
      </header>

      {scene ? (
        <>
          <SceneBlocks blocks={blocks} />

          {ended ? (
            <div className="jy-panel-raised mt-8 p-5 text-center">
              <Sparkles className="mx-auto mb-2 h-5 w-5" style={{ color: 'hsl(var(--jy-gold))' }} aria-hidden />
              <h2 className="jy-display text-xl">Here the tale rests</h2>
              <p className="jy-secondary mt-1 text-sm">
                {run.ending_key ? `Ending reached: ${run.ending_key}` : 'This chapter of your journey is complete.'}
              </p>
              <Link className="jy-btn jy-btn-primary mt-4" to="/journey">Return to the campaign hall</Link>
            </div>
          ) : (
            <ChoiceList choices={choices} busy={busy} onChoose={chooseChoice} />
          )}

          {!ended && choices.length === 0 && scene?.has_auto_next && (
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

          {!ended && choices.length === 0 && !scene?.has_auto_next && (
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
