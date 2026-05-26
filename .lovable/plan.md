# Notification Systems Audit & Gap Fill

## What exists today

**Infrastructure (solid):**
- `send-push-notification` edge function with VAPID, expired-subscription cleanup, throttling (60s/channel), active-viewer suppression (30s), per-type preference gating, mentions override.
- 6 preference toggles in `notification_preferences`: `chat_messages`, `mentions`, `polls`, `events`, `drafts`, `lockbox`.
- Service worker tag-coalescing for bursts (per-message, per-thread).
- Test push from Profile + Admin Diagnostics.

**Modules currently firing pushes:**
| Module | Trigger | Pref gate |
|---|---|---|
| Chat messages | message insert | `chat_messages` |
| Chat mentions | @name parse | `mentions` (bypasses throttle/active) |
| Thread replies | reply insert | `chat_messages` |
| Reactions | emoji react | `chat_messages` |
| Polls | new poll | `polls` |
| Events | new event | `events` |
| Drafts | turn alerts | `drafts` |
| Lockbox | Lock Ready / Cracked / reminder | `lockbox` |
| Portfolio Wars | week lock / finalize | ❌ no pref (uses generic) |

## Identified gaps

### A. Modules with zero push coverage
1. **Portfolio Wars** — has server pushes but no preference toggle and no client-side triggers for milestones.
2. **NFL Pick'em** — week open, T-1h before first kickoff, results posted, weekly winner.
3. **Rankings** — new ranking created, ranking finalized.
4. **Posts / Feed** — comments on your post, reactions to your post.
5. **Lore** — contribution added to your entry, reaction on your entry.
6. **Birthdays & Milestones** — daily morning push for today's celebrations.
7. **Narrative RPG** — campaign invite, GM scene posted, your turn, approval state changes (pending → approved / needs_changes).
8. **Brackets / Pools** — new pool invite, bracket lock T-1h, bracket scored.
9. **Nexus Defense** — operation phase advanced, operation completed/rewards distributed.
10. **Rune Delve** — daily challenge available, class mastery unlocked.
11. **Club admin** — new club join request (for admins), new member joined.
12. **Changelog** — push when a new changelog post is published.

### B. Existing-module gaps (more triggers needed)
- **Drafts:** draft created (invite all), draft completed + results, dispute filed/resolved, season playoffs starting, semifinal/final scheduled, season champion crowned.
- **Events:** RSVP T-24h reminder, T-1h reminder, event canceled/rescheduled, new comment on event thread you RSVP'd to.
- **Polls:** poll closing in 1h, results published.
- **Chat:** added to a new channel, message pinned in a channel you follow.

### C. Plumbing gaps
- No `portfolio_wars`, `pickem`, `rankings`, `posts`, `lore`, `celebrations`, `narrative`, `brackets`, `nexus`, `runedelve`, `system` columns in `notification_preferences` — but `send-push-notification`'s `prefColumn` switch only knows the original 6 types.
- No scheduled-reminder infrastructure for events / pickem / poll closing (lockbox has `pg_cron` reminder — pattern to copy).
- No "digest" notifications (weekly draft standings, monthly leaderboard).
- VAPID subject hardcoded to `https://dryhorse.app` — fine, just noting.

## Plan

### 1. Expand notification preferences schema
Migration adds columns to `notification_preferences` (default `true`):
`portfolio_wars`, `pickem`, `rankings`, `posts`, `lore`, `celebrations`, `narrative`, `brackets`, `nexus`, `runedelve`, `system`.

Update `useNotificationPreferences` + `NotificationPreferencesSection` to render grouped toggles (Competition / Social / Games / System) so the list stays scannable.

### 2. Extend `send-push-notification`
- Add the new types to the allowed-type switch and `prefColumn` map.
- Keep tag-coalescing convention (`dh-<type>-<entityId>`).
- No breaking change for existing callers.

### 3. New triggers (client + edge)
| Module | Where | Trigger added |
|---|---|---|
| Drafts | `rate-draft` edge fn (already runs on finalize) | broadcast "Draft complete + podium" to participants |
| Drafts | `DraftsListPage` create flow | "New draft started — join now" to all club members |
| Drafts | `start-playoff-match`, `advance-playoffs` | semifinal/final scheduled + season champion |
| Drafts | `resolve-pick-dispute` | "Your pick was approved/rejected" |
| Events | new `pg_cron` job + `event-reminder` edge fn | T-24h / T-1h to RSVPs |
| Events | EventDetailPage thread insert | reply notify to RSVPs (reuses thread fan-out) |
| Events | EventsPage cancel/reschedule path | "Event updated" |
| Polls | new `pg_cron` `poll-closing-reminder` | T-1h before close + results on close |
| Pick'em | `sync-nfl-week` + new `nfl-week-reminder` cron | week open / T-1h / results |
| Rankings | CreateRankingPage submit | "New ranking, cast your votes" |
| Posts | PostDetailPage comment insert + reaction | notify post author |
| Lore | useLoreContributions insert / reaction | notify lore author |
| Celebrations | new `celebrations-daily` cron at 8am club-local | today's birthdays/anniversaries |
| Narrative | `transition_narrative_campaign` RPC + scene insert + invite insert | matching narrative push |
| Brackets | bracket entry deadline cron + scoring edge fn | reminders + results |
| Nexus | `submit_operation_contribution` phase-advance branch + `award_operation_rewards` | phase advanced + rewards ready |
| Rune Delve | `useDailyChallenge` rotation + `detectMasteryUnlock` | daily available + mastery unlock |
| Club admin | `upsert_club_request` (RPC) | notify platform owners + club admins |
| Changelog | ChatPage when posting in changelog channel | broadcast to club |
| Portfolio Wars | existing `pw-week-action` | gate on new `portfolio_wars` pref |

For triggers that fire from inside the DB (RPCs / cron), use a small `notify-push` invocation helper (HTTP from `pg_net` if available, else schedule via an `events_queue` table polled by an edge fn — pattern lockbox already uses).

### 4. Reminder cron jobs
Add `pg_cron` schedules (mirroring `lockbox-daily-reminder`):
- `events-reminder-hourly` — checks `events.start_at` for T-24h / T-1h.
- `polls-closing-hourly` — checks `polls.closes_at`.
- `pickem-week-reminder` — every 30 min while a week is open.
- `celebrations-daily` — 8am club timezone (use club setting or UTC default).
- `brackets-entry-reminder` — hourly.

### 5. UI polish
- Group toggles in `NotificationPreferences.tsx` with section headers and icons.
- Keep "Send Test Notification" button.
- Add "Notification activity" admin diagnostics panel showing last 24h push counts by type (read from a lightweight `push_log` table — already partial via throttle table; add `type` column).

## Technical notes
- `send-push-notification` already supports `target_user_ids[]` fan-out — reuse it everywhere; avoid one-by-one invokes.
- Use `tag: dh-<type>-<id>` for all new notifications so the SW coalesces correctly.
- Respect active-viewer suppression where channel context exists (events, posts, lore detail pages should write to a `presence` table the function can query — optional v2).
- All new client-side triggers use `.catch(() => {})` — push failures must never block the user action.
- No new icon libraries; reuse `lucide-react` icons in the preferences UI.

## Out of scope (call out, don't build)
- Email notifications (push only for now).
- Per-channel mute (chat already has channel mute via existing settings).
- Quiet hours / DND scheduling (good v2 follow-up).
- Mobile native push (PWA web-push only).

After your approval I'll execute in this order: migration → edge fn update → client triggers module-by-module → cron jobs → UI grouping.
