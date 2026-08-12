create or replace function public.journey_validate_campaign(_campaign_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare problems text[] := '{}'; camp public.journey_campaigns; r record;
begin
  if auth.uid() is null or not public.journey_is_author(auth.uid()) then
    raise exception 'Not permitted';
  end if;
  select * into camp from public.journey_campaigns where id = _campaign_id;
  if camp is null then raise exception 'Campaign not found'; end if;

  if coalesce(camp.starting_scene_key, '') = ''
     or not exists (select 1 from public.journey_scenes s
                     where s.campaign_id = _campaign_id and s.scene_key = camp.starting_scene_key) then
    problems := problems || 'Starting scene is missing or does not exist';
  end if;

  for r in
    select ch.choice_key, ch.next_scene_key
      from public.journey_choices ch
     where ch.campaign_id = _campaign_id
       and ch.next_scene_key is not null
       and not exists (select 1 from public.journey_scenes s
                        where s.campaign_id = _campaign_id and s.scene_key = ch.next_scene_key)
  loop
    problems := problems || format('Choice "%s" leads to missing scene "%s"', r.choice_key, r.next_scene_key);
  end loop;

  for r in
    select s.scene_key, s.auto_next_scene_key
      from public.journey_scenes s
     where s.campaign_id = _campaign_id
       and s.auto_next_scene_key is not null
       and not exists (select 1 from public.journey_scenes x
                        where x.campaign_id = _campaign_id and x.scene_key = s.auto_next_scene_key)
  loop
    problems := problems || format('Scene "%s" auto-advances to missing scene "%s"', r.scene_key, r.auto_next_scene_key);
  end loop;

  for r in
    select s.scene_key, s.entry_conditions ->> 'fallback_scene_key' as fb
      from public.journey_scenes s
     where s.campaign_id = _campaign_id
       and (s.entry_conditions ->> 'fallback_scene_key') is not null
  loop
    if not exists (select 1 from public.journey_scenes x
                    where x.campaign_id = _campaign_id and x.scene_key = r.fb) then
      problems := problems || format('Scene "%s" falls back to missing scene "%s"', r.scene_key, r.fb);
    end if;
  end loop;

  for r in
    select s.scene_key from public.journey_scenes s
     where s.campaign_id = _campaign_id
       and not s.is_terminal
       and s.auto_next_scene_key is null
       and not exists (select 1 from public.journey_choices c where c.scene_id = s.id)
  loop
    problems := problems || format('Scene "%s" is a dead end (no choices, no automatic transition, not terminal)', r.scene_key);
  end loop;

  return jsonb_build_object('ok', coalesce(array_length(problems, 1), 0) = 0,
                            'problems', to_jsonb(problems));
end $$;

revoke execute on function public.journey_validate_campaign(uuid) from anon, public;
grant execute on function public.journey_validate_campaign(uuid) to authenticated;

revoke execute on function public.journey_import_campaign(jsonb) from anon, public;
revoke execute on function public.journey_start_run(uuid, uuid, boolean) from anon, public;
revoke execute on function public.journey_test_patch_run(uuid, text, jsonb) from anon, public;
revoke execute on function public.journey_eval_requirements(jsonb, jsonb) from anon, public;
revoke execute on function public.journey_apply_effects(jsonb, jsonb) from anon, public;
revoke execute on function public.journey_default_state(public.journey_characters) from anon, public;
revoke execute on function public.journey_effect_notices(jsonb) from anon, public;
grant execute on function public.journey_import_campaign(jsonb) to authenticated;
grant execute on function public.journey_start_run(uuid, uuid, boolean) to authenticated;
grant execute on function public.journey_test_patch_run(uuid, text, jsonb) to authenticated;

-- Publishing now refuses a structurally broken campaign.
create or replace function public.journey_publish_campaign(_campaign_id uuid, _notes text default null)
returns public.journey_campaigns
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  camp public.journey_campaigns;
  nextv integer;
  pkg jsonb;
  check_result jsonb;
begin
  if uid is null or not public.journey_is_author(uid) then raise exception 'Not permitted'; end if;
  select * into camp from public.journey_campaigns where id = _campaign_id;
  if camp is null then raise exception 'Campaign not found'; end if;

  check_result := public.journey_validate_campaign(_campaign_id);
  if not (check_result ->> 'ok')::boolean then
    raise exception 'Campaign cannot be published: %',
      (select string_agg(value, '; ') from jsonb_array_elements_text(check_result -> 'problems') value);
  end if;

  select coalesce(max(version), 0) + 1 into nextv
    from public.journey_campaign_releases where campaign_id = _campaign_id;
  nextv := greatest(nextv, camp.version);

  pkg := jsonb_build_object(
    'campaign', to_jsonb(camp) - 'id' - 'created_by' - 'created_at' - 'updated_at',
    'scenes', (select coalesce(jsonb_agg(public.journey_live_scene(_campaign_id, s.scene_key) order by s.display_order), '[]'::jsonb)
                 from public.journey_scenes s where s.campaign_id = _campaign_id),
    'endings', (select coalesce(jsonb_agg(to_jsonb(e) - 'id' - 'campaign_id' order by e.priority desc), '[]'::jsonb)
                 from public.journey_endings e where e.campaign_id = _campaign_id),
    'enemies', (select coalesce(jsonb_agg(to_jsonb(e) - 'id' - 'campaign_id'), '[]'::jsonb)
                 from public.journey_enemies e where e.campaign_id = _campaign_id),
    'items', (select coalesce(jsonb_agg(to_jsonb(e) - 'id' - 'campaign_id'), '[]'::jsonb)
                 from public.journey_items e where e.campaign_id = _campaign_id),
    'codex', (select coalesce(jsonb_agg(jsonb_build_object('codex_key',x.codex_key,'title',x.title,'category',x.category,'body',x.body,'image',x.image) order by x.display_order), '[]'::jsonb)
                 from public.journey_codex_entries x where x.campaign_id = _campaign_id),
    'locations', (select coalesce(jsonb_agg(jsonb_build_object('location_key',x.location_key,'name',x.name,'region',x.region,'description',x.description,'image',x.image)), '[]'::jsonb)
                 from public.journey_locations x where x.campaign_id = _campaign_id),
    'npcs', (select coalesce(jsonb_agg(jsonb_build_object('npc_key',x.npc_key,'name',x.name,'title',x.title,'description',x.description,'portrait',x.portrait,'codex_key',x.codex_key)), '[]'::jsonb)
                 from public.journey_npcs x where x.campaign_id = _campaign_id),
    'quests', (select coalesce(jsonb_agg(jsonb_build_object('quest_key',x.quest_key,'title',x.title,'description',x.description,'quest_type',x.quest_type,'objectives',x.objectives)), '[]'::jsonb)
                 from public.journey_quests x where x.campaign_id = _campaign_id)
  );

  insert into public.journey_campaign_releases (campaign_id, version, package, notes, created_by)
  values (_campaign_id, nextv, pkg, _notes, uid)
  on conflict (campaign_id, version) do update set package = excluded.package, notes = excluded.notes;

  update public.journey_campaigns set status = 'published', version = nextv, published_at = now()
   where id = _campaign_id returning * into camp;
  return camp;
end $$;

revoke execute on function public.journey_publish_campaign(uuid, text) from anon, public;
grant execute on function public.journey_publish_campaign(uuid, text) to authenticated;