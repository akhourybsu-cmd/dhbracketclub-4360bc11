-- ─────────────────────────────────────────────────────────────
-- The Splendid Journey — engine completion pass
-- ─────────────────────────────────────────────────────────────

alter table public.journey_scenes
  add column if not exists is_routing_node boolean not null default false;

alter table public.journey_endings
  add column if not exists artwork text;

-- ── live scene projection now carries the routing flag ───────
create or replace function public.journey_live_scene(_campaign_id uuid, _scene_key text)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'scene_key', s.scene_key,
    'scene_type', s.scene_type,
    'title', s.title,
    'subtitle', s.subtitle,
    'location_key', s.location_key,
    'background_asset', s.background_asset,
    'ambient_audio', s.ambient_audio,
    'music_track', s.music_track,
    'entry_effects', s.entry_effects,
    'entry_conditions', s.entry_conditions,
    'auto_next_scene_key', s.auto_next_scene_key,
    'is_routing_node', s.is_routing_node,
    'is_terminal', s.is_terminal,
    'ending_key', s.ending_key,
    'chapter_key', c.chapter_key,
    'chapter_title', c.title,
    'blocks', (select coalesce(jsonb_agg(to_jsonb(b) - 'id' - 'campaign_id' - 'scene_id' order by b.display_order), '[]'::jsonb)
                 from public.journey_scene_blocks b where b.scene_id = s.id),
    'choices', (select coalesce(jsonb_agg(to_jsonb(ch) - 'id' - 'campaign_id' - 'scene_id' order by ch.display_order), '[]'::jsonb)
                 from public.journey_choices ch where ch.scene_id = s.id)
  )
  from public.journey_scenes s
  left join public.journey_chapters c on c.id = s.chapter_id
  where s.campaign_id = _campaign_id and s.scene_key = _scene_key
$function$;

