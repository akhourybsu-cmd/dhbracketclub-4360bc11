import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Heart, Coins, Check } from 'lucide-react';
import { JourneyLayout, JourneyError, JourneySkeleton } from '@/components/journey/JourneyLayout';
import { SceneBlocks } from '@/components/journey/SceneBlocks';
import { ChoiceList } from '@/components/journey/ChoiceList';
import { SceneAtmosphere } from '@/components/journey/SceneAtmosphere';
import { ChapterInterstitial } from '@/components/journey/ChapterInterstitial';
import { useJourneySettings } from '@/components/journey/useJourneySettings';
import { isImageUrl } from '@/lib/journey/art';
import { useJourneyRun } from '@/hooks/useJourneyRun';
import { useJourneyEnding } from '@/hooks/useJourneyEnding';
import { EndingScreen } from '@/components/journey/EndingScreen';
import type { RuntimeBlock } from '@/lib/journey/types';

/** Snapshot of the scene the reader just left, kept on screen as they read on. */
interface PrevBeat { blocks: RuntimeBlock[]; choiceText: string; choiceClass: string }

/**
 * The reading surface. A scene narrates, then offers choices. Choosing does NOT
 * turn the page: the chosen line stays put, the consequence streams in beneath
 * it, and only a Continue button carries the reader onward to the next set of
 * choices — so a decision reads as part of the same unfolding conversation.
 */
