import { CountdownRing } from './CountdownRing';

interface OnTheClockTimerProps {
  lastPickAt: string | null;
  draftStartedAt: string | null;
  /** When true, render the full circular countdown ring (used in the live banner). */
  variant?: 'inline' | 'ring';
  /** Pixel size for the ring variant. */
  size?: number;
}

/**
 * Backwards-compatible wrapper around the new CountdownRing.
 * - `inline` (default): compact ring + readout that drops into existing rows.
 * - `ring`: full-size cinematic countdown ring for the on-the-clock panel.
 */
export function OnTheClockTimer({
  lastPickAt,
  draftStartedAt,
  variant = 'inline',
  size,
}: OnTheClockTimerProps) {
  const startedAt = lastPickAt || draftStartedAt;
  if (variant === 'ring') {
    return (
      <div className="flex items-center justify-center mt-2">
        <CountdownRing startedAt={startedAt} size={size ?? 96} />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center mt-2">
      <CountdownRing startedAt={startedAt} size={size ?? 44} compact />
    </div>
  );
}
