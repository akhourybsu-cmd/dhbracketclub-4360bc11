## Goal

Make the Chat page feel like a real, polished group-chat surface:

1. Polished chat header & UI
2. Reliable create / rename / delete of channels (chat groups) with persistence
3. Comprehensive per-channel settings panel — **Core** (name, description, icon, category, default, type, post-permission) + **Notifications** (per-user mute / mentions-only)

Scope clarification: "chat groups" = **channels** (not platform clubs). The app stays single-club per user.

---

## 1. Fix persistence of channel settings (root cause)

`Channel.channel_type` and `Channel.post_permission` exist in the TS type and the settings dialog, but the **DB columns don't exist** on `public.channels`. Saves silently drop those fields. Migration to add:

- `channel_type text not null default 'general'` with a check constraint for `general | announcements | admin_only | event`
- `post_permission text not null default 'all'` with a check constraint for `all | admins`
- `archived_at timestamptz` (for future soft-archive, no UI yet)
- `updated_at timestamptz` + `set_updated_at` trigger

Backfill: all existing rows get the defaults. RLS already covers reads/writes via the existing "Channels: club write" policy.

---

## 2. Per-channel notification preferences

New table `channel_notification_prefs`:

- `(user_id, channel_id)` unique
- `mode text` — `all | mentions | muted` (default `all`)
- standard timestamps + updated_at trigger
- RLS: user can only read/write their own row
- GRANT to `authenticated` + `service_role`

Wiring:

- `send-push-notification` edge function checks this table before sending; `muted` skips, `mentions` only sends if the message tags the user (re-use existing @mention parser).
- `useChatActions` reaction notifications also respect `muted`.
- Settings dialog adds a Notifications section with 3 segmented options.

---

## 3. Create / rename / delete channels (UI + persistence)

- **Create channel** — new `CreateChannelDialog` opened from a `+` button at the top of the channel list (admins always; non-admins only if a club setting allows — for now: admins only, matches existing decentralized-authority memory). Form fields: name, description (optional), icon, category, type. Inserts with `club_id = current_user_club_id()` and `created_by = auth.uid()`.
- **Rename** — already in `ChannelSettingsDialog`, will now persist `channel_type`/`post_permission` too (post-migration).
- **Delete** — already in `ChannelSettingsDialog` (admin-only). Verify the cascade on `messages`, `message_reactions`, `channel_read_states`, `channel_notification_prefs` exists; add `on delete cascade` to any missing FKs.

All three flows refresh `fetchChannels()` and respect realtime broadcasts so other devices update without manual refresh.

---

## 4. Chat header & UI polish

Targets the header in `ChatPage.tsx` (the row that today shows hamburger / hash / channel name / Pin / Search / Settings). Keep it mobile-first, single row, no overflow:

- Reorganize into 3 zones: **left** (back/menu + channel identity), **center collapsed** (channel name + type chip; tap = open settings), **right** (overflow `⋯` menu containing Search, Pinned, Settings — declutters from 3 icons to 1 on mobile).
- Subtitle line under the channel name: small text like "12 members · Mentions only" when a mute mode is active, otherwise hides.
- Distinct visual for announcement / admin-only channels (subtle accent border + lock chip), reusing tokens already in `channelTypeMeta`.
- Lock body scroll under the header so the title bar stays put when the keyboard opens (the `chatHeight` calc already handles this — header just needs `flex-shrink-0` audit).

No layout overhaul of message list / composer in this pass.

---

## Technical details

**Files touched**

- `supabase/migrations/<ts>_chat_channel_settings.sql` — new columns + new `channel_notification_prefs` table + GRANT + RLS + triggers.
- `src/components/chat/types.ts` — drop the `?` on `channel_type` / `post_permission`; add `NotificationMode` type.
- `src/components/chat/ChannelSettingsDialog.tsx` — add Notifications section; load/save `channel_notification_prefs` for current user.
- `src/components/chat/CreateChannelDialog.tsx` — **new** component mirroring the settings dialog form.
- `src/components/chat/ChannelList.tsx` — add `+` button in header (admins) wired to the new create dialog.
- `src/pages/ChatPage.tsx` — header refactor (3-zone + overflow menu), subtitle, mount `CreateChannelDialog`, refresh on create.
- `supabase/functions/send-push-notification/index.ts` — query `channel_notification_prefs` for each recipient; honor `muted` / `mentions` modes (mentions parser already exists in chat code; replicate the regex).
- `src/hooks/useChatActions.ts` — reaction notifications skip `muted` recipients.

**Memory update after build**

- Update `mem://features/chat/channel-management` to note that `channel_type` / `post_permission` are now real DB columns and persist.
- Add new `mem://features/chat/notification-preferences` entry.

**Out of scope (call out, don't build)**

- Multi-club membership / club switcher.
- In-app club creation.
- Slow mode, archive, members-list panel, role-based per-channel allow lists.

---

## Order of work

1. Migration (columns + prefs table) — must land first, types regen after.
2. Persistence wiring in `ChannelSettingsDialog` + per-user notification section.
3. `CreateChannelDialog` + channel-list `+` button.
4. Header refactor + subtitle.
5. Edge function update to honor notification prefs.
6. Memory update.