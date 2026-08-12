import { speakerHue, speakerInitials } from '@/lib/journey/atmosphere';

/**
 * Portrait medallion for a speaking character. Uses authored artwork when the
 * dialogue block supplies `portrait`, and otherwise falls back to an engraved
 * initial medallion tinted by a deterministic per-character hue — so every
 * campaign has readable multi-voice dialogue with no art pipeline required.
 */
export function SpeakerPortrait({
  name, portrait, size = 44,
}: { name: string; portrait?: string | null; size?: number }) {
  const hue = speakerHue(name || 'unknown');
  return (
    <div
      className="jy-portrait shrink-0"
      style={{
        width: size,
        height: size,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['--jy-portrait-hue' as any]: `${hue}`,
      }}
      aria-hidden
    >
      {portrait ? (
        <img src={portrait} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : (
        <span className="jy-portrait-initials">{speakerInitials(name || '?')}</span>
      )}
    </div>
  );
}
