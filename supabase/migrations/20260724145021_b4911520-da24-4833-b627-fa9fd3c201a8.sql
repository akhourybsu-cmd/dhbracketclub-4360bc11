
create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  club_id        uuid references public.clubs(id) on delete cascade,
  type           text not null,
  title          text not null,
  body           text,
  url            text,
  actor_user_id  uuid references auth.users(id) on delete set null,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);

grant select, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;

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

do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;
