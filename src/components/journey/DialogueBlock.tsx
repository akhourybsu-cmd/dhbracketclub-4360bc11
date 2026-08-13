import { useEffect, useMemo, useState } from 'react';
import { splitLines } from '@/lib/journey/atmosphere';
import { SpeakerPortrait } from './SpeakerPortrait';
import { Typewriter } from './Typewriter';

/**
 * Dialogue delivered line by line, typed out the way a scene is spoken rather
 * than read off a page. `skip` completes the whole speech at once; `onDone`
 * fires when the last line has finished so the scene can move on.
 */
export function DialogueBlock({
  speaker, emotion, portrait, text, active = true, skip = false, onDone,
}: {
  speaker: string;
  emotion?: string | null;
  portrait?: string | null;
  text: string;
  active?: boolean;
  skip?: boolean;
  onDone?: () => void;
}) {
  const lines = useMemo(() => splitLines(text), [text]);
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => { setIndex(0); setDone(false); }, [text]);

  const shown = skip ? lines.length - 1 : index;
  // The character is "speaking" — their portrait breathes — from the moment
  // their turn is active until the last line has finished being spoken.
  const speaking = active && !skip && !done;

  return (
    <div className="jy-dialogue jy-fade-in flex gap-3">
      <SpeakerPortrait name={speaker} portrait={portrait} speaking={speaking} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="jy-speaker">{speaker}</span>
          {emotion && emotion !== 'neutral' && (
            <span className="jy-muted text-[0.7rem] italic">{emotion}</span>
          )}
        </div>
        <div className="jy-prose mt-1 italic">
          {lines.slice(0, shown + 1).map((line, i) => (
            <p key={i}>
              <Typewriter
                text={line}
                active={active && i === shown}
                skip={skip || i < shown}
                onDone={() => {
                  if (i < lines.length - 1) setIndex((n) => Math.max(n, i + 1));
                  else { setDone(true); onDone?.(); }
                }}
              />
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
