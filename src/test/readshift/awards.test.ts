import { describe, it, expect } from 'vitest';
import { computeRoundAwards } from '@/lib/readshift/awards';
import type { AnswerScoreDetail, RoundScore, Signal } from '@/lib/readshift/types';

function detail(over: Partial<AnswerScoreDetail> & { authorUserId: string; signal: Signal }): AnswerScoreDetail {
  return {
    frameTargetUserId: null,
    eligibleReaderCount: 0,
    correctGuessCount: 0,
    guessDistribution: {},
    targetGuessCount: 0,
    strongReadCount: 0,
    strongReadCorrectCount: 0,
    signalBaseTotal: 0,
    bonuses: [],
    signalPoints: 0,
    ...over,
  };
}

function makeScore(details: AnswerScoreDetail[], correctReads: Record<string, number>): RoundScore {
  const perAnswer: Record<string, AnswerScoreDetail> = {};
  for (const d of details) perAnswer[d.authorUserId] = d;
  return {
    readingPoints: {},
    signalPoints: {},
    totalPoints: {},
    perAnswer,
    correctReads,
    strongReadCorrect: {},
  };
}

describe('READSHIFT round awards (deterministic, no AI)', () => {
  const score = makeScore(
    [
      detail({ authorUserId: 'A', signal: 'FRAME', frameTargetUserId: 'C', eligibleReaderCount: 4, correctGuessCount: 0, targetGuessCount: 3, guessDistribution: { C: 3, B: 1 } }),
      detail({ authorUserId: 'B', signal: 'BLUR', eligibleReaderCount: 4, correctGuessCount: 0, guessDistribution: { D: 4 } }),
      detail({ authorUserId: 'C', signal: 'TELL', eligibleReaderCount: 4, correctGuessCount: 4, guessDistribution: { C: 4 } }),
    ],
    { r1: 4, r2: 1 },
  );
  const awards = computeRoundAwards(score);
  const byKey = Object.fromEntries(awards.map((a) => [a.key, a]));

  it('Best Frame → the FRAME with the most target attributions', () => {
    expect(byKey['best_frame']).toMatchObject({ userId: 'A', value: 3 });
  });
  it('Best Blur → the BLUR with the most wrong readers', () => {
    expect(byKey['best_blur']).toMatchObject({ userId: 'B', value: 4 });
  });
  it('Most Obvious Tell → the TELL identified by the most readers', () => {
    expect(byKey['most_obvious_tell']).toMatchObject({ userId: 'C', value: 4 });
  });
  it('Biggest Incorrect Consensus → most readers agreeing on one wrong author', () => {
    expect(byKey['biggest_incorrect_consensus']).toMatchObject({ userId: 'B', value: 4 });
  });
  it('Mind Reader → the most accurate reader', () => {
    expect(byKey['mind_reader']).toMatchObject({ userId: 'r1', value: 4 });
  });
  it('is fully deterministic (stable across runs)', () => {
    expect(computeRoundAwards(score)).toEqual(awards);
  });
});
