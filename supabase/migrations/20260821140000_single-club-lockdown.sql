-- ============================================================
-- Single-club lockdown
--   The app is already one-club-per-user (club_members.user_id is UNIQUE).
--   This migration removes the ability to create MORE clubs and converts the
--   club_requests table from "request to create a club" into "request to JOIN
--   the one club", approved directly by an admin.
--
--   * blocks club creation at the DB level (RLS + grant)
--   * get_primary_club()      — branding of the single club for prospects
--   * request_club_access()   — a signed-in non-member asks to join
--   * approve_join_request()  — admin adds the requester to the club
--   * deny_join_request()     — admin rejects
-- ============================================================

-- ── 1. Hard-block new club creation ────────────────────────
drop policy if exists "owner_insert_clubs" on public.clubs;
revoke insert on public.clubs from authenticated;

-- ── 2. Expose the single club's branding to prospective members ──
-- Non-members can't read the clubs table under RLS, but they need the club's
-- name/logo on the request-access screen. This SECURITY DEFINER reader returns
-- only public-safe branding for the one club (earliest = the canonical club).
create or replace function public.get_primary_club()
returns table (id uuid, name text, accent_color text, logo_url text)
language sql
security definer
set search_path = public
as $$
  select id, name, accent_color, logo_url
    from public.clubs
   order by created_at asc
   limit 1;
$$;

revoke all on function public.get_primary_club() from public;
grant execute on function public.get_primary_club() to authenticated;

-- ── 3. request_club_access(): signed-in non-member requests to join ──
-- Reuses club_requests. proposed_name is repurposed to the requester's display
-- name (kept non-null for the existing admin UI). Mirrors upsert_club_request's
-- "update active/rejected else insert" behaviour so the one-active-request index
-- is respected.
create or replace function public.request_club_access(_note text)
returns public.club_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  dname text;
  existing public.club_requests;
  result public.club_requests;
begin
  if uid is null then raise exception 'Not authenticated'; end if;

  if exists (select 1 from public.club_members where user_id = uid) then
    raise exception 'You are already a member';
  end if;

  select coalesce(nullif(trim(display_name), ''), 'Member') into dname
    from public.profiles where id = uid;
  if dname is null then dname := 'Member'; end if;

  select * into existing from public.club_requests
   where requested_by = uid
     and status in ('pending','needs_info','rejected')
   order by (status = 'rejected') asc, created_at desc
   limit 1;

  if existing.id is not null then
    update public.club_requests
       set proposed_name = dname,
           user_note = nullif(trim(coalesce(_note,'')), ''),
           status = 'pending',
           review_notes = case when existing.status = 'rejected' then null else review_notes end,
           reviewed_by  = case when existing.status = 'rejected' then null else reviewed_by end,
           reviewed_at  = case when existing.status = 'rejected' then null else reviewed_at end
     where id = existing.id
     returning * into result;
  else
    insert into public.club_requests (requested_by, proposed_name, user_note, status)
    values (uid, dname, nullif(trim(coalesce(_note,'')), ''), 'pending')
    returning * into result;
  end if;

  return result;
end $$;

revoke all on function public.request_club_access(text) from public;
grant execute on function public.request_club_access(text) to authenticated;

-- ── 4. approve_join_request(): admin adds requester to the single club ──
create or replace function public.approve_join_request(_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  req_user uuid;
  target_club uuid;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not (public.is_platform_owner(uid) or public.is_app_admin(uid)) then
    raise exception 'Not authorized';
  end if;

  select requested_by into req_user from public.club_requests where id = _request_id;
  if req_user is null then raise exception 'Request not found'; end if;

  -- The single club: prefer the approver's club, else the earliest club.
  select club_id into target_club from public.club_members where user_id = uid limit 1;
  if target_club is null then
    select id into target_club from public.clubs order by created_at asc limit 1;
  end if;
  if target_club is null then raise exception 'No club exists to join'; end if;

  -- one-club-per-account is enforced by club_members.user_id UNIQUE
  insert into public.club_members (club_id, user_id, role)
  values (target_club, req_user, 'member')
  on conflict (user_id) do nothing;

  update public.club_requests
     set status = 'approved', reviewed_by = uid, reviewed_at = now()
   where id = _request_id;
end $$;

revoke all on function public.approve_join_request(uuid) from public;
grant execute on function public.approve_join_request(uuid) to authenticated;

-- ── 5. deny_join_request(): admin rejects with an optional note ──
create or replace function public.deny_join_request(_request_id uuid, _note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if not (public.is_platform_owner(uid) or public.is_app_admin(uid)) then
    raise exception 'Not authorized';
  end if;
  update public.club_requests
     set status = 'rejected', reviewed_by = uid, reviewed_at = now(),
         review_notes = nullif(trim(coalesce(_note,'')), '')
   where id = _request_id;
end $$;

revoke all on function public.deny_join_request(uuid, text) from public;
grant execute on function public.deny_join_request(uuid, text) to authenticated;
