// Rune Delve — Enemy Death Burst (V1 visual overhaul)
//
// Plays a one-shot "destruction" animation over an enemy frame at the
// moment its HP hits zero. Replaces the previous experience of "the
// frame just goes gray" with something that reads as a kill.
//
// Implementation: pure CSS keyframes on a position:absolute overlay
// the parent (EnemyDisplay) mounts when it detects an HP→0 transition.
// No JS animation loop; the browser handles the whole burst in one
// composited paint cycle. Auto-unmounts after ~720ms via onAnimationEnd.

import { useEffect, useState } from 'react';

interface Props {
  /** Bumped each time the enemy dies — triggers a fresh burst. Use the
   *  enemy id or a death-count to drive this. */
  triggerKey: number;
  /** Tier drives spark color + intensity. Boss bursts feel heavier. */
  tier?: 'normal' | 'mini' | 'boss';
}

/** Sparks per burst. Boss tier shows more for premium impact. */
const SPARK_COUNT_BY_TIER: Record<NonNullable<Props['tier']>, number> = {
  normal: 6,
  mini: 8,
  boss: 12,
};

/** Per-tier accent color for the death burst. Boss = gold-white,
 *  mini = silver-cyan, normal = ember orange. */
const ACCENT_BY_TIER: Record<NonNullable<Props['tier']>, string> = {
  normal: '15 95% 60%',
  mini: '210 80% 70%',
  boss: '45 95% 65%',
};

export function EnemyDeathBurst({ triggerKey, tier = 'normal' }: Props) {
  // Internal "playing" state lets us mount the layer for the duration
  // of the animation then tear it down — keeps the DOM clean.
  const [playing, setPlaying] = useState<number | null>(null);

  useEffect(() => {
    if (triggerKey <= 0) return;
    setPlaying(triggerKey);
    const t = window.setTimeout(() => setPlaying(null), 750);
    return () => window.clearTimeout(t);
  }, [triggerKey]);

  if (playing === null) return null;

  const count = SPARK_COUNT_BY_TIER[tier];
  const accent = ACCENT_BY_TIER[tier];

  return (
    <span
      aria-hidden
      className="rd-death-burst pointer-events-none absolute inset-0 flex items-center justify-center"
      key={playing}
    >
      {/* Central radial flash — quick, bright, fades. */}
      <span
        className="rd-death-burst-core absolute"
        style={{
          background: `radial-gradient(circle, hsl(${accent} / 0.95), hsl(${accent} / 0.45) 35%, transparent 70%)`,
        }}
      />
      {/* Sparks flying out — count varies by tier. Each spark gets a
          deterministic angle so the burst looks like a starburst rather
          than a random splatter. */}
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 360;
        return (
          <span
            key={i}
            className="rd-death-spark absolute"
            style={{
              // Stored as a CSS variable so the keyframe can read it
              // — keyframes can't interpolate inline transforms but
              // CAN reference custom properties.
              ['--burst-angle' as any]: `${angle}deg`,
              background: `hsl(${accent})`,
              boxShadow: `0 0 6px hsl(${accent} / 0.9)`,
            }}
          />
        );
      })}
    </span>
  );
}
