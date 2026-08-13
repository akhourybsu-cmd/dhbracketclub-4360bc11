import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gauge, Music, Type, Volume2, Wind, X } from 'lucide-react';
import { Typewriter } from './Typewriter';
import {
  TEXT_SPEEDS, useJourneySettings,
  type JourneyTextSize, type JourneyTextSpeed,
} from './useJourneySettings';

const SPEED_ORDER: JourneyTextSpeed[] = ['slow', 'normal', 'fast', 'instant'];
const SIZE_ORDER: Array<{ key: JourneyTextSize; label: string }> = [
  { key: 'sm', label: 'S' }, { key: 'md', label: 'M' },
  { key: 'lg', label: 'L' }, { key: 'xl', label: 'XL' },
];

const SAMPLE =
  'The stair went down further than the lantern could follow, and something below it was breathing in the dark.';

/**
 * Reader comfort controls for The Splendid Journey — text speed, text size,
 * and motion. The speed row carries a live preview that re-types the sample
 * whenever the speed changes, so the reader can feel the pace before committing
 * to it. Portaled to <body> (and re-scoped with `jy-mode`) so the sheet escapes
 * any transformed ancestor and still reads in the fantasy design system.
 */
export function JourneyReadingSettings({ onClose }: { onClose: () => void }) {
  const { textSize, textSpeed, reducedMotion, music, soundEffects, update } = useJourneySettings();
  // Bump a key so the preview restarts its animation on every speed change.
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setSpeed = (s: JourneyTextSpeed) => { update('textSpeed', s); setPreviewKey((k) => k + 1); };

  return createPortal(
    <div
      className="jy-mode fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      style={{ background: 'hsl(28 14% 4% / 0.82)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Reading settings"
      onClick={onClose}
    >
      <div
        className="jy-panel-raised jy-fade-in max-h-[88dvh] w-full max-w-md overflow-auto p-5 sm:rounded-sm"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="jy-eyebrow">The reading room</div>
            <h2 className="jy-display mt-0.5 text-xl">Reading settings</h2>
          </div>
          <button className="jy-btn jy-btn-ghost jy-btn-sm shrink-0" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Text speed + live preview */}
        <section className="mt-5">
          <h3 className="jy-eyebrow flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5" aria-hidden /> Text speed
          </h3>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {SPEED_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                className={`jy-seg ${textSpeed === s ? 'jy-seg-on' : ''}`}
                aria-pressed={textSpeed === s}
                onClick={() => setSpeed(s)}
              >
                {TEXT_SPEEDS[s].label}
              </button>
            ))}
          </div>
          <div className="jy-panel mt-3 min-h-[4.5rem] p-3">
            <p className="jy-prose text-sm italic" aria-live="off">
              <Typewriter key={`${textSpeed}-${previewKey}`} text={SAMPLE} active />
            </p>
          </div>
          <p className="jy-muted mt-1.5 text-xs">
            Tapping the story while text is being spoken always reveals the rest at once.
          </p>
        </section>

        {/* Text size */}
        <section className="mt-5">
          <h3 className="jy-eyebrow flex items-center gap-1.5">
            <Type className="h-3.5 w-3.5" aria-hidden /> Text size
          </h3>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {SIZE_ORDER.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`jy-seg ${textSize === key ? 'jy-seg-on' : ''}`}
                aria-pressed={textSize === key}
                onClick={() => update('textSize', key)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Motion */}
        <section className="mt-5">
          <h3 className="jy-eyebrow flex items-center gap-1.5">
            <Wind className="h-3.5 w-3.5" aria-hidden /> Motion
          </h3>
          <button
            type="button"
            className={`jy-choice mt-2 flex items-center justify-between ${reducedMotion ? '' : 'jy-choice-skill'}`}
            aria-pressed={!reducedMotion}
            onClick={() => update('reducedMotion', !reducedMotion)}
          >
            <span className="min-w-0">
              <span className="block">Living atmosphere</span>
              <span className="jy-muted block text-xs italic">
                Breathing light, drifting embers, and scene flourishes
              </span>
            </span>
            <span className={`jy-toggle ${reducedMotion ? '' : 'jy-toggle-on'}`} aria-hidden />
          </button>
        </section>

        {/* Sound */}
        <section className="mt-5">
          <h3 className="jy-eyebrow flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5" aria-hidden /> Sound
          </h3>
          <button
            type="button"
            className={`jy-choice mt-2 flex items-center justify-between ${music ? 'jy-choice-skill' : ''}`}
            aria-pressed={music}
            onClick={() => update('music', !music)}
          >
            <span className="min-w-0">
              <span className="flex items-center gap-1.5"><Music className="h-3.5 w-3.5" aria-hidden /> Ambient music</span>
              <span className="jy-muted block text-xs italic">A mellow fantasy score beneath the story</span>
            </span>
            <span className={`jy-toggle ${music ? 'jy-toggle-on' : ''}`} aria-hidden />
          </button>
          <button
            type="button"
            className={`jy-choice mt-2 flex items-center justify-between ${soundEffects ? 'jy-choice-skill' : ''}`}
            aria-pressed={soundEffects}
            onClick={() => update('soundEffects', !soundEffects)}
          >
            <span className="min-w-0">
              <span className="block">Selection sounds</span>
              <span className="jy-muted block text-xs italic">A soft flourish when you choose</span>
            </span>
            <span className={`jy-toggle ${soundEffects ? 'jy-toggle-on' : ''}`} aria-hidden />
          </button>
        </section>
      </div>
    </div>,
    document.body,
  );
}
