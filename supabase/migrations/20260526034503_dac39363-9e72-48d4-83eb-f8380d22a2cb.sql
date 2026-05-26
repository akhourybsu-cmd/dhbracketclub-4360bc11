create table if not exists public.notification_sent_log (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  entity_id text not null,
  variant text not null default '',
  sent_at timestamptz not null default now()
);

create unique index if not exists notification_sent_log_dedupe_idx
  on public.notification_sent_log (type, entity_id, variant);

create index if not exists notification_sent_log_sent_at_idx
  on public.notification_sent_log (sent_at desc);

create index if not exists notification_sent_log_type_sent_at_idx
  on public.notification_sent_log (type, sent_at desc);

alter table public.notification_sent_log enable row level security;

drop policy if exists "Admins can view notification log" on public.notification_sent_log;
create policy "Admins can view notification log"
  on public.notification_sent_log
  for select
  to authenticated
  using (public.is_app_admin(auth.uid()) or public.is_platform_owner(auth.uid()));
