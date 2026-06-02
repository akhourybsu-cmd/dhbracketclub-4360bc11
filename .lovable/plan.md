## Goal

In Drafts, prevent a pick from being submitted until the AI has finished verifying:
1. Spelling/canonical form (so the user can accept a correction first)
2. Duplicate check against picks already taken in this draft

Today, the bar under the input shows the result, but the **Submit** button is only disabled when the field is empty — so a user can hit Enter or Send before the AI has answered, or even when the AI has flagged a duplicate.

## Behavior

- While the AI check is pending (debounce running or request in-flight) → Submit is **disabled** with a subtle spinner state; Enter is ignored.
- If the user presses Submit/Enter before the debounced check has fired → we flush the check immediately, await the result, then evaluate.
- If the AI returns `is_duplicate: true` → Submit stays **disabled** (hard block — you can't draft something already taken). The existing yellow warning bar remains the explanation. User must edit the text to unblock.
- If the AI returns a spelling `corrected_text` → Submit is **disabled** until the user either taps the suggested correction (which replaces the text and re-validates) or dismisses the suggestion (treats the original as intentional). Same one-tap UX as today; we just gate Send on the user making that choice.
- If the AI returns `is_irrelevant: true` (but not duplicate) → keep current behavior (warn only, allow submit). The user explicitly framed the requirement around "proper edit" + "hasn't been duplicated"; relevance stays advisory so creative picks aren't blocked.
- Once text is validated clean (no correction, no duplicate), Submit re-enables instantly.

## Technical notes

**`src/hooks/usePickSuggestion.ts`**
- Track the last text that produced the current `suggestion` result; expose `validatedText: string | null`.
- Add `isPending` (true between text-change and check-complete) = `checking || debounceScheduled || validatedText !== currentText`.
- Add `validateNow(text)`: cancels debounce, runs `checkPick` immediately, returns the resolved suggestion (or null).

**`src/pages/DraftDetailPage.tsx`** (pick input block ~lines 1284–1325)
- Compute `canSubmit = pickText.trim().length > 0 && !submitting && !isPending && !suggestion?.is_duplicate && !suggestion?.corrected_text`.
- `disabled={!canSubmit}` on the Send button; same gate on the Enter handler.
- Wrap `handleMakePick` so that if `isPending` when invoked, it awaits `validateNow(pickText)` first and aborts if the result is a duplicate or a correction.
- Replace the standalone spinner next to the input with a Send button that swaps its icon to `Loader2` while `isPending`, so the "we're checking" state lives on the action itself (clearer affordance that Send is gated).
- When the user dismisses the corrected-text suggestion via the existing X button, treat that as "accept original" — no extra UI needed since `clearSuggestion()` already nulls it and `validatedText` will match.

## Files touched

- `src/hooks/usePickSuggestion.ts` — expose `isPending`, `validatedText`, `validateNow`
- `src/pages/DraftDetailPage.tsx` — gate Submit + Enter on the new state; reflect pending state on the Send button

No backend, schema, or RLS changes. Edge function `check-draft-pick` already returns the needed fields.
