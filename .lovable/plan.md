# Narrative RPG — Level-Up Plan

A comprehensive roadmap to evolve Narrative RPG from a working Chronicle Engine into a flagship plugin that's delightful for both GMs and players. Organized by theme, then sequenced into phases.

## Goals

1. **Cut GM workload in half** — fewer taps, smarter defaults, AI doing the boring parts.
2. **Make players feel present** — even async sessions should feel alive.
3. **Show, don't tell** — the campaign world should be visible, not buried in tabs.
4. **Polish the seams** — typography, motion, sound, and shared visual identity.

---

## 1. Design & Visual Identity

A distinct "tabletop / pulp paperback" aesthetic that sets Narrative apart from other modules.

- **Campaign-themed palettes** — each template (Flamingo Protocol, etc.) gets a signature palette + accent gradient + grain texture, applied to the detail page header, GM Console, message bubbles, and chapter cards.
- **Typography pass** — display serif for chapter titles and scene openers; mono for system/dice; current sans for body. Pull from existing font-pair tokens.
- **Scene Message redesign** — distinct bubble styles per `message_type` (gm_narration = full-bleed prose card, npc_dialogue = quoted with NPC portrait + name chip, player = right-aligned bubble, system = subtle inline, dice = result chip with crit/fail flair, chapter_transition = full-width title card with parallax).
- **Chapter Transition Overlay v2** — letterboxed full-screen takeover with recap + hook + "Begin Chapter" CTA, programmatic sound sting.
- **Dice roll cinematics** — short 3D-ish die animation (CSS/SVG), crit success = confetti, crit fail = screen shake.
- **NPC & location portraits** — AI-generated cover images (Nano Banana) on first reference, cached on the row; fallback to colored monogram tile.
- **Campaign cover hero** — large hero image on the detail page (AI-generated from premise + tone profile).
- **Empty states** — replace the generic gradient-icon pattern with narrative-themed empty states ("No clues yet. The fog is thick.").
- **Dark mode lock** — Narrative looks best dark; force dark within `/narrative/*` like Nexus does.

## 2. GM Efficiency

The GM is the bottleneck. Everything here removes friction.

- **GM Console redesign** — replace the 10-tab drawer with a left-rail icon nav + main panel, so common actions (Scene · NPCs · Clocks) are always one tap away. Pin the active scene to the top.
- **Quick Actions bar** above the composer: "Advance scene clock", "NPC speaks", "Reveal clue", "End scene" — all open pre-filled Writer's Room tools.
- **One-tap NPC dialogue** — tap any NPC chip → AI drafts a line in their voice, GM edits inline, post. No multi-modal flow.
- **Smart defaults from context** — Writer's Room pre-fills tone/length/safety from the campaign tone profile + current scene stakes. GM rarely touches the controls.
- **Auto-suggest state updates** — after every player message, surface a non-blocking "Should this add a clue / advance a clock?" chip in the GM-only ribbon.
- **GM-only ribbon** — persistent, collapsible bar visible only to GMs at the top of Story Chat showing: active scene, active clocks (mini progress dots), waiting-on, AI suggestion count.
- **Scene templates** — save any scene as a reusable template (premise, NPCs, clocks, stakes); spin up new scenes in 2 taps.
- **Bulk approve AI suggestions** — multi-select in NarrativeApprovalsPanel, approve all, edit individually before commit.
- **GM notes** — markdown scratchpad per campaign/scene, never shown to players, AI can read it as context.
- **Session prep mode** — a focused full-screen view: outline next scene's beats, draft NPC openers, queue clocks, all before going live.

## 3. Player Experience

Players currently mostly read and post. Give them more agency without giving them GM powers.

