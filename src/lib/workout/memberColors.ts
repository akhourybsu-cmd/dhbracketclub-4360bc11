// FORGE — a stable, distinct color per club member.
//
// Used by the club-goal stacked bar and the roster so you can see, at a
// glance, who fed which slice of the flame. The signed-in member always gets
// the FORGE base ember (orange) so "you" is instantly findable; everybody
// else gets a deterministic hue from a palette tuned to read on the dark
// forged-steel surface (and to stay clear of the base orange band).

/** The base ember — always reserved for the signed-in member. */
export const BASE_COLOR = 'hsl(24 95% 55%)';
export const BASE_COLOR_SOFT = 'hsl(24 95% 55% / 0.22)';

/** Palette for everyone else — no oranges, all legible on dark steel. */
const PALETTE = [
  'hsl(190 90% 55%)', // cyan
  'hsl(268 85% 68%)', // violet
  'hsl(142 70% 50%)', // green
  'hsl(340 85% 62%)', // pink
  'hsl(48 95% 58%)',  // gold
  'hsl(212 90% 62%)', // blue
  'hsl(168 70% 48%)', // teal
  'hsl(292 75% 66%)', // magenta
  'hsl(96 60% 52%)',  // lime
  'hsl(0 80% 64%)',   // red
  'hsl(232 85% 70%)', // indigo
  'hsl(158 60% 58%)', // mint
];

function hash(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Deterministic color for a member. `meId` (when it matches) always wins the
 * base ember. Collisions inside a club are avoided by spreading assignment
 * over the sorted roster when one is supplied.
 */
export function memberColor(userId: string, meId?: string | null, roster?: string[]): string {
  if (meId && userId === meId) return BASE_COLOR;
  if (roster && roster.length) {
    const others = roster.filter(id => id !== meId).slice().sort();
    const idx = others.indexOf(userId);
    if (idx >= 0) return PALETTE[idx % PALETTE.length];
  }
  return PALETTE[hash(userId) % PALETTE.length];
}

/** Same color at low opacity, for fills/backgrounds. */
export function memberColorSoft(color: string, alpha = 0.18): string {
  return color.replace(/\)$/, ` / ${alpha})`);
}
