-- The Splendid Journey — inline scene-block images.
--
-- Extends journey_set_asset with a 'scene_block_image' target so the Studio can
-- write an uploaded URL into a specific image BLOCK (matched by its stable
-- metadata.asset_key), not just a scene/ending/npc column. Used for the
-- sequential S15 images and the branch-conditional S13 images that live inside
-- a scene rather than as its backdrop.

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
  elsif _target = 'npc_portrait' then
    update public.journey_npcs
       set portrait = _url
     where campaign_id = _campaign_id and npc_key = _key;
  elsif _target = 'scene_block_image' then
    update public.journey_scene_blocks
       set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{src}', to_jsonb(_url), true)
     where campaign_id = _campaign_id and metadata ->> 'asset_key' = _key;
  elsif _target = 'cover_image' then
    update public.journey_campaigns set cover_image = _url where id = _campaign_id;
  elsif _target = 'hero_image' then
    update public.journey_campaigns set hero_image = _url where id = _campaign_id;
  else
    raise exception 'Unknown asset target: %', _target;
  end if;
end;
$$;