- **Character sheet drawer** — always one-tap accessible from Story Chat (bottom-left); shows stats, conditions, inventory, recent rolls.
- **Intent buttons on composer** — "Speak in character" / "Describe action" / "Aside (OOC)" — formats the post and tags `message_type`.
- **Player-initiated rolls** — tap a stat on your sheet → pick reason → roll. Result posts as `dice_roll` and GM gets an AI-drafted resolution suggestion.
- **Player AI assist polish** — show the rewrite inline (diff highlight) instead of replacing the draft outright; accept/reject per paragraph.
- **Spotlight indicator** — when it's your character's "turn" (GM tagged you or `waiting_on_state` includes you), pulse the composer + push notification.
- **Public world tab** — players see only the public scope of Clues / NPCs / Locations / Factions with rich cards (no admin chrome).
- **Personal log** — automatic per-player feed of "what your character did/learned this session" (filtered from scene log).
- **Async-friendly recaps** — "Catch me up" button = AI summary of messages since you last visited, scoped to public + things involving your character.

## 4. AI Capabilities

We already invoke `narrative-ai`. Expand it.

- **Streaming responses** — stream Writer's Room drafts token-by-token so the GM can stop early.
- **Tone profile learning** — feed past approved messages back into the system prompt so the AI's voice converges on the campaign's voice over time.
- **NPC voice memory** — store a few "signature lines" per NPC; AI uses them as examples when drafting that NPC's dialogue.
- **Auto-recap generator** — at scene end, AI proposes a structured summary (decisions, quotes, unresolved questions, memory diff) → SceneSummaryWizard already exists, just auto-trigger.
- **"What would my NPC do?"** — GM taps an NPC, picks an event ("the players just lied about the briefcase"), AI returns reaction + suggested state updates.
- **Image generation** — generate NPC portraits, location art, scene establishing shots via Nano Banana on demand.
- **Voice (stretch)** — read GM narration aloud with a tone-matched TTS voice on player devices.
- **AI quotas + cost guardrails** — per-campaign daily AI call budget surfaced to GM; soft warn at 80%.

## 5. Real-Time & Presence

- **Typing indicators** — show "GM is writing…" / "Alex is writing…" using realtime broadcast (not DB writes).
- **Read receipts** — last-read marker per user per campaign; GM sees who's caught up.
- **Live session mode polish** — when LiveSessionControls is "live", boost realtime cadence, show presence avatars in the header, enable typing indicators, push to absent players.
- **Round-robin spotlight timer** — optional GM toggle that auto-rotates `waiting_on_state` through players at a set interval to keep async sessions moving.

## 6. Scene & Chapter Architecture

- **Scene timeline view** — horizontal scrollable timeline of all scenes in the current chapter, tap to jump.
- **Chapter map** — visual graph of chapters with branching options (resolved/unresolved).
- **Scene goals & stakes pinned** — always visible at top of Story Chat (collapsible).
- **End-of-scene wrap** — explicit "End scene" action triggers ChapterTransitionOverlay + memory write + state diff review.

## 7. World State Visibility

- **World tab redesign** — a single explorable canvas with Locations, NPCs, Factions, Clues, Items grouped by relevance to current scene, with filter chips.
- **Faction relationship web** — small force-directed graph showing factions + their attitudes toward each other and the party.
- **Clock dashboard** — every active clock as a ring with progress, name, and "what happens at full" tooltip.
- **Inventory per character** — items list on character sheet; transfer items between characters in 2 taps.

## 8. Notifications

- **Per-event preferences** — toggles for: spotlight on me, GM posted, scene started, chapter transitioned, AI suggestion approved.
- **Push to absent players** when GM posts a `chapter_transition` or starts a new scene.
- **Daily digest** — opt-in summary of campaigns you're in, what changed.
- **Quiet hours** — respect existing notification preferences module.

## 9. Onboarding & Tutorials

- **New-GM tour** — GmOnboardingSheet upgrade: interactive 5-step walkthrough touching Scene, NPCs, Clocks, Writer's Room, End Scene.
- **First-player tour** — 3 steps: composer modes, character sheet, rolling.
- **Template gallery** — visual gallery of campaign templates (cover art + tone + one-liner) instead of dropdown.
- **Sample campaign** — every new club gets a read-only "Demo: Flamingo Protocol" so GMs can see what a real campaign looks like.

## 10. Performance & Reliability

