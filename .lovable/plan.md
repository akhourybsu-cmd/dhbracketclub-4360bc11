## What's happening

The AI judge in `supabase/functions/rate-draft/index.ts` uses **Gemini 2.5 Pro** with today's date injected into the system prompt. The model is told "Use today's real-world status — do not treat released content as unreleased."

But that's the only recency safeguard. The judge gets **only the raw pick text** (e.g. "Nintendo Switch 2") — no release dates, no descriptions, no current status. So when Gemini's training cutoff predates a release (Switch 2 launched June 5, 2025; the model's world knowledge is older), it falls back to "this isn't out yet" and dings the pick. That's what happened on the Video Game Consoles draft.

## Fix: give the judge real facts, not memory

Three layered improvements, ordered by impact.

### 1. Feed enrichment metadata into the judge prompt (biggest win)

Every draft pick already gets enriched by `enrich-draft-picks` and stored in `item_enrichments` (matched name, source provider, and a `metadata` JSON blob that typically includes release year, description, and provider — TMDB, IGDB, iTunes, Pexels, etc.).

`rate-draft` currently ignores all of it. Change:

- After loading picks, fetch `item_enrichments` for every `pick.id` (`item_type = 'draft_pick'`).
- For each pick, append a compact factual line to the prompt, e.g.:
  `Round 3: "Nintendo Switch 2" — Verified: Nintendo Switch 2 (IGDB, released 2025-06-05). Hybrid console, successor to Switch.`
- Add an explicit instruction: *"Treat the 'Verified' facts as ground truth. If a pick is verified as released, do NOT claim it is unreleased, hypothetical, or rumored — even if it conflicts with your prior knowledge."*

### 2. Enable Gemini Google Search grounding for picks the AI is unsure about

The Lovable AI gateway supports Gemini's `google_search` tool. Add it alongside the existing `rate_draft_results` tool call so Gemini can verify recent/uncertain entries (new movies, recent product launches, current sports rosters, etc.) before scoring.

This makes the report robust to anything enrichment missed — sports stats, new albums, current events — without us having to maintain per-category metadata.

### 3. Tighten the recency instruction

Replace the single sentence about "use today's real-world status" with a stricter block that lists the failure modes we've seen:

- Do not say a pick is "unreleased," "upcoming," "rumored," or "hypothetical" unless the Verified facts explicitly say so.
- When in doubt about whether something exists or has launched, treat it as released and score it on merit.
- The current date is {today} — anything with a known release on or before that date is released.

## Files touched

- `supabase/functions/rate-draft/index.ts` — fetch enrichments, build verified-facts block per pick, add Google Search grounding tool, strengthen recency instructions.

No DB schema changes. No client changes. No new secrets.

## Validation

Re-run the report on the Video Game Consoles draft after deploy and confirm Switch 2 is judged as a real, released console. Spot-check one other recent draft to make sure scoring still looks sensible.
