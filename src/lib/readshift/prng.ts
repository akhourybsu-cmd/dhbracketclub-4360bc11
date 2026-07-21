// ═══════════════════════════════════════════════════════════════════
// READSHIFT — deterministic pseudo-random utilities
//
// The engine must be reproducible from a stored seed (so Signal
// assignment can be planned/audited and replayed identically on server
// and in tests). We use mulberry32 — a tiny, fast, well-distributed
// 32-bit PRNG — rather than Math.random (which is non-deterministic and
// banned in this repo's workflow context anyway).
// ═══════════════════════════════════════════════════════════════════

/** A deterministic RNG returning floats in [0, 1). */
export type Rng = () => number;

/** mulberry32 — seed is coerced to a uint32. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable string → uint32 hash (FNV-1a). Lets us derive seeds from ids. */
export function hashStringToSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Combine a base seed with a round index into a distinct per-round seed. */
export function deriveRoundSeed(seed: number, roundIndex: number): number {
  // XOR with a scaled golden-ratio constant keeps successive rounds
  // well-separated in the PRNG's output space.
  return (seed ^ Math.imul(roundIndex + 1, 0x9e3779b1)) >>> 0;
}

/** Deterministic Fisher–Yates shuffle. Returns a NEW array; input untouched. */
export function seededShuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
