import { describe, it, expect } from 'vitest';
import { mulberry32, hashStringToSeed, deriveRoundSeed, seededShuffle } from '@/lib/readshift/prng';

describe('READSHIFT prng', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toEqual(b);
  });

  it('emits floats in [0,1)', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hashStringToSeed is stable and uint32', () => {
    expect(hashStringToSeed('abc')).toBe(hashStringToSeed('abc'));
    expect(hashStringToSeed('abc')).not.toBe(hashStringToSeed('abd'));
    expect(hashStringToSeed('x') >>> 0).toBe(hashStringToSeed('x'));
  });

  it('deriveRoundSeed separates rounds deterministically', () => {
    expect(deriveRoundSeed(7, 0)).toBe(deriveRoundSeed(7, 0));
    expect(deriveRoundSeed(7, 0)).not.toBe(deriveRoundSeed(7, 1));
  });

  it('seededShuffle is a deterministic permutation that does not mutate input', () => {
    const input = ['a', 'b', 'c', 'd', 'e'];
    const s1 = seededShuffle(input, mulberry32(42));
    const s2 = seededShuffle(input, mulberry32(42));
    expect(s1).toEqual(s2);
    expect(input).toEqual(['a', 'b', 'c', 'd', 'e']); // untouched
    expect([...s1].sort()).toEqual([...input].sort()); // same multiset
  });
});
