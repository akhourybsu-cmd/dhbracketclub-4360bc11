import { useEffect, useMemo, useRef, useState } from 'react';
import { splitLines } from '@/lib/journey/atmosphere';
import { SpeakerPortrait } from './SpeakerPortrait';
import { useJourneySettings } from './useJourneySettings';

/**
 * Dialogue delivered line by line, the way a scene is spoken rather than read
 * off a page. Tapping anywhere in the block reveals the rest immediately, so
 * pacing never becomes a wait. Honours the player's motion / animation
 * settings: with animation off, everything appears at once.
 */
export function DialogueBlock({
  speaker, emotion, portrait, text,
}: {
  speaker: string;
  emotion?: string | null;
  portrait?: string | null;
  text: string;
}) {
  const { dialogueAnimation, reducedMotion } = useJourneySettings();
  const animate = dialogueAnimation && !reducedMotion;
  const lines = useMemo(() => splitLines(text), [text]);
  const [shown, setShown] = useState(animate ? 1 : lines.length);
  const timer = useRef<number>();

  useEffect(() => {
    setShown(animate ? 1 : lines.length);
  }, [text, animate, lines.length]);

  useEffect(() => {
    if (!animate || shown >= lines.length) return;
    timer.current = window.setTimeout(() => setShown((n) => n + 1), 520);
    return () => window.clearTimeout(timer.current);
  }, [animate, shown, lines.length]);

  const complete = shown >= lines.length;

  return (
    <div
      className="jy-dialogue jy-fade-in flex gap-3"
      onClick={() => { if (!complete) setShown(lines.length); }}
      role={complete ? undefined : 'button'}
      tabIndex={complete ? undefined : 0}
      onKeyDown={(e) => {
        if (!complete && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setShown(lines.length); }
      }}
    >
      <SpeakerPortrait name={speaker} portrait={portrait} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="jy-speaker">{speaker}</span>
          {emotion && emotion !== 'neutral' && (
            <span className="jy-muted text-[0.7rem] italic">{emotion}</span>
          )}
        </div>
        <div className="jy-prose mt-1 italic">
          {lines.slice(0, shown).map((line, i) => (
            <p key={i} className={animate ? 'jy-line-in' : undefined}>{line}</p>
          ))}
        </div>
        {!complete && (
          <div className="jy-muted mt-1 text-[0.7rem] tracking-wide">tap to continue</div>
        )}
      </div>
    </div>
  );
}
