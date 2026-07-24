-- ═══════════════════════════════════════════════════════════════════
-- In-app notifications inbox.
--
-- The app already fires OS push via send-push-notification, but that signal
-- evaporates if push is denied / the tab is closed. This table gives every
-- recipient a durable, per-user in-app record (bell + unread badge + history),
-- written by the same edge-function fan-out that sends push — so push and the
-- inbox stay in sync and respect the same per-type preferences.
--
-- Rows are inserted by the edge function (service role, bypasses RLS). Clients
-- only ever read / mark-read / dismiss their OWN rows.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  club_id        uuid references public.clubs(id) on delete cascade,
  -- Matches the notification "type" used by send-push-notification
  -- (mention, reply, reaction, draft, event, poll, readshift, …).
  type           text not null,
  title          text not null,
  body           text,
  -- In-app deep link to the source (e.g. /chat?channel=..&message=..).
  url            text,
  actor_user_id  uuid references auth.users(id) on delete set null,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, read_at, created_at desc);
create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications: read own" on public.notifications;
create policy "notifications: read own" on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications: update own" on public.notifications;
create policy "notifications: update own" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications: delete own" on public.notifications;
create policy "notifications: delete own" on public.notifications
  for delete to authenticated
  using (user_id = auth.uid());

-- No INSERT policy: only the edge function (service role) writes rows.

-- Live unread badge needs realtime on this table.
alter publication supabase_realtime add table public.notifications;