-- ── scene entry: one authored scene at a time ────────────────
-- Only scenes explicitly flagged `is_routing_node` are chained through
-- without ever being displayed. Ordinary scenes stop here, are persisted,
-- rendered, and advanced by the player (journey_advance_scene).
create or replace function public.journey_enter_scene(_campaign_id uuid, _version integer, _scene_key text, _state jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  key text := _scene_key;
  st jsonb := coalesce(_state, '{}'::jsonb);
  sc jsonb;
  hops integer := 0;
  notices jsonb := '[]'::jsonb;
  chapter text;
  terminal boolean := false;
  ending text := null;
  fallback text;
  seen text[] := '{}';
begin
  while key is not null and hops < 25 loop
    hops := hops + 1;
    sc := public.journey_scene_content(_campaign_id, _version, key);
    if sc is null then raise exception 'Destination scene missing: %', key; end if;

    -- Entry conditions: unmet conditions divert to the authored fallback.
    if not public.journey_eval_requirements(sc -> 'entry_conditions', st) then
      fallback := sc -> 'entry_conditions' ->> 'fallback_scene_key';
      if fallback is null or fallback = any(seen) or fallback = key then
        raise exception 'This path is closed to you right now.';
      end if;
      seen := seen || key;
      key := fallback;
      continue;
    end if;

    st := public.journey_apply_effects(sc -> 'entry_effects', st);
    notices := notices || public.journey_effect_notices(sc -> 'entry_effects');
    chapter := coalesce(sc ->> 'chapter_key', chapter);

    if coalesce((sc ->> 'is_terminal')::boolean, false) then
      terminal := true;
      ending := public.journey_resolve_ending(_campaign_id, _version, st, sc ->> 'ending_key');
      exit;
    end if;

    -- Invisible routing nodes chain onward silently; every other scene is
    -- shown to the player before anything else happens.
    if coalesce((sc ->> 'is_routing_node')::boolean, false)
       and (sc ->> 'auto_next_scene_key') is not null then
      seen := seen || key;
      key := sc ->> 'auto_next_scene_key';
    else
      exit;
    end if;
  end loop;

  if hops >= 25 then raise exception 'Automatic scene transitions looped too many times'; end if;

  return jsonb_build_object(
    'state', st, 'scene_key', key, 'chapter_key', chapter,
    'terminal', terminal, 'ending_key', ending, 'notices', notices);
end $function$;

-- ── Continue: follow the authored automatic transition ───────
create or replace function public.journey_advance_scene(_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  run public.journey_campaign_runs;
  sc jsonb; res jsonb; nxt text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into run from public.journey_campaign_runs where id = _run_id for update;
  if run is null or run.user_id <> uid then raise exception 'Run not found'; end if;
  if run.status <> 'active' then raise exception 'This journey is no longer active'; end if;

  sc := public.journey_scene_content(run.campaign_id, run.campaign_version, run.current_scene_key);
  if sc is null then raise exception 'Scene not found'; end if;
  if coalesce((sc ->> 'is_terminal')::boolean, false) then
    raise exception 'This journey has already reached its end.';
  end if;
  nxt := sc ->> 'auto_next_scene_key';
  if nxt is null then raise exception 'There is nowhere to continue from here.'; end if;

  res := public.journey_enter_scene(run.campaign_id, run.campaign_version, nxt, coalesce(run.state, '{}'::jsonb));
  update public.journey_campaign_runs r set
    state = res -> 'state',
    current_scene_key = res ->> 'scene_key',
    current_chapter_key = coalesce(res ->> 'chapter_key', r.current_chapter_key),
    status = case when (res ->> 'terminal')::boolean then 'completed' else r.status end,
    ending_key = coalesce(res ->> 'ending_key', r.ending_key),
    completed_at = case when (res ->> 'terminal')::boolean then now() else r.completed_at end,
    last_played_at = now()
  where r.id = run.id returning * into run;

  return jsonb_build_object('run', to_jsonb(run), 'notices', coalesce(res -> 'notices', '[]'::jsonb));
end $function$;

-- ── world content: add items + factions for metadata resolution ──
create or replace function public.journey_world_content(_campaign_id uuid, _version integer)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare pkg jsonb;
begin
  pkg := public.journey_release_package(_campaign_id, _version);
  if pkg is not null then
    return jsonb_build_object(
      'codex', coalesce(pkg -> 'codex', '[]'::jsonb),
      'locations', coalesce(pkg -> 'locations', '[]'::jsonb),
      'npcs', coalesce(pkg -> 'npcs', '[]'::jsonb),
      'quests', coalesce(pkg -> 'quests', '[]'::jsonb),
      'items', coalesce(pkg -> 'items', '[]'::jsonb),
      'factions', coalesce(pkg -> 'factions', '[]'::jsonb));
  end if;
  return jsonb_build_object(
    'codex', (select coalesce(jsonb_agg(jsonb_build_object('codex_key',x.codex_key,'title',x.title,'category',x.category,'body',x.body,'image',x.image) order by x.display_order), '[]'::jsonb)
                from public.journey_codex_entries x where x.campaign_id = _campaign_id),
    'locations', (select coalesce(jsonb_agg(jsonb_build_object('location_key',x.location_key,'name',x.name,'region',x.region,'description',x.description,'image',x.image)), '[]'::jsonb)
                from public.journey_locations x where x.campaign_id = _campaign_id),
    'npcs', (select coalesce(jsonb_agg(jsonb_build_object('npc_key',x.npc_key,'name',x.name,'title',x.title,'description',x.description,'portrait',x.portrait,'codex_key',x.codex_key)), '[]'::jsonb)
                from public.journey_npcs x where x.campaign_id = _campaign_id),
    'quests', (select coalesce(jsonb_agg(jsonb_build_object('quest_key',x.quest_key,'title',x.title,'description',x.description,'quest_type',x.quest_type,'objectives',x.objectives)), '[]'::jsonb)
                from public.journey_quests x where x.campaign_id = _campaign_id),
    'items', (select coalesce(jsonb_agg(jsonb_build_object('item_key',x.item_key,'name',x.name,'description',x.description,'icon',x.icon,'image',x.image,'item_type',x.item_type,'rarity',x.rarity,'quest_item',x.quest_item)), '[]'::jsonb)
                from public.journey_items x where x.campaign_id = _campaign_id),
    'factions', (select coalesce(jsonb_agg(jsonb_build_object('faction_key',x.faction_key,'name',x.name,'description',x.description,'image',x.image)), '[]'::jsonb)
                from public.journey_factions x where x.campaign_id = _campaign_id));
end $function$;

-- ── publish snapshot: carry factions + ending artwork ────────
create or replace function public.journey_publish_campaign(_campaign_id uuid, _notes text default null)
returns journey_campaigns
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    'factions', (select coalesce(jsonb_agg(jsonb_build_object('faction_key',x.faction_key,'name',x.name,'description',x.description,'image',x.image)), '[]'::jsonb)
                 from public.journey_factions x where x.campaign_id = _campaign_id),
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
end $function$;

-- ── ending experience ───────────────────────────────────────
create or replace function public.journey_get_ending(_run_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  run public.journey_campaign_runs;
  camp public.journey_campaigns;
  ends jsonb;
  e jsonb;
  chosen jsonb := null;
  blk jsonb;
  epilogue jsonb := '[]'::jsonb;
  recap jsonb := '[]'::jsonb;
  h record;
  sc jsonb;
  ch jsonb;
  st jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into run from public.journey_campaign_runs where id = _run_id;
  if run is null or run.user_id <> uid then raise exception 'Run not found'; end if;
  select * into camp from public.journey_campaigns where id = run.campaign_id;

  st := coalesce(run.state, '{}'::jsonb);
  ends := public.journey_endings_content(run.campaign_id, run.campaign_version);

  if run.ending_key is not null then
    for e in select * from jsonb_array_elements(ends) loop
      if e ->> 'ending_key' = run.ending_key then chosen := e; exit; end if;
    end loop;
  end if;

  if chosen is not null then
    for blk in select * from jsonb_array_elements(coalesce(chosen -> 'epilogue_blocks', '[]'::jsonb)) loop
      if public.journey_eval_requirements(blk -> 'requirements', st) then
        epilogue := epilogue || (blk - 'requirements');
      end if;
    end loop;
  end if;

  -- Spoiler-safe recap: only decisions this player actually made, with the
  -- text they saw. Nothing about paths not taken.
  for h in
    select scene_key, choice_key, choice_text_snapshot, created_at
      from public.journey_run_choice_history
     where run_id = run.id
     order by created_at asc
     limit 300
  loop
    sc := public.journey_scene_content(run.campaign_id, run.campaign_version, h.scene_key);
    ch := null;
    if sc is not null then
      select x into ch from jsonb_array_elements(coalesce(sc -> 'choices', '[]'::jsonb)) x
       where x ->> 'choice_key' = h.choice_key limit 1;
    end if;
    recap := recap || jsonb_build_object(
      'scene_title', coalesce(sc ->> 'title', sc ->> 'chapter_title'),
      'chapter_title', sc ->> 'chapter_title',
      'choice_text', coalesce(h.choice_text_snapshot, ch ->> 'choice_text'),
      'major_decision', coalesce((ch ->> 'major_decision')::boolean, false),
      'at', h.created_at);
  end loop;

  return jsonb_build_object(
    'campaign', jsonb_build_object('title', camp.title, 'subtitle', camp.subtitle),
    'ending', case when chosen is null then null else jsonb_build_object(
        'ending_key', chosen ->> 'ending_key',
        'name', chosen ->> 'name',
        'description', chosen ->> 'description',
        'artwork', chosen ->> 'artwork',
        'spoiler_safe_label', chosen ->> 'spoiler_safe_label') end,
    'epilogue_blocks', epilogue,
    'recap', recap,
    'completed_at', run.completed_at,
    'status', run.status);
end $function$;

revoke all on function public.journey_get_ending(uuid) from anon;
grant execute on function public.journey_get_ending(uuid) to authenticated;

-- ── validation: routing nodes + per-scene choice keys ────────
create or replace function public.journey_validate_campaign(_campaign_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
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

  -- Choice keys must be unique inside a scene (the runtime resolves a choice
  -- by scene + key).
  for r in
    select s.scene_key, c.choice_key
      from public.journey_choices c
      join public.journey_scenes s on s.id = c.scene_id
     where c.campaign_id = _campaign_id
     group by s.scene_key, c.choice_key
    having count(*) > 1
  loop
    problems := problems || format('Scene "%s" has duplicate choice key "%s"', r.scene_key, r.choice_key);
  end loop;

  -- Routing nodes are never rendered, so they must lead somewhere and must
  -- not be terminal.
  for r in
    select s.scene_key, s.is_terminal, s.auto_next_scene_key
      from public.journey_scenes s
     where s.campaign_id = _campaign_id and s.is_routing_node
  loop
    if r.auto_next_scene_key is null then
      problems := problems || format('Routing node "%s" has no auto_next_scene_key', r.scene_key);
    end if;
    if r.is_terminal then
      problems := problems || format('Routing node "%s" cannot be terminal (it is never shown)', r.scene_key);
    end if;
  end loop;

  return jsonb_build_object('ok', coalesce(array_length(problems, 1), 0) = 0,
                            'problems', to_jsonb(problems));
end $function$;

-- ── importer: accept is_routing_node + ending artwork ────────
create or replace function public.journey_import_campaign(_package jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  camp jsonb := _package -> 'campaign';
  cid uuid;
  rec jsonb;
  blk jsonb;
  sid uuid;
  counts jsonb := '{}'::jsonb;
begin
  if uid is null or not public.journey_is_author(uid) then raise exception 'Not permitted'; end if;
  if camp is null or (camp ->> 'slug') is null then raise exception 'Package must include campaign.slug'; end if;

  insert into public.journey_campaigns (slug, title, subtitle, description, cover_image, hero_image, status,
      version, author, estimated_length, minimum_level, recommended_level, starting_scene_key, content_notes,
      config, tags, author_notes, created_by)
  values (camp ->> 'slug', coalesce(camp ->> 'title','Untitled'), camp ->> 'subtitle', camp ->> 'description',
      camp ->> 'cover_image', camp ->> 'hero_image', coalesce(camp ->> 'status','draft'),
      coalesce((camp ->> 'version')::int, 1), camp ->> 'author', camp ->> 'estimated_length',
      coalesce((camp ->> 'minimum_level')::int, 1), coalesce((camp ->> 'recommended_level')::int, 1),
      camp ->> 'starting_scene_key', camp ->> 'content_notes',
      coalesce(camp -> 'config', '{}'::jsonb),
      coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(camp -> 'tags','[]'::jsonb))), '{}'),
      camp ->> 'author_notes', uid)
  on conflict (slug) do update set
      title = excluded.title, subtitle = excluded.subtitle, description = excluded.description,
      cover_image = excluded.cover_image, hero_image = excluded.hero_image, status = excluded.status,
      version = excluded.version, author = excluded.author, estimated_length = excluded.estimated_length,
      minimum_level = excluded.minimum_level, recommended_level = excluded.recommended_level,
      starting_scene_key = excluded.starting_scene_key, content_notes = excluded.content_notes,
      config = excluded.config, tags = excluded.tags, author_notes = excluded.author_notes,
      updated_at = now()
  returning id into cid;

  -- Replace authored content wholesale for this campaign (runs are untouched).
  delete from public.journey_scene_blocks where campaign_id = cid;
  delete from public.journey_choices where campaign_id = cid;
  delete from public.journey_scenes where campaign_id = cid;
  delete from public.journey_chapters where campaign_id = cid;
  delete from public.journey_acts where campaign_id = cid;
  delete from public.journey_npcs where campaign_id = cid;
  delete from public.journey_items where campaign_id = cid;
  delete from public.journey_quests where campaign_id = cid;
  delete from public.journey_locations where campaign_id = cid;
  delete from public.journey_codex_entries where campaign_id = cid;
  delete from public.journey_campaign_variables where campaign_id = cid;
  delete from public.journey_factions where campaign_id = cid;
  delete from public.journey_endings where campaign_id = cid;
  delete from public.journey_enemies where campaign_id = cid;

  for rec in select * from jsonb_array_elements(coalesce(_package -> 'acts','[]'::jsonb)) loop
    insert into public.journey_acts (campaign_id, act_key, title, subtitle, display_order, author_notes)
    values (cid, rec ->> 'act_key', coalesce(rec ->> 'title','Act'), rec ->> 'subtitle',
            coalesce((rec ->> 'display_order')::int, 0), rec ->> 'author_notes');
  end loop;

  for rec in select * from jsonb_array_elements(coalesce(_package -> 'chapters','[]'::jsonb)) loop
    insert into public.journey_chapters (campaign_id, act_id, chapter_key, title, subtitle, intro_text, artwork, display_order, author_notes)
    values (cid,
            (select id from public.journey_acts where campaign_id = cid and act_key = rec ->> 'act_key'),
            rec ->> 'chapter_key', coalesce(rec ->> 'title','Chapter'), rec ->> 'subtitle',
            rec ->> 'intro_text', rec ->> 'artwork', coalesce((rec ->> 'display_order')::int, 0), rec ->> 'author_notes');
  end loop;

  for rec in select * from jsonb_array_elements(coalesce(_package -> 'locations','[]'::jsonb)) loop
    insert into public.journey_locations (campaign_id, location_key, name, region, description, image, ambient_audio, map_position, codex_key, metadata, author_notes)
    values (cid, rec ->> 'location_key', coalesce(rec ->> 'name','Location'), rec ->> 'region', rec ->> 'description',
            rec ->> 'image', rec ->> 'ambient_audio', rec -> 'map_position', rec ->> 'codex_key',
            coalesce(rec -> 'metadata','{}'::jsonb), rec ->> 'author_notes');
  end loop;

  for rec in select * from jsonb_array_elements(coalesce(_package -> 'npcs','[]'::jsonb)) loop
    insert into public.journey_npcs (campaign_id, npc_key, name, title, description, portrait, faction_key, biography, codex_key, metadata, author_notes)
    values (cid, rec ->> 'npc_key', coalesce(rec ->> 'name','NPC'), rec ->> 'title', rec ->> 'description',
            rec ->> 'portrait', rec ->> 'faction_key', rec ->> 'biography', rec ->> 'codex_key',
            coalesce(rec -> 'metadata','{}'::jsonb), rec ->> 'author_notes');
  end loop;

  for rec in select * from jsonb_array_elements(coalesce(_package -> 'items','[]'::jsonb)) loop
    insert into public.journey_items (campaign_id, item_key, name, description, icon, image, item_type, rarity, stackable, max_stack, usable, quest_item, metadata, author_notes)
    values (cid, rec ->> 'item_key', coalesce(rec ->> 'name','Item'), rec ->> 'description', rec ->> 'icon', rec ->> 'image',
            coalesce(rec ->> 'item_type','misc'), coalesce(rec ->> 'rarity','common'),
            coalesce((rec ->> 'stackable')::boolean, false), coalesce((rec ->> 'max_stack')::int, 1),
            coalesce((rec ->> 'usable')::boolean, false), coalesce((rec ->> 'quest_item')::boolean, false),
            coalesce(rec -> 'metadata','{}'::jsonb), rec ->> 'author_notes');
  end loop;

  for rec in select * from jsonb_array_elements(coalesce(_package -> 'quests','[]'::jsonb)) loop
    insert into public.journey_quests (campaign_id, quest_key, title, description, quest_type, objectives, rewards, hidden_until_discovered, author_notes)
    values (cid, rec ->> 'quest_key', coalesce(rec ->> 'title','Quest'), rec ->> 'description',
            coalesce(rec ->> 'quest_type','main'), coalesce(rec -> 'objectives','[]'::jsonb),
            coalesce(rec -> 'rewards','[]'::jsonb), coalesce((rec ->> 'hidden_until_discovered')::boolean, false),
            rec ->> 'author_notes');
  end loop;

  for rec in select * from jsonb_array_elements(coalesce(_package -> 'codex','[]'::jsonb)) loop
    insert into public.journey_codex_entries (campaign_id, codex_key, title, category, body, image, display_order, author_notes)
    values (cid, rec ->> 'codex_key', coalesce(rec ->> 'title','Entry'), coalesce(rec ->> 'category','lore'),
            rec ->> 'body', rec ->> 'image', coalesce((rec ->> 'display_order')::int, 0), rec ->> 'author_notes');
  end loop;

  for rec in select * from jsonb_array_elements(coalesce(_package -> 'variables','[]'::jsonb)) loop
    insert into public.journey_campaign_variables (campaign_id, variable_key, label, value_type, default_value, enum_values, author_notes)
    values (cid, rec ->> 'variable_key', rec ->> 'label', coalesce(rec ->> 'value_type','integer'), rec -> 'default_value',
            coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(rec -> 'enum_values','[]'::jsonb))), '{}'),
            rec ->> 'author_notes');
  end loop;

  for rec in select * from jsonb_array_elements(coalesce(_package -> 'factions','[]'::jsonb)) loop
    insert into public.journey_factions (campaign_id, faction_key, name, description, image, author_notes)
    values (cid, rec ->> 'faction_key', coalesce(rec ->> 'name','Faction'), rec ->> 'description', rec ->> 'image', rec ->> 'author_notes');
  end loop;

  for rec in select * from jsonb_array_elements(coalesce(_package -> 'enemies','[]'::jsonb)) loop
    insert into public.journey_enemies (campaign_id, enemy_key, name, description, portrait, max_health, armor, attack, abilities, metadata, author_notes)
    values (cid, rec ->> 'enemy_key', coalesce(rec ->> 'name','Enemy'), rec ->> 'description', rec ->> 'portrait',
            coalesce((rec ->> 'max_health')::int, 10), coalesce((rec ->> 'armor')::int, 0), coalesce((rec ->> 'attack')::int, 2),
            coalesce(rec -> 'abilities','[]'::jsonb), coalesce(rec -> 'metadata','{}'::jsonb), rec ->> 'author_notes');
  end loop;

  for rec in select * from jsonb_array_elements(coalesce(_package -> 'endings','[]'::jsonb)) loop
    insert into public.journey_endings (campaign_id, ending_key, name, description, priority, requirements, epilogue_blocks, spoiler_safe_label, artwork, author_notes)
    values (cid, rec ->> 'ending_key', coalesce(rec ->> 'name','Ending'), rec ->> 'description',
            coalesce((rec ->> 'priority')::int, 0), rec -> 'requirements', coalesce(rec -> 'epilogue_blocks','[]'::jsonb),
            rec ->> 'spoiler_safe_label', rec ->> 'artwork', rec ->> 'author_notes');
  end loop;

  -- scenes (+ nested blocks and choices)
  for rec in select * from jsonb_array_elements(coalesce(_package -> 'scenes','[]'::jsonb)) loop
    insert into public.journey_scenes (campaign_id, chapter_id, scene_key, scene_type, title, subtitle, location_key,
        background_asset, ambient_audio, music_track, entry_effects, entry_conditions, auto_next_scene_key,
        is_routing_node, is_terminal, ending_key, display_order, tags, author_notes)
    values (cid,
        (select id from public.journey_chapters where campaign_id = cid and chapter_key = rec ->> 'chapter_key'),
        rec ->> 'scene_key', coalesce(rec ->> 'scene_type','narrative'), rec ->> 'title', rec ->> 'subtitle',
        rec ->> 'location_key', rec ->> 'background_asset', rec ->> 'ambient_audio', rec ->> 'music_track',
        coalesce(rec -> 'entry_effects','[]'::jsonb), rec -> 'entry_conditions', rec ->> 'auto_next_scene_key',
        coalesce((rec ->> 'is_routing_node')::boolean, false),
        coalesce((rec ->> 'is_terminal')::boolean, false), rec ->> 'ending_key',
        coalesce((rec ->> 'display_order')::int, 0),
        coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(rec -> 'tags','[]'::jsonb))), '{}'),
        rec ->> 'author_notes')
    returning id into sid;

    for blk in select * from jsonb_array_elements(coalesce(rec -> 'blocks','[]'::jsonb)) loop
      insert into public.journey_scene_blocks (campaign_id, scene_id, block_type, display_order, content, metadata, conditions)
      values (cid, sid, coalesce(blk ->> 'block_type','narration'), coalesce((blk ->> 'display_order')::int, 0),
              blk ->> 'content', coalesce(blk -> 'metadata','{}'::jsonb), blk -> 'conditions');
    end loop;

    for blk in select * from jsonb_array_elements(coalesce(rec -> 'choices','[]'::jsonb)) loop
      insert into public.journey_choices (campaign_id, scene_id, choice_key, choice_text, short_label, description,
          display_order, next_scene_key, choice_style, confirmation_required, hidden_when_unavailable, locked_hint,
          major_decision, once_only, requirements, effects, tags, author_notes)
      values (cid, sid, blk ->> 'choice_key', coalesce(blk ->> 'choice_text','...'), blk ->> 'short_label', blk ->> 'description',
          coalesce((blk ->> 'display_order')::int, 0), blk ->> 'next_scene_key', coalesce(blk ->> 'choice_style','standard'),
          coalesce((blk ->> 'confirmation_required')::boolean, false),
          coalesce((blk ->> 'hidden_when_unavailable')::boolean, false), blk ->> 'locked_hint',
          coalesce((blk ->> 'major_decision')::boolean, false), coalesce((blk ->> 'once_only')::boolean, false),
          blk -> 'requirements', coalesce(blk -> 'effects','[]'::jsonb),
          coalesce((select array_agg(value::text) from jsonb_array_elements_text(coalesce(blk -> 'tags','[]'::jsonb))), '{}'),
          blk ->> 'author_notes');
    end loop;
  end loop;

  counts := jsonb_build_object(
    'campaign_id', cid,
    'scenes', (select count(*) from public.journey_scenes where campaign_id = cid),
    'blocks', (select count(*) from public.journey_scene_blocks where campaign_id = cid),
    'choices', (select count(*) from public.journey_choices where campaign_id = cid)
  );
  return counts;
end $function$;