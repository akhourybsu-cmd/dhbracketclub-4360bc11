## Phase 2: Cron Jobs + Server-Side Triggers + Remaining Client Triggers

Building on the Phase 1 foundation (schema, edge fn, `notify()` helper, grouped prefs UI, initial client triggers), this phase fills the remaining gaps.

### 1. Scheduled reminder edge functions + cron jobs

All follow the `lockbox-daily-reminder` pattern: cron-secret-gated, fan-out via `send-push-notification`, expired-subscription cleanup, preference gating.

| Edge function | Cron schedule | Purpose |
|---|---|---|
| `events-reminder` | every 15 min | T-24h and T-1h pushes to RSVPs (tag `dh-event-<id>-24h`/`-1h`, dedupe via a `events_reminder_log` table) |
| `polls-closing-reminder` | every 15 min | T-1h before `closes_at` + results broadcast on close |
| `pickem-week-reminder` | every 30 min while a week is open | week-open broadcast + T-1h before first kickoff |
| `celebrations-daily` | 08:00 UTC daily | today's birthdays/anniversaries broadcast |
| `brackets-entry-reminder` | hourly | T-24h / T-1h before bracket lock |

Each function:
- Validates `x-cron-secret` against `CRON_SHARED_SECRET`.
- Queries upcoming entities in window.
- Skips users via per-type preference column.
- Writes to a small `notification_sent_log(type, entity_id, variant, sent_at)` table to prevent duplicate sends.
- Returns `{sent, skipped, expired}` summary.

Cron is registered via `supabase--insert` (not migration) per the schedule-jobs convention — contains project-specific URL/anon key.

### 2. Server-side triggers from edge functions

Add `send-push-notification` invocations to existing edge functions where the event originates server-side:

- **`rate-draft`** (already runs on draft finalize) — after writing results, fan out "Draft complete — see the podium" to all participants with `type: 'draft'`, `tag: dh-draft-<id>-complete`.
- **`advance-playoffs`** — broadcast "Semifinal/Final scheduled" + "Season champion" pushes.
- **`start-playoff-match`** — push to the two matched users.
- **`resolve-pick-dispute`** — push the dispute-filer with approve/reject outcome.
- **`score-nfl-week`** — broadcast "Week N results posted" to all pickem players.
- **`pw-week-action`** — already gated on `portfolio_wars` pref (Phase 1); confirm copy + tags.

### 3. Remaining client-side triggers

| Module | File | Trigger |
|---|---|---|
| Drafts | `CreateDraftPage.tsx` / `DraftsListPage.tsx` create flow | "New draft started — join now" to club |
| Events | `EventsPage` cancel/reschedule path | "Event updated" to RSVPs |
| Events | `EventDetailPage` thread insert | comment notify to RSVPs |
| Posts | `PostDetailPage.tsx` reaction handler | reaction notify to post author |
| Lore | `LoreReactionBar.tsx` | reaction notify to lore author |
| Chat | channel-member-add path | "Added to a new channel" |
| Chat | `toggle_message_pin` RPC caller | "Message pinned in #channel" |
| Narrative | scene insert + `transition_narrative_campaign` | scene posted / approval state changes |
| Nexus | `submit_operation_contribution` phase-advance branch + `award_operation_rewards` (server RPC → client follow-up push) | phase advanced / rewards ready |
| Rune Delve | `useDailyChallenge` rotation + `detectMasteryUnlock` | daily available / mastery unlock |
| Brackets | bracket scoring completion | scored broadcast |
| Club admin | `upsert_club_request` caller | notify platform owners |
| Changelog | ChatPage when posting in changelog channel | broadcast to club |

All use the `notify()` helper from Phase 1.

### 4. Diagnostics

- Lightweight `notification_sent_log` table (also doubles as dedupe for crons).
- Add a "Notification activity (24h)" card to `AdminDiagnosticsPage` showing counts by `type`.

### 5. Technical notes

- DB-originated notifications (RPCs / triggers): use `pg_net.http_post` to call `send-push-notification` directly with `CRON_SHARED_SECRET` header, matching the lockbox pattern. No new queue table needed.
- All edge-function pushes use `target_user_ids[]` fan-out — never per-user loops.
- Tag convention preserved: `dh-<type>-<entityId>[-<variant>]`.
- Every client trigger uses `.catch(() => {})` via `notify()` so push failures never block UX.
- No new dependencies.

### Execution order

1. `notification_sent_log` table migration.
2. Five reminder edge functions + cron registrations.
3. Server-side push injections into existing edge functions.
4. Remaining client triggers, module by module.
5. AdminDiagnostics "Notification activity" card.

### Out of scope (unchanged from Phase 1)

Email, per-channel mute, quiet hours/DND, mobile native push.
