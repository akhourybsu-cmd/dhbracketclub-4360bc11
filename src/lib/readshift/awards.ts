// ═══════════════════════════════════════════════════════════════════
// READSHIFT — deterministic round awards (non-scoring, fun)
//
// Awards are derived purely from stored round results — NEVER from AI.
// Each award has an explicit mathematical rule and a deterministic
// tie-break (lowest author id wins ties) so the same results always
// yield the same awards.
// ═══════════════════════════════════════════════════════════════════
import type { AnswerScoreDetail, RoundScore } from './types';

export interface RoundAward {
  key: string;
  label: string;
  /** The winning player (author or reader depending on the award). */
  userId: string;
  /** A small stored value that justifies the award (for display). */
  value: number;
}

/** argmax over answers by `metric`, deterministic tie-break by author id. */
function pickAnswer(
  details: AnswerScoreDetail[],
  metric: (d: AnswerScoreDetail) => number,
  requirePositive = true,
): AnswerScoreDetail | null {
  let best: AnswerScoreDetail | null = null;
  let bestVal = -Infinity;
  for (const d of details) {
    const v = metric(d);
    if (v > bestVal || (v === bestVal && best && d.authorUserId < best.authorUserId)) {
      best = d;
      bestVal = v;
    }
  }
  if (!best) return null;
  if (requirePositive && metric(best) <= 0) return null;
  return best;
}

export function computeRoundAwards(score: RoundScore): RoundAward[] {
  const details = Object.values(score.perAnswer);
  const awards: RoundAward[] = [];
  const push = (key: string, label: string, d: AnswerScoreDetail | null, value: number) => {
    if (d) awards.push({ key, label, userId: d.authorUserId, value });
  };

  // Best Frame — FRAME answer with the most target-attributions.
  const bestFrame = pickAnswer(details.filter((d) => d.signal === 'FRAME'), (d) => d.targetGuessCount);
  push('best_frame', 'Best Frame', bestFrame, bestFrame?.targetGuessCount ?? 0);

  // Best Blur — BLUR answer with the most wrong readers.
  const bestBlur = pickAnswer(
    details.filter((d) => d.signal === 'BLUR'),
    (d) => d.eligibleReaderCount - d.correctGuessCount,
  );
  push('best_blur', 'Best Blur', bestBlur, bestBlur ? bestBlur.eligibleReaderCount - bestBlur.correctGuessCount : 0);

  // Most Obvious Tell — TELL answer identified by the most readers.
  const obviousTell = pickAnswer(details.filter((d) => d.signal === 'TELL'), (d) => d.correctGuessCount);
  push('most_obvious_tell', 'Most Obvious Tell', obviousTell, obviousTell?.correctGuessCount ?? 0);

  // Hardest to Read — answer (any signal) with the fewest correct IDs
  // relative to eligible readers (highest "miss rate"), min 2 eligible.
  const hardest = pickAnswer(
    details.filter((d) => d.eligibleReaderCount >= 2),
    (d) => (d.eligibleReaderCount - d.correctGuessCount) / d.eligibleReaderCount,
    false,
  );
  push('hardest_to_read', 'Hardest to Read', hardest, hardest ? hardest.eligibleReaderCount - hardest.correctGuessCount : 0);

  // Biggest Incorrect Consensus — the answer where the most readers agreed
  // on a SINGLE wrong author.
  let consensus: { d: AnswerScoreDetail; count: number } | null = null;
  for (const d of details) {
    for (const [guessed, count] of Object.entries(d.guessDistribution)) {
      if (guessed === d.authorUserId) continue; // must be wrong
      if (!consensus || count > consensus.count || (count === consensus.count && d.authorUserId < consensus.d.authorUserId)) {
        consensus = { d, count };
      }
    }
  }
  if (consensus && consensus.count >= 2) {
    awards.push({ key: 'biggest_incorrect_consensus', label: 'Biggest Incorrect Consensus', userId: consensus.d.authorUserId, value: consensus.count });
  }

  // Mind Reader — reader with the most correct identifications (min 1).
  let topReader: string | null = null;
  let topReads = 0;
  for (const [reader, count] of Object.entries(score.correctReads)) {
    if (count > topReads || (count === topReads && topReader && reader < topReader)) {
      topReader = reader;
      topReads = count;
    }
  }
  if (topReader && topReads > 0) {
    awards.push({ key: 'mind_reader', label: 'Mind Reader', userId: topReader, value: topReads });
  }

  return awards;
}
