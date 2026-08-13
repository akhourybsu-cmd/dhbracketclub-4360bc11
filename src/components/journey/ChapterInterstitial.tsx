import { useEffect } from 'react';

/**
 * A brief cinematic curtain that washes over the screen when the story turns
 * to a new chapter — the eyebrow and title rise through a darkened veil, a gilt
 * rule draws beneath them, and it lifts on its own. Purely atmospheric: it sits
 * above the scene (which is already rendering behind it) and dismisses itself.
 * Callers should not mount it at all when the reader has motion reduced.
 */
export function ChapterInterstitial({ title, onDone }: { title: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2400);
    return () => window.clearTimeout(t);
  }, [title, onDone]);

  return (
    <div className="jy-chapter-veil" aria-hidden onClick={onDone}>
      <div className="jy-chapter-inner">
        <div className="jy-eyebrow jy-chapter-eyebrow">A new chapter</div>
        <h2 className="jy-display jy-chapter-title">{title}</h2>
        <div className="jy-chapter-rule" />
      </div>
    </div>
  );
}
