// ═══════════════════════════════════════════════════════════════════
// READSHIFT — prompt authoring guidelines (STRICT)
// ═══════════════════════════════════════════════════════════════════
//
// Every prompt in `readshift_prompts` MUST follow these rules. They are
// enforced both by the `isValidPrompt` linter below (used by any
// admin-facing prompt authoring UI or seed migration) and by manual
// review before insert. If you add prompts via a migration, run each
// candidate through `isValidPrompt()` — a failing prompt does not ship.
//
// WHY:
//   READSHIFT scoring depends on players writing *distinctive, voice-
//   revealing* answers. Yes/no and either/or prompts collapse the answer
//   space to two buckets, which makes attribution guessing trivial and
//   kills the "read the room" tension the game is built on. Open-ended,
//   thought-provoking prompts force players to reveal taste, phrasing,
//   and worldview — which is the actual game.
//
// THE RULES:
//   1. OPEN-ENDED ONLY. The prompt must accept a written answer with
//      many plausible directions. If a reasonable person could answer
//      it in ≤3 words with no meaningful variance ("yes", "no", "the
//      internet"), it fails.
//   2. NO EITHER/OR. Never force a choice between two named options
//      ("X or Y", "would you rather A or B"). "Or" is only allowed
//      inside descriptive phrasing (e.g. "a memory or moment that…").
//   3. NO YES/NO. No prompt may be answerable with yes/no. Reject any
//      prompt that starts with is/are/do/does/did/have/has/would/could/
//      should/will/can/was/were UNLESS it's followed by a wh-word
//      ("would you… [what/why/how]").
//   4. NO STACKED PROMPTS. Exactly one question per prompt. Multiple
//      "?" characters, or ". " followed by a second question, fails.
//   5. SINGLE QUESTION MARK OR DECLARATIVE COMMAND. Either end in "?"
//      or open with an imperative verb (Describe, Confess, Rank,
//      Explain, Share, Name, Picture, Pitch).
//   6. THOUGHT-PROVOKING & CATEGORY-FIT. Prompts must invite a personal,
//      voice-revealing answer that plausibly belongs to the chosen
//      category. Generic trivia fails.
//   7. LENGTH. Between 20 and 160 characters. Anything shorter is under-
//      specified; anything longer buries the ask.
//
// Categories and what they should provoke:
//   - "Everyday You"           → small, private, revealing personal
//                                 quirks, habits, or opinions.
//   - "Hot Takes"               → an opinion the player would defend at
//                                 a bar. Never a "yes/no" opinion.
//   - "Group Energy"            → about this specific group's dynamics.
//                                 Should surface who-does-what patterns.
//   - "Throwbacks"              → a specific memory, phase, or artifact.
//                                 Not "what was your childhood like".
//   - "Unhinged Hypotheticals"  → weird, imaginative scenarios that
//                                 demand a creative *description*, never
//                                 a two-option "pick one".

const YES_NO_STARTS = /^(is|are|do|does|did|have|has|had|would|could|should|will|can|was|were|am|may|might|shall)\b(?!.*\b(what|why|how|when|where|which|who|whose)\b)/i;
const EITHER_OR = /\b(either\b.+\bor\b|\bwould you rather\b|\bpick one\b|\bpick\.?$|\btake it\??$|\byes or no\b)/i;
const HAS_OR_CHOICE = /\b\S+\s+or\s+\S+\??\s*(pick|choose|which|\.|\?|$)/i;

export function isValidPrompt(body: string): { ok: true } | { ok: false; reason: string } {
  const s = body.trim();
  if (s.length < 20) return { ok: false, reason: 'Too short — must be ≥20 characters and thought-provoking.' };
  if (s.length > 160) return { ok: false, reason: 'Too long — trim to ≤160 characters.' };

  // Exactly one prompt per row.
  const questionMarks = (s.match(/\?/g) ?? []).length;
  if (questionMarks > 1) return { ok: false, reason: 'Stacked prompts — only one question per row.' };
  if (/[.!?]\s+[A-Z][^.!?]*\?/.test(s)) return { ok: false, reason: 'Contains a second sentence-question — split into one prompt.' };

  // Must be a question or begin with an approved imperative verb.
  const imperativeOpen = /^(describe|confess|share|name|rank|explain|picture|pitch|invent|list|recall|admit)\b/i.test(s);
  if (!s.endsWith('?') && !imperativeOpen) {
    return { ok: false, reason: 'Must end in "?" or open with an imperative (Describe, Confess, Rank, Share, Name, Explain, Picture, Pitch, Invent, List, Recall, Admit).' };
  }

  // No either/or choice framings.
  if (EITHER_OR.test(s)) return { ok: false, reason: 'Either/or framing is banned — rewrite as open-ended.' };
  if (HAS_OR_CHOICE.test(s)) return { ok: false, reason: 'Looks like an "X or Y, pick one" — rewrite as open-ended.' };

  // No yes/no leading verbs unless a wh-word follows.
  if (YES_NO_STARTS.test(s)) return { ok: false, reason: 'Yes/no phrasing is banned — start with what/why/how/which/who or an imperative.' };

  return { ok: true };
}