export default function JourneyPlayPage() {
  const { runId } = useParams<{ runId: string }>();
  const {
    run, campaign, scene, chapterTitle, locationName, blocks, choices, state,
    loading, busy, error, notices, clearNotices, refresh, chooseChoice, advance,
  } = useJourneyRun(runId);
  const topRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const { reducedMotion } = useJourneySettings();
  const ended = run?.status === 'completed' || Boolean(scene?.is_terminal);
  const { ending, loading: endingLoading } = useJourneyEnding(ended ? runId : undefined, ended);

  // Choices appear once the scene has finished narrating its final panel.
  const [told, setTold] = useState(false);
  // The beat the reader just left, shown above the consequence as context.
  const [prev, setPrev] = useState<PrevBeat | null>(null);
  const prevRef = useRef<PrevBeat | null>(null);
  useEffect(() => { setTold(false); }, [scene?.scene_key, blocks]);

  // Announce a new chapter with a brief cinematic curtain — once per chapter,
  // never on reduced motion, never before the ending.
  const [chapterCurtain, setChapterCurtain] = useState<string | null>(null);
  const seenChapterRef = useRef<string | null>(null);
  useEffect(() => {
    if (reducedMotion || ended || !chapterTitle) return;
    if (seenChapterRef.current === chapterTitle) return;
    const first = seenChapterRef.current === null;
    seenChapterRef.current = chapterTitle;
    if (!first) setChapterCurtain(chapterTitle);
  }, [chapterTitle, reducedMotion, ended]);

  // Fresh scene → top of the page. A consequence → land on the seam between the
  // choice and what it caused, so the reader sees the connection.
  useEffect(() => {
    if (prevRef.current) dividerRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    else { topRef.current?.scrollIntoView({ block: 'start' }); window.scrollTo({ top: 0 }); }
  }, [scene?.scene_key]);

  useEffect(() => {
    if (notices.length === 0) return;
    const t = setTimeout(clearNotices, 4000);
    return () => clearTimeout(t);
  }, [notices, clearNotices]);

  const styleFor = (major?: boolean, style?: string | null) =>
    major ? 'jy-choice-major'
      : style === 'skill' ? 'jy-choice-skill'
      : style === 'secret' ? 'jy-choice-secret' : '';

  const onChoose = useCallback(async (key: string) => {
    const chosen = choices.find((c) => c.choice_key === key);
    const snap: PrevBeat = {
      blocks,
      choiceText: chosen?.choice_text ?? '',
      choiceClass: styleFor(chosen?.major_decision, chosen?.choice_style),
    };
    prevRef.current = snap;
    setPrev(snap);
    const ok = await chooseChoice(key);
    if (!ok) { prevRef.current = null; setPrev(null); }
  }, [choices, blocks, chooseChoice]);

  const advanceGated = useCallback(async () => {
    const snap: PrevBeat = { blocks, choiceText: '', choiceClass: '' };
    prevRef.current = snap;
    setPrev(snap);
    const ok = await advance();
    if (!ok) { prevRef.current = null; setPrev(null); }
  }, [blocks, advance]);

  if (loading) {
    return <JourneyLayout><div className="pt-6"><JourneySkeleton lines={8} /></div></JourneyLayout>;
  }
  if (error || !run) {
    return <JourneyLayout><div className="pt-6"><JourneyError message={error ?? 'This journey could not be loaded.'} onRetry={refresh} /></div></JourneyLayout>;
  }

  const hasArt = isImageUrl(scene?.background_asset);

  return (
    <JourneyLayout>
      <div ref={topRef} />
      <SceneAtmosphere
        sceneKey={scene?.scene_key}
        sceneType={scene?.scene_type}
        backgroundAsset={hasArt ? undefined : scene?.background_asset}
      />
      {chapterCurtain && (
        <ChapterInterstitial title={chapterCurtain} onDone={() => setChapterCurtain(null)} />
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="jy-chip"><Heart className="h-3 w-3" aria-hidden /> {state.health}/{state.max_health}</span>
        <span className="jy-chip">Level {state.level}</span>
        <span className="jy-chip"><Coins className="h-3 w-3" aria-hidden /> {state.gold}</span>
        {run.is_test_run && <span className="jy-chip jy-chip-blood">Test run</span>}
      </div>

      {/* The beat just left: its prose stays, with the chosen line beneath it. */}
      {prev && (
        <section aria-hidden className="mb-6" style={{ opacity: 0.7 }}>
          <SceneBlocks blocks={prev.blocks} instant />
          {prev.choiceText && (
            <div className={`jy-choice-chosen mt-5 ${prev.choiceClass}`}>
              <Check className="h-4 w-4" aria-hidden />
              <span>{prev.choiceText}</span>
            </div>
          )}
        </section>
      )}
      {prev && <div ref={dividerRef} className="jy-rule mb-6" />}

      {hasArt && (
        <figure className="jy-scene-banner jy-fade-in" key={scene?.scene_key}>
          <img src={scene!.background_asset!} alt="" loading="lazy" decoding="async" />
        </figure>
      )}

      {/* The scene's own title is shown only when it opens fresh; a consequence
          being read reads as a continuation, not a new page. */}
      {!prev && (
        <header className="jy-focal mb-6">
          <div className="jy-eyebrow">
            {[campaign?.title, chapterTitle, locationName].filter(Boolean).join(' · ')}
          </div>
          {scene?.title && <h1 className="jy-title mt-1">{scene.title}</h1>}
          {scene?.subtitle && <p className="jy-secondary text-sm italic">{scene.subtitle}</p>}
        </header>
      )}

      {scene ? (
        <>
          <SceneBlocks blocks={blocks} onDone={() => setTold(true)} />

          {ended ? (
            told && <EndingScreen payload={ending} loading={endingLoading} campaignTitle={campaign?.title} />
          ) : choices.length > 0 ? (
            told && <div className="jy-fade-in"><ChoiceList choices={choices} busy={busy} onChoose={onChoose} /></div>
          ) : scene?.has_auto_next ? (
            told && <ContinueButton busy={busy} label={busy ? 'The tale moves…' : 'Continue'} onClick={() => { void advanceGated(); }} />
          ) : (
            told && (
              <div className="jy-panel mt-8 p-4 text-center">
                <p className="jy-secondary text-sm">
                  No path leads onward from here yet. This is an authoring gap, not your doing.
                </p>
                <Link className="jy-btn jy-btn-ghost mt-3" to="/journey">Return to the campaign hall</Link>
              </div>
            )
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

function ContinueButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <div className="jy-fade-in mt-8 text-center">
      <button type="button" className="jy-btn jy-btn-primary" disabled={busy} onClick={onClick}>
        {label}
      </button>
    </div>
  );
}
