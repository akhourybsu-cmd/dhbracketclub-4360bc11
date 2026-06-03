## Goal

Make the draft pick AI check feel helpful, not like a gate. Users shouldn't ever sit staring at a spinner waiting on Submit to enable.

## Behavior change

**Today:** Submit is hard-disabled whenever the AI check is pending OR has flagged a spelling correction OR a duplicate. Pressing Enter early flushes the check and waits for it. This is what makes it feel restrictive — you type a clean pick, hit send, and wait.

**New model — instant submit, advisory AI, one hard block:**

1. **Duplicates → blocked, but checked instantly client-side.** The edge function already normalizes (lowercase + strip punctuation) and compares against `existing_picks` before calling the AI. We do the exact same normalization in the browser against `existingPicks` and block Submit immediately — no network round trip. This is the only hard block, and it never waits on AI.

2. **Spelling corrections → advisory, never block.** The yellow "Did you mean X?" bar stays, but Submit is enabled. User can tap the suggestion to accept it, or just send their original. Removes the "AI thinks you misspelled it so you can't submit" friction.

3. **Pending AI → never blocks Submit.** Drop the `isPending` / `validateNow` gate entirely. If the user hits send before the AI replies, the pick goes through. The bar can still appear after the fact as an FYI for the *next* pick they make (or we just abort the in-flight check on submit).

4. **Irrelevance → stays advisory (unchanged).**

Net effect: Submit is disabled only when the field is empty, currently submitting, or the text exactly matches something already drafted. Everything else is suggestion-grade.

## Why this is safe

- The "double-drafting" concern from the earlier request is preserved — duplicate detection is deterministic and runs on every keystroke and on submit, no AI required. The AI duplicate check was redundant with the edge function's pre-AI normalization step anyway.
- Spelling/canonical form was always a "nice to have" — the draft owner can correct picks later via the existing inline edit + repick tools, and enrichment already tolerates minor misspellings.
- We keep the visible warning UI so the AI's work isn't wasted, it just stops blocking.

## Files to touch

- **`src/hooks/usePickSuggestion.ts`** — add a `localDuplicate` boolean derived synchronously from `existingPicks` + current text using the same normalization as the edge function. Keep `suggestion`, `checking`, `debouncedCheck`, `clearSuggestion`. Drop `isPending`, `validatedText`, `validateNow` (no longer needed).
- **`src/pages/DraftDetailPage.tsx`** — Submit gate becomes `pickText.trim().length > 0 && !submitting && !localDuplicate`. Enter key uses the same gate. Send button loses the spinner-while-checking state (it's no longer gating). The warning bar under the input stays as-is for spelling/relevance/server-confirmed duplicates. Remove the `validateNow` call in `handleMakePick`.

No backend or edge-function changes — `check-draft-pick` keeps working exactly as it does today; we just stop treating its response as a submission gate.
