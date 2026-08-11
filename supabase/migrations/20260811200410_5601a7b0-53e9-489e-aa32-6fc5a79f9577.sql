insert into public.club_installed_assets (club_id, asset_id, enabled, visible_to_members)
select '11111111-1111-1111-1111-111111111111', id, true, true from public.platform_assets where slug='workout-competition'
on conflict (club_id, asset_id) do update set enabled=true, visible_to_members=true;