import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  isPrivateAttachmentUrl,
  resolveAttachmentUrl,
  invalidateAttachmentUrl,
} from '@/lib/chatAttachments';

interface ChatAttachmentImageProps {
  url: string;
  className?: string;
  alt?: string;
  /** When provided, tapping opens the in-app lightbox instead of a new tab. */
  onOpen?: () => void;
}

/**
 * Renders a chat image attachment.
 * - Legacy public URL → renders directly.
 * - Private sentinel URL → resolves to signed URL with skeleton + retry on failure.
 */
export function ChatAttachmentImage({ url, className, alt = 'Shared image', onOpen }: ChatAttachmentImageProps) {
  const isPrivate = isPrivateAttachmentUrl(url);
  const [resolved, setResolved] = useState<string | null>(isPrivate ? null : url);
  const [errored, setErrored] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isPrivate) { setResolved(url); return; }
    let cancelled = false;
    setErrored(false);
    setResolved(null);
    resolveAttachmentUrl(url).then(signed => {
      if (cancelled) return;
      if (signed) setResolved(signed);
      else setErrored(true);
    });
    return () => { cancelled = true; };
  }, [url, isPrivate, attempt]);

  const handleError = () => {
    if (isPrivate) {
      invalidateAttachmentUrl(url);
      setErrored(true);
    } else {
      setErrored(true);
    }
  };

  const wrapperClass = cn(
    'block rounded-lg overflow-hidden border border-border/10 bg-muted/20',
    className,
  );

  if (errored) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setAttempt(a => a + 1); }}
        className={cn(wrapperClass, 'flex items-center justify-center text-[11px] text-muted-foreground/70 px-3 py-6 max-w-[240px]')}
      >
        Image unavailable — tap to retry
      </button>
    );
  }

  if (!resolved) {
    return (
      <div
        className={cn(wrapperClass, 'animate-pulse')}
        style={{ width: 200, height: 140 }}
        aria-label="Loading image"
      />
    );
  }

  const imgEl = (
    <img
      src={resolved}
      alt={alt}
      className={cn('rounded-lg max-w-[240px] max-h-[200px] object-cover border border-border/10', className)}
      loading="lazy"
      decoding="async"
      onError={handleError}
    />
  );

  // With an onOpen handler, tapping launches the in-app lightbox. Otherwise
  // fall back to opening the resolved URL in a new tab (legacy behavior).
  if (onOpen) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen(); }}
        className="block cursor-zoom-in"
        aria-label="Open image"
      >
        {imgEl}
      </button>
    );
  }

  return (
    <a href={resolved} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
      {imgEl}
    </a>
  );
}