- **Pagination** — narrative_messages currently loads all rows; switch to keyset pagination (50 per page) with "load earlier" button.
- **Optimistic posting** — show player's message instantly with a "sending" state, reconcile on insert echo.
- **Realtime channel hygiene** — audit all narrative channels: define all listeners before `.subscribe()`, single channel per page, proper cleanup. (This week's bug was a symptom of this gap.)
- **Query stale times** — bump `useNarrativeCampaign` to 30s stale, rely on realtime for freshness.
- **Background sync** — when tab regains focus after >5 min, refetch instead of trusting stale realtime state.
- **Image lazy-load** — narrative covers/portraits with `loading="lazy" decoding="async"` (per project standard).

## 11. Privacy, Safety & Permissions

- **Scope audit** — verify every query for clues/NPCs/factions/clocks/messages filters by visibility for non-GM viewers. Add RLS tests.
- **GM-only message type enforcement** — `gm_only` messages must be filtered server-side, not client-side. Confirm policy.
- **Safety tools** — "X card" button on composer: anonymously signals discomfort to GM, who sees a non-attributed alert.
- **Lines & veils** — campaign setup includes a content boundaries field shared with the AI as a hard safety constraint.
- **GM transfer** — primary GM can transfer or co-GM a campaign without recreating it.

## 12. Discovery & Social

- **Campaign feed on Home** — when narrative-rpg installed, surface "Next session: Friday 8pm · Flamingo Protocol · You owe a response" card in `RightNowCard`.
- **Cross-campaign Compete entry** — Narrative gets its banner on `/compete` with current active campaigns.
- **Public recap sharing** — auto-generate a shareable image (cover + chapter title + one-line hook) for posting in Chat or Feed.
- **Campaign trophy case** — finished campaigns get a "case file" page (chapters, MVP moments, MVP quotes), pinned in profile.

## 13. Data Model Additions

New tables/columns to support the above. All idempotent migrations with RLS.

- `narrative_scene_templates` (saved scene blueprints)
- `narrative_npc_voice_examples` (per-NPC signature lines)
- `narrative_read_marks` (per-user per-campaign last_seen_message_id)
- `narrative_safety_signals` (anonymous X-card events)
- `narrative_message_reactions` (lightweight emoji reactions)
- `narrative_inventory_items` (currently lives on characters JSON; promote to a row for transferability)
- columns: `narrative_campaigns.cover_image_url`, `narrative_npcs.portrait_url`, `narrative_locations.image_url`, `narrative_campaigns.lines_and_veils`, `narrative_campaigns.tone_examples`

---

## Technical Notes

- Lazy-load all new heavy components via `React.lazy` (consistent with existing routes).
- Continue using `(supabase as any).from('...')` for new tables until types regenerate.
- Reuse `EntityEditSheet` as the canonical inline edit primitive — extend it rather than forking sheets per entity.
- AI calls stay in `aiService.ts`; new tools register in `GM_TOOLS` and `WRITERS_ROOM_TOOL_KEYS`.
- Streaming requires switching `supabase.functions.invoke` to a `fetch` against the function URL with `ReadableStream`.
- Image generation uses the existing Lovable AI Gateway with `google/gemini-2.5-flash-image`.
- All realtime subscriptions must define listeners before `.subscribe()` and tear down via `supabase.removeChannel` on unmount.

---

## Phased Rollout

**Phase A — Foundation (1–2 weeks)**
Realtime hygiene audit · GM-only ribbon · Scene Message redesign · Quick Actions bar · Player intent buttons · Message pagination.

**Phase B — AI Force-Multiplier (1–2 weeks)**
Streaming Writer's Room · Auto-recap on End Scene · NPC voice memory · Smart defaults · Auto-suggest state updates · One-tap NPC dialogue.

**Phase C — World Made Visible (1–2 weeks)**
Cover/portrait generation · World tab redesign · Clock dashboard · Faction web · Character sheet drawer · Inventory promotion.

**Phase D — Live & Social (1 week)**
Typing indicators · Read receipts · Live session mode polish · Spotlight timer · Home/Compete integration · Shareable recaps.

**Phase E — Polish (1 week)**
Dice cinematics · Chapter overlay v2 · Onboarding tours · Sample campaign · Empty states · Trophy case · Safety tools.

---

## Out of Scope (for now)

- Full VTT (virtual tabletop) maps with tokens
- Voice/video calls inside the app
- Marketplace for community-published templates
- Mobile-native gestures beyond what framer-motion gives us
