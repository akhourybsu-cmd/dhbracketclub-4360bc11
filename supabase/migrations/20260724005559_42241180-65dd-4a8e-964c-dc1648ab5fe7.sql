create table if not exists public.message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  constraint message_reports_status_chk check (status in ('pending','reviewed','dismissed')),
  constraint message_reports_reason_len check (char_length(reason) between 1 and 500),
  unique (message_id, reporter_id)
);
create index if not exists message_reports_message_idx on public.message_reports (message_id);
create index if not exists message_reports_status_idx on public.message_reports (status);

grant select, insert, update on public.message_reports to authenticated;
grant all on public.message_reports to service_role;

alter table public.message_reports enable row level security;

drop policy if exists message_reports_insert_own on public.message_reports;
create policy message_reports_insert_own on public.message_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists message_reports_select_own on public.message_reports;
create policy message_reports_select_own on public.message_reports for select
  using (auth.uid() = reporter_id);

drop policy if exists message_reports_admin_select on public.message_reports;
create policy message_reports_admin_select on public.message_reports for select
  using (public.is_app_admin(auth.uid()));

drop policy if exists message_reports_admin_update on public.message_reports;
create policy message_reports_admin_update on public.message_reports for update
  using (public.is_app_admin(auth.uid()))
  with check (public.is_app_admin(auth.uid()));

do $$
begin
  begin
    alter publication supabase_realtime add table public.message_reports;
  exception when duplicate_object then null;
  end;
end $$;