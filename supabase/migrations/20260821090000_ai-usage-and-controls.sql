-- ============================================================
-- AI usage logging + per-club AI master switch
--   * ai_usage_log       — durable, per-call record (model, tokens, cost inputs)
--   * club_ai_settings   — per-club opt-out toggle (default ON)
--   * ai_gate()          — one RPC edge functions call to (a) enforce the
--                          toggle and (b) resolve the caller's club_id for logging
--   * ai_usage_summary() — aggregation the in-app admin report reads
-- ============================================================

-- ── 1. Durable per-call usage log ──────────────────────────
create table if not exists public.ai_usage_log (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  function_name     text not null,
  model             text not null,
  user_id           uuid,
  club_id           uuid,
  feature           text,
  prompt_tokens     integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens      integer not null default 0,
  success           boolean not null default true,
  error_status      integer
);

create index if not exists idx_ai_usage_log_created  on public.ai_usage_log (created_at desc);
create index if not exists idx_ai_usage_log_club      on public.ai_usage_log (club_id, created_at desc);
create index if not exists idx_ai_usage_log_function  on public.ai_usage_log (function_name);

alter table public.ai_usage_log enable row level security;

-- Rows are written exclusively by edge functions via the service role (which
-- bypasses RLS). Clients get read-only, and only admins:
--   * platform owner / app admin  → every row (incl. rows with null club_id)
--   * club admin                  → their own club's rows
drop policy if exists "admins read ai usage" on public.ai_usage_log;
create policy "admins read ai usage" on public.ai_usage_log
  for select to authenticated
  using (
    public.is_app_admin(auth.uid())
    or public.is_platform_owner(auth.uid())
    or (club_id is not null and public.is_club_admin(club_id, auth.uid()))
  );

-- No client insert/update/delete policy → default deny for clients.

-- ── 2. Per-club AI master switch (opt-out; absence of a row = enabled) ──
create table if not exists public.club_ai_settings (
  club_id     uuid primary key,
  ai_enabled  boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.club_ai_settings enable row level security;

-- Any member of the club may read the flag (client gates AI UI on it).
drop policy if exists "members read club ai settings" on public.club_ai_settings;
create policy "members read club ai settings" on public.club_ai_settings
  for select to authenticated
  using (
    exists (
      select 1 from public.club_members cm
      where cm.club_id = club_ai_settings.club_id
        and cm.user_id = auth.uid()
    )
  );

-- Only club admins may flip it.
drop policy if exists "admins write club ai settings" on public.club_ai_settings;
create policy "admins write club ai settings" on public.club_ai_settings
  for all to authenticated
  using (public.is_club_admin(club_id, auth.uid()))
  with check (public.is_club_admin(club_id, auth.uid()));

drop trigger if exists trg_club_ai_settings_updated_at on public.club_ai_settings;
create trigger trg_club_ai_settings_updated_at
  before update on public.club_ai_settings
  for each row execute function public.set_updated_at();

-- ── 3. ai_gate(): edge-function entry check ────────────────
-- Resolves the caller's (single) club and its AI switch in one round-trip.
-- Returns { club_id, enabled }. Absence of a settings row ⇒ enabled = true.
create or replace function public.ai_gate()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  en  boolean;
begin
  if uid is null then
    return jsonb_build_object('club_id', null, 'enabled', false);
  end if;

  select cm.club_id into cid
    from public.club_members cm
   where cm.user_id = uid
   limit 1;

  if cid is null then
    -- Not in a club (e.g. platform-level tooling): don't block, no club to log.
    return jsonb_build_object('club_id', null, 'enabled', true);
  end if;

  select s.ai_enabled into en
    from public.club_ai_settings s
   where s.club_id = cid;

  return jsonb_build_object('club_id', cid, 'enabled', coalesce(en, true));
end;
$$;

revoke all on function public.ai_gate() from public;
grant execute on function public.ai_gate() to authenticated, service_role;

-- ── 4. ai_usage_summary(): aggregation for the in-app admin report ──
-- Scoped by the same admin rules as the table's RLS (checked in-function so a
-- club admin can't read another club's numbers). `_days` bounds the window.
create or replace function public.ai_usage_summary(_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  is_global boolean;
  my_club uuid;
  since timestamptz := now() - make_interval(days => greatest(coalesce(_days, 30), 1));
  result jsonb;
begin
  if uid is null then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  is_global := public.is_app_admin(uid) or public.is_platform_owner(uid);

  select cm.club_id into my_club
    from public.club_members cm
   where cm.user_id = uid
   limit 1;

  -- A non-global caller must be a club admin to see anything.
  if not is_global then
    if my_club is null or not public.is_club_admin(my_club, uid) then
      return jsonb_build_object('error', 'forbidden');
    end if;
  end if;

  with scoped as (
    select *
      from public.ai_usage_log l
     where l.created_at >= since
       and (is_global or l.club_id = my_club)
  )
  select jsonb_build_object(
    'since', since,
    'scope', case when is_global then 'global' else 'club' end,
    'totals', (
      select jsonb_build_object(
        'calls', count(*),
        'total_tokens', coalesce(sum(total_tokens), 0),
        'prompt_tokens', coalesce(sum(prompt_tokens), 0),
        'completion_tokens', coalesce(sum(completion_tokens), 0),
        'failures', coalesce(sum(case when not success then 1 else 0 end), 0)
      ) from scoped
    ),
    'by_function', coalesce((
      select jsonb_agg(row_to_json(f) order by f.calls desc)
        from (
          select function_name,
                 count(*)                       as calls,
                 coalesce(sum(total_tokens), 0) as total_tokens,
                 coalesce(sum(case when not success then 1 else 0 end), 0) as failures
            from scoped
           group by function_name
        ) f
    ), '[]'::jsonb),
    'by_model', coalesce((
      select jsonb_agg(row_to_json(m) order by m.calls desc)
        from (
          select model,
                 count(*)                       as calls,
                 coalesce(sum(total_tokens), 0) as total_tokens
            from scoped
           group by model
        ) m
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(row_to_json(d) order by d.day)
        from (
          select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
                 count(*)                       as calls,
                 coalesce(sum(total_tokens), 0) as total_tokens
            from scoped
           group by 1
        ) d
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.ai_usage_summary(integer) from public;
grant execute on function public.ai_usage_summary(integer) to authenticated;
