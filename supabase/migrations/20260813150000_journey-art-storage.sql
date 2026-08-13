-- The Splendid Journey — campaign art storage.
--
-- Adds a public storage bucket for campaign illustration (scene backdrops,
-- ending artwork, cover/hero) and an author-gated RPC that writes an uploaded
-- image's public URL into the campaign DRAFT. Gameplay keeps reading from the
-- published release, so uploaded art reaches players on the next publish.

-- ── Public bucket ─────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('journey-art', 'journey-art', true)
on conflict (id) do nothing;

-- Anyone may read (published art must be visible to every player).
drop policy if exists "journey-art public read" on storage.objects;
create policy "journey-art public read"
  on storage.objects for select
  using (bucket_id = 'journey-art');

-- Only campaign authors may write / replace / remove art.
drop policy if exists "journey-art author insert" on storage.objects;
create policy "journey-art author insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'journey-art' and public.journey_is_author(auth.uid()));

drop policy if exists "journey-art author update" on storage.objects;
create policy "journey-art author update"
  on storage.objects for update to authenticated
  using (bucket_id = 'journey-art' and public.journey_is_author(auth.uid()));

drop policy if exists "journey-art author delete" on storage.objects;
create policy "journey-art author delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'journey-art' and public.journey_is_author(auth.uid()));

-- ── Write an uploaded URL into the draft (author only) ─────────────────────
-- _url may be null to clear a slot. Targets map to the draft columns that the
-- exporter/publisher already carry into the release package.
create or replace function public.journey_set_asset(
  _campaign_id uuid, _target text, _key text, _url text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not public.journey_is_author(uid) then
    raise exception 'Not permitted';
  end if;

  if _target = 'scene_background' then
    update public.journey_scenes
       set background_asset = _url
     where campaign_id = _campaign_id and scene_key = _key;
  elsif _target = 'ending_artwork' then
    update public.journey_endings
       set artwork = _url
     where campaign_id = _campaign_id and ending_key = _key;
  elsif _target = 'cover_image' then
    update public.journey_campaigns set cover_image = _url where id = _campaign_id;
  elsif _target = 'hero_image' then
    update public.journey_campaigns set hero_image = _url where id = _campaign_id;
  else
    raise exception 'Unknown asset target: %', _target;
  end if;
end;
$$;

revoke all on function public.journey_set_asset(uuid, text, text, text) from public, anon;
grant execute on function public.journey_set_asset(uuid, text, text, text) to authenticated;
