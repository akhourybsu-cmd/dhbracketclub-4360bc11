import { describe, it, expect } from 'vitest';
import { scoreRound, type ScoreRoundInput } from '@/lib/readshift/scoring';
import type { Ballot, Signal } from '@/lib/readshift/types';

const ballot = (
  readerUserId: string,
  guesses: Record<string, string>,
  strongReadAuthorUserId: string | null = null,
  complete = true,
): Ballot => ({ readerUserId, guesses, strongReadAuthorUserId, complete });

const sig = (signal: Signal, frameTargetUserId: string | null = null) => ({ signal, frameTargetUserId });

describe('READSHIFT scoring — reading points', () => {
  it('awards 1 per correct author id, excludes own answer, no penalty for wrong', () => {
    const input: ScoreRoundInput = {
      answers: ['A', 'B', 'C', 'D'],
      signals: { A: sig('TELL'), B: sig('TELL'), C: sig('TELL'), D: sig('TELL') },
      ballots: [
        // B correctly IDs A and C, misses D; strong read on A (correct)
        ballot('B', { A: 'A', C: 'C', D: 'X' }, 'A'),
      ],
    };
    const s = scoreRound(input);
    // 2 correct (+2) + correct strong read (+2) = 4
    expect(s.readingPoints['B']).toBe(4);
    expect(s.correctReads['B']).toBe(2);
    expect(s.strongReadCorrect['B']).toBe(true);
  });

  it('never scores a reader for guessing their own answer', () => {
    const input: ScoreRoundInput = {
      answers: ['A', 'B'],
      signals: { A: sig('TELL'), B: sig('TELL') },
      ballots: [ballot('A', { A: 'A', B: 'B' })], // A guesses own answer correctly — must not count
    };
    const s = scoreRound(input);
    // A's own answer is skipped. A's only scorable answer is B (correct) →
    // 1 correct (+1) + perfect read of all eligible (+3) = 4.
    expect(s.readingPoints['A']).toBe(4);
    expect(s.correctReads['A']).toBe(1);
  });

  it('awards the Perfect Read bonus for identifying every eligible answer', () => {
    const input: ScoreRoundInput = {
      answers: ['A', 'B', 'C', 'D'],
      signals: { A: sig('TELL'), B: sig('TELL'), C: sig('TELL'), D: sig('TELL') },
      ballots: [ballot('D', { A: 'A', B: 'B', C: 'C' })], // all 3 scorable correct
    };
    const s = scoreRound(input);
    // 3 correct (+3) + perfect (+3) = 6
    expect(s.readingPoints['D']).toBe(6);
  });

  it('ignores incomplete ballots entirely (missed Read)', () => {
    const input: ScoreRoundInput = {
      answers: ['A', 'B', 'C'],
      signals: { A: sig('TELL'), B: sig('TELL'), C: sig('TELL') },
      ballots: [ballot('B', { A: 'A', C: 'C' }, null, false)], // incomplete
    };
    const s = scoreRound(input);
    expect(s.readingPoints['B'] ?? 0).toBe(0);
    // and B's guesses do not affect A/C signal points
    expect(s.signalPoints['A']).toBe(0);
  });

  it('lets a non-submitter still earn Reading points', () => {
    const input: ScoreRoundInput = {
      answers: ['A', 'B', 'C'], // D missed the Shift phase
      signals: { A: sig('TELL'), B: sig('TELL'), C: sig('TELL') },
      ballots: [ballot('D', { A: 'A', B: 'B', C: 'C' })],
    };
    const s = scoreRound(input);
    // D scores all 3 (+3) + perfect (+3) = 6, and has no answer → no signal points
    expect(s.readingPoints['D']).toBe(6);
    expect(s.signalPoints['D'] ?? 0).toBe(0);
  });
});

describe('READSHIFT scoring — TELL', () => {
  it('scores 1 per correct reader + majority bonus', () => {
    const input: ScoreRoundInput = {
      answers: ['A', 'B', 'C', 'D'],
      signals: { A: sig('TELL'), B: sig('BLUR'), C: sig('BLUR'), D: sig('BLUR') },
      ballots: [
        ballot('B', { A: 'A' }), ballot('C', { A: 'A' }), ballot('D', { A: 'A' }),
      ],
    };
    const s = scoreRound(input);
    // 3 correct → base 3 + majority (3 > 1.5) 2 = 5
    expect(s.perAnswer['A'].signalPoints).toBe(5);
    expect(s.signalPoints['A']).toBe(5);
  });
});

describe('READSHIFT scoring — BLUR', () => {
  it('scores per wrong reader + shutout + diversity bonuses', () => {
    const input: ScoreRoundInput = {
      answers: ['A', 'B', 'C', 'D'],
      signals: { A: sig('BLUR'), B: sig('TELL'), C: sig('TELL'), D: sig('TELL') },
      ballots: [
        ballot('B', { A: 'B' }), ballot('C', { A: 'C' }), ballot('D', { A: 'D' }),
      ],
    };
    const s = scoreRound(input);
    // 3 wrong → base 3; shutout (0 correct) +2; diversity (3 distinct guesses) +1 = 6
    expect(s.perAnswer['A'].signalPoints).toBe(6);
  });
});

describe('READSHIFT scoring — FRAME', () => {
  it('scores per target guess + majority + hidden-author bonuses (tie counts)', () => {
    const input: ScoreRoundInput = {
      answers: ['A', 'B', 'C', 'D'],
      signals: { A: sig('FRAME', 'C'), B: sig('TELL'), C: sig('TELL'), D: sig('TELL') },
      ballots: [
        ballot('B', { A: 'C' }), // guesses target
        ballot('C', { A: 'B' }), // C reads own-target answer; not target, not author
        ballot('D', { A: 'C' }), // guesses target
      ],
    };
    const s = scoreRound(input);
    // targetGuesses(C)=2 → base 4; C tied-for-most (C:2,B:1) → +3; nobody guessed author A → +1 = 8
    expect(s.perAnswer['A'].targetGuessCount).toBe(2);
    expect(s.perAnswer['A'].signalPoints).toBe(8);
  });
});

describe('READSHIFT scoring — caps & edge cases', () => {
  it('caps a single answer at signalCapPerRound', () => {
    const readers = Array.from({ length: 8 }, (_, i) => `r${i}`);
    const input: ScoreRoundInput = {
      answers: ['A', ...readers],
      signals: {
        A: sig('FRAME', 'T'),
        ...Object.fromEntries(readers.map((r) => [r, sig('TELL')])),
        T: sig('TELL'),
      },
      ballots: readers.map((r) => ballot(r, { A: 'T' })), // everyone guesses the target
    };
    const s = scoreRound(input);
    // base would be 8*2=16 (+bonuses) but cap is 10
    expect(s.perAnswer['A'].signalPoints).toBe(10);
    expect(s.perAnswer['A'].signalBaseTotal).toBeGreaterThan(10);
  });

  it('excludes missed submitters from the answer pool', () => {
    const input: ScoreRoundInput = {
      answers: ['A', 'B'], // C missed
      signals: { A: sig('TELL'), B: sig('TELL') },
      ballots: [ballot('C', { A: 'A', B: 'B' })],
    };
    const s = scoreRound(input);
    expect(Object.keys(s.perAnswer).sort()).toEqual(['A', 'B']);
    expect(s.perAnswer['C']).toBeUndefined();
  });
});
