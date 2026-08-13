import { useEffect, useRef, useState } from 'react';
import { useJourneySettings } from './useJourneySettings';

/**
 * Narrated text: characters appear over time, the way a storyteller speaks a
 * line rather than handing you a page. Honours the player's motion settings —
 * with animation off (or reduced motion) the full text is shown at once.
 *
 * `skip` immediately completes the text; `onDone` fires once the text is fully
 * visible so the caller can reveal the next beat.
 */
export function Typewriter({
  text, active = true, skip = false, speed = 18, className, onDone,
}: {
  text: string;
  active?: boolean;
  skip?: boolean;
  /** Milliseconds per character. */
  speed?: number;
  className?: string;
  onDone?: () => void;
}) {
  const { dialogueAnimation, reducedMotion } = useJourneySettings();
  const animate = active && !skip && dialogueAnimation && !reducedMotion;
  const [count, setCount] = useState(animate ? 0 : text.length);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    setCount(animate ? 0 : text.length);
  }, [text, animate]);

  useEffect(() => {
    if (count >= text.length) { doneRef.current?.(); return; }
    if (!animate) return;
    // Type in small chunks so long passages stay readable and cheap.
    const id = window.setTimeout(() => setCount((c) => Math.min(text.length, c + 2)), speed);
    return () => window.clearTimeout(id);
  }, [count, text, animate, speed]);

  const shown = text.slice(0, count);
  const typing = count < text.length;

  return (
    <span className={className}>
      {shown}
      {typing && <span className="jy-caret" aria-hidden>▍</span>}
    </span>
  );
}

/** Non-text blocks: appear, then hand off to the next beat. */
export function Instant({
  children, skip = false, onDone,
}: { children: React.ReactNode; skip?: boolean; onDone?: () => void }) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => {
    const id = window.setTimeout(() => doneRef.current?.(), skip ? 0 : 220);
    return () => window.clearTimeout(id);
  }, [skip]);
  return <>{children}</>;
}
