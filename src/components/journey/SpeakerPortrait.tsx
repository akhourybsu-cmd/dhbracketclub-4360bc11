import { speakerHue, speakerInitials } from '@/lib/journey/atmosphere';
import { parsePortrait } from '@/lib/journey/art';

/**
 * Portrait medallion for a speaking character. Uses authored artwork when the
 * dialogue block supplies `portrait`, and otherwise falls back to an engraved
 * initial medallion tinted by a deterministic per-character hue — so every
 * campaign has readable multi-voice dialogue with no art pipeline required.
 */
export function SpeakerPortrait({
  name, portrait, size = 44, speaking = false,
}: { name: string; portrait?: string | null; size?: number; speaking?: boolean }) {
  const hue = speakerHue(name || 'unknown');
  const { src, position, zoom } = parsePortrait(portrait);
  return (
    <div
      className="jy-portrait shrink-0"
      data-speaking={speaking ? 'true' : undefined}
      style={{
        width: size,
        height: size,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--jy-portrait-hue' as any]: `${hue}`,
      }}
      aria-hidden
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          style={{
            objectPosition: position,
            transform: zoom > 1 ? `scale(${zoom})` : undefined,
            transformOrigin: position,
          }}
        />
      ) : (
        <span className="jy-portrait-initials">{speakerInitials(name || '?')}</span>
      )}
    </div>
  );
}
