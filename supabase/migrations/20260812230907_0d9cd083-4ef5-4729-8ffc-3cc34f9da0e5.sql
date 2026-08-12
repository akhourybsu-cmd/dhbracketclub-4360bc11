-- ============================================================
-- THE SPLENDID JOURNEY — Phase 1: trustworthy progression
-- ============================================================

-- ---------- immutable campaign releases ----------
create table if not exists public.journey_campaign_releases (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  version integer not null,
  package jsonb not null,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (campaign_id, version)
);

grant select, insert on public.journey_campaign_releases to authenticated;
grant all on public.journey_campaign_releases to service_role;
alter table public.journey_campaign_releases enable row level security;

drop policy if exists journey_releases_author on public.journey_campaign_releases;
create policy journey_releases_author on public.journey_campaign_releases
  for all to authenticated
  using (public.journey_is_author(auth.uid()))
  with check (public.journey_is_author(auth.uid()));

-- ============================================================
-- CONTENT RESOLUTION (release snapshot, falling back to live rows)
-- ============================================================

create or replace function public.journey_live_scene(_campaign_id uuid, _scene_key text)
returns jsonb language sql stable security definer set search_path = public as $$
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
$$;

create or replace function public.journey_release_package(_campaign_id uuid, _version integer)
returns jsonb language sql stable security definer set search_path = public as $$
  select package from public.journey_campaign_releases
   where campaign_id = _campaign_id and version = _version
$$;

create or replace function public.journey_scene_content(_campaign_id uuid, _version integer, _scene_key text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pkg jsonb; sc jsonb;
begin
  if _scene_key is null then return null; end if;
  pkg := public.journey_release_package(_campaign_id, _version);
  if pkg is null then
    return public.journey_live_scene(_campaign_id, _scene_key);
  end if;
  select e into sc from jsonb_array_elements(coalesce(pkg -> 'scenes', '[]'::jsonb)) e
   where e ->> 'scene_key' = _scene_key limit 1;
  return sc;
end $$;

create or replace function public.journey_endings_content(_campaign_id uuid, _version integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pkg jsonb;
begin
  pkg := public.journey_release_package(_campaign_id, _version);
  if pkg is not null then return coalesce(pkg -> 'endings', '[]'::jsonb); end if;
  return (select coalesce(jsonb_agg(to_jsonb(e) - 'id' - 'campaign_id' order by e.priority desc), '[]'::jsonb)
            from public.journey_endings e where e.campaign_id = _campaign_id);
end $$;

create or replace function public.journey_world_content(_campaign_id uuid, _version integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare pkg jsonb;
begin
  pkg := public.journey_release_package(_campaign_id, _version);
  if pkg is not null then
    return jsonb_build_object(
      'codex', coalesce(pkg -> 'codex', '[]'::jsonb),
      'locations', coalesce(pkg -> 'locations', '[]'::jsonb),
      'npcs', coalesce(pkg -> 'npcs', '[]'::jsonb),
      'quests', coalesce(pkg -> 'quests', '[]'::jsonb));
  end if;
  return jsonb_build_object(
    'codex', (select coalesce(jsonb_agg(jsonb_build_object('codex_key',x.codex_key,'title',x.title,'category',x.category,'body',x.body,'image',x.image) order by x.display_order), '[]'::jsonb)
                from public.journey_codex_entries x where x.campaign_id = _campaign_id),
    'locations', (select coalesce(jsonb_agg(jsonb_build_object('location_key',x.location_key,'name',x.name,'region',x.region,'description',x.description,'image',x.image)), '[]'::jsonb)
                from public.journey_locations x where x.campaign_id = _campaign_id),
    'npcs', (select coalesce(jsonb_agg(jsonb_build_object('npc_key',x.npc_key,'name',x.name,'title',x.title,'description',x.description,'portrait',x.portrait,'codex_key',x.codex_key)), '[]'::jsonb)
                from public.journey_npcs x where x.campaign_id = _campaign_id),
    'quests', (select coalesce(jsonb_agg(jsonb_build_object('quest_key',x.quest_key,'title',x.title,'description',x.description,'quest_type',x.quest_type,'objectives',x.objectives)), '[]'::jsonb)
                from public.journey_quests x where x.campaign_id = _campaign_id));
end $$;

-- ---------- publish: snapshot everything, bump version ----------
create or replace function public.journey_publish_campaign(_campaign_id uuid, _notes text default null)
returns public.journey_campaigns
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  camp public.journey_campaigns;
  nextv integer;
  pkg jsonb;
begin
  if uid is null or not public.journey_is_author(uid) then raise exception 'Not permitted'; end if;
  select * into camp from public.journey_campaigns where id = _campaign_id;
  if camp is null then raise exception 'Campaign not found'; end if;

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

-- ============================================================
-- NOTICES + ENDING RESOLUTION + SCENE ENTRY
-- ============================================================

create or replace function public.journey_effect_notices(_effects jsonb)
returns jsonb language plpgsql immutable as $$
declare e jsonb; out_arr jsonb := '[]'::jsonb; k text; amt numeric; t text;
begin
  if _effects is null or jsonb_typeof(_effects) <> 'array' then return out_arr; end if;
  for e in select * from jsonb_array_elements(_effects) loop
    t := coalesce(e ->> 'type', e ->> 'op');
    k := coalesce(e ->> 'key', '');
    amt := coalesce((e ->> 'value')::numeric, coalesce((e ->> 'amount')::numeric, 1));
    out_arr := out_arr || to_jsonb(
      case t
        when 'add_item' then 'Acquired: ' || k
        when 'remove_item' then 'Lost: ' || k
        when 'add_gold' then 'Gained ' || amt::text || ' coin'
        when 'remove_gold' then 'Spent ' || amt::text || ' coin'
        when 'damage_player' then 'You take ' || amt::text || ' damage'
        when 'heal_player' then 'You recover ' || amt::text || ' health'
        when 'add_xp' then amt::text || ' experience'
        when 'start_quest' then 'New quest: ' || k
        when 'complete_quest' then 'Quest complete: ' || k
        when 'fail_quest' then 'Quest failed: ' || k
        when 'unlock_codex' then 'Codex updated'
        when 'unlock_location' then 'New location discovered'
        when 'unlock_trait' then 'New trait: ' || k
        when 'unlock_ability' then 'New ability: ' || k
        else null
      end)
     where true;
  end loop;
  return (select coalesce(jsonb_agg(v), '[]'::jsonb) from jsonb_array_elements(out_arr) v where jsonb_typeof(v) = 'string');
end $$;

create or replace function public.journey_resolve_ending(_campaign_id uuid, _version integer, _state jsonb, _fallback text)
returns text language plpgsql stable security definer set search_path = public as $$
declare e jsonb; best text := null; best_pri numeric := null; pri numeric;
begin
  for e in select * from jsonb_array_elements(public.journey_endings_content(_campaign_id, _version)) loop
    if public.journey_eval_requirements(e -> 'requirements', _state) then
      pri := coalesce((e ->> 'priority')::numeric, 0);
      if best_pri is null or pri > best_pri then
        best_pri := pri; best := e ->> 'ending_key';
      end if;
    end if;
  end loop;
  return coalesce(best, _fallback);
end $$;

-- Enter a scene, following automatic transitions and enforcing entry rules.
-- Returns { state, scene_key, chapter_key, terminal, ending_key, notices }
create or replace function public.journey_enter_scene(
  _campaign_id uuid, _version integer, _scene_key text, _state jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
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
begin
  while key is not null and hops < 25 loop
    hops := hops + 1;
    sc := public.journey_scene_content(_campaign_id, _version, key);
    if sc is null then raise exception 'Destination scene missing: %', key; end if;

    if not public.journey_eval_requirements(sc -> 'entry_conditions', st) then
      fallback := sc -> 'entry_conditions' ->> 'fallback_scene_key';
      if fallback is null or fallback = key then
        raise exception 'This path is closed to you right now.';
      end if;
      key := fallback;
      continue;
    end if;

    st := public.journey_apply_effects(sc -> 'entry_effects', st);
    notices := notices || public.journey_effect_notices(sc -> 'entry_effects');
    chapter := sc ->> 'chapter_key';

    if coalesce((sc ->> 'is_terminal')::boolean, false) then
      terminal := true;
      ending := public.journey_resolve_ending(_campaign_id, _version, st, sc ->> 'ending_key');
      exit;
    end if;

    if (sc ->> 'auto_next_scene_key') is not null then
      key := sc ->> 'auto_next_scene_key';
    else
      exit;
    end if;
  end loop;

  if hops >= 25 then raise exception 'Automatic scene transitions looped too many times'; end if;

  return jsonb_build_object(
    'state', st, 'scene_key', key, 'chapter_key', chapter,
    'terminal', terminal, 'ending_key', ending, 'notices', notices);
end $$;

-- ============================================================
-- RUN LIFECYCLE (rewritten on top of journey_enter_scene)
-- ============================================================

create or replace function public.journey_start_run(_campaign_id uuid, _character_id uuid, _is_test boolean default false)
returns public.journey_campaign_runs
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  camp public.journey_campaigns;
  ch public.journey_characters;
  run public.journey_campaign_runs;
  n integer;
  start_scene text;
  st jsonb;
  res jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into camp from public.journey_campaigns where id = _campaign_id;
  if camp is null then raise exception 'Campaign not found'; end if;
  if camp.status <> 'published' and not public.journey_is_author(uid) then
    raise exception 'Campaign is not available';
  end if;
  select * into ch from public.journey_characters where id = _character_id and user_id = uid;
  if ch is null then raise exception 'Hero not found'; end if;

  select coalesce(max(run_number), 0) + 1 into n
    from public.journey_campaign_runs where user_id = uid and campaign_id = _campaign_id;

  start_scene := coalesce(camp.starting_scene_key,
    (select scene_key from public.journey_scenes where campaign_id = camp.id order by display_order limit 1));
  if start_scene is null then raise exception 'Campaign has no starting scene'; end if;

  st := public.journey_default_state(ch);
  res := public.journey_enter_scene(camp.id, camp.version, start_scene, st);

  insert into public.journey_campaign_runs
    (user_id, campaign_id, campaign_version, character_id, current_scene_key, current_chapter_key,
     is_test_run, state, run_number, status, ending_key, completed_at)
  values (uid, camp.id, camp.version, ch.id, res ->> 'scene_key', res ->> 'chapter_key',
     _is_test, res -> 'state', n,
     case when (res ->> 'terminal')::boolean then 'completed' else 'active' end,
     res ->> 'ending_key',
     case when (res ->> 'terminal')::boolean then now() else null end)
  returning * into run;
  return run;
end $$;

-- Choice execution now returns { run, notices }
drop function if exists public.journey_execute_choice(uuid, text, text);
create or replace function public.journey_execute_choice(_run_id uuid, _scene_key text, _choice_key text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  run public.journey_campaign_runs;
  sc jsonb;
  ch jsonb;
  st jsonb;
  made jsonb;
  res jsonb;
  notices jsonb := '[]'::jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into run from public.journey_campaign_runs where id = _run_id for update;
  if run is null or run.user_id <> uid then raise exception 'Run not found'; end if;
  if run.status <> 'active' then raise exception 'This journey is no longer active'; end if;
  if run.current_scene_key is distinct from _scene_key then raise exception 'Scene out of sync'; end if;

  sc := public.journey_scene_content(run.campaign_id, run.campaign_version, _scene_key);
  if sc is null then raise exception 'Scene not found'; end if;
  select e into ch from jsonb_array_elements(coalesce(sc -> 'choices', '[]'::jsonb)) e
   where e ->> 'choice_key' = _choice_key limit 1;
  if ch is null then raise exception 'Choice not available in this scene'; end if;

  st := coalesce(run.state, '{}'::jsonb);
  if not public.journey_eval_requirements(ch -> 'requirements', st) then
    raise exception 'Requirements not met';
  end if;
  if coalesce((ch ->> 'once_only')::boolean, false)
     and (coalesce(st -> 'choices_made', '[]'::jsonb) @> to_jsonb(array[_choice_key])) then
    raise exception 'Choice already taken';
  end if;

  st := public.journey_apply_effects(ch -> 'effects', st);
  notices := public.journey_effect_notices(ch -> 'effects');
  made := coalesce(st -> 'choices_made', '[]'::jsonb);
  if not (made @> to_jsonb(_choice_key)) then
    st := jsonb_set(st, array['choices_made'], made || to_jsonb(_choice_key), true);
  end if;

  insert into public.journey_run_choice_history (run_id, user_id, scene_key, choice_key, choice_text_snapshot, campaign_version)
  values (run.id, uid, _scene_key, _choice_key, ch ->> 'choice_text', run.campaign_version);

  if (ch ->> 'next_scene_key') is not null then
    res := public.journey_enter_scene(run.campaign_id, run.campaign_version, ch ->> 'next_scene_key', st);
    notices := notices || coalesce(res -> 'notices', '[]'::jsonb);
    update public.journey_campaign_runs r set
      state = res -> 'state',
      current_scene_key = res ->> 'scene_key',
      current_chapter_key = coalesce(res ->> 'chapter_key', r.current_chapter_key),
      status = case when (res ->> 'terminal')::boolean then 'completed' else r.status end,
      ending_key = coalesce(res ->> 'ending_key', r.ending_key),
      completed_at = case when (res ->> 'terminal')::boolean then now() else r.completed_at end,
      last_played_at = now()
    where r.id = run.id returning * into run;
  else
    update public.journey_campaign_runs r set state = st, last_played_at = now()
     where r.id = run.id returning * into run;
  end if;

  return jsonb_build_object('run', to_jsonb(run), 'notices', notices);
end $$;

-- Explicit continue / automatic transition
create or replace function public.journey_advance_scene(_run_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
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
end $$;

-- ============================================================
-- SPOILER-SAFE RUNTIME READS
-- ============================================================

create or replace function public.journey_get_runtime_scene(_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  run public.journey_campaign_runs;
  camp public.journey_campaigns;
  sc jsonb; c jsonb; st jsonb;
  choices jsonb := '[]'::jsonb;
  blocks jsonb := '[]'::jsonb;
  b jsonb;
  avail boolean; taken boolean;
  loc_name text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into run from public.journey_campaign_runs where id = _run_id;
  if run is null or run.user_id <> uid then raise exception 'Run not found'; end if;
  select * into camp from public.journey_campaigns where id = run.campaign_id;

  st := coalesce(run.state, '{}'::jsonb);
  sc := public.journey_scene_content(run.campaign_id, run.campaign_version, run.current_scene_key);

  if sc is not null then
    for b in select * from jsonb_array_elements(coalesce(sc -> 'blocks', '[]'::jsonb)) loop
      if public.journey_eval_requirements(b -> 'conditions', st) then
        blocks := blocks || (b - 'conditions');
      end if;
    end loop;

    for c in select * from jsonb_array_elements(coalesce(sc -> 'choices', '[]'::jsonb)) loop
      avail := public.journey_eval_requirements(c -> 'requirements', st);
      taken := coalesce((c ->> 'once_only')::boolean, false)
               and (coalesce(st -> 'choices_made', '[]'::jsonb) @> to_jsonb(array[c ->> 'choice_key']));
      if (avail and not taken) or not coalesce((c ->> 'hidden_when_unavailable')::boolean, false) then
        choices := choices || jsonb_build_object(
          'choice_key', c ->> 'choice_key',
          'choice_text', c ->> 'choice_text',
          'short_label', c ->> 'short_label',
          'description', c ->> 'description',
          'choice_style', coalesce(c ->> 'choice_style', 'standard'),
          'confirmation_required', coalesce((c ->> 'confirmation_required')::boolean, false),
          'major_decision', coalesce((c ->> 'major_decision')::boolean, false),
          'available', (avail and not taken),
          'locked_hint', case when (avail and not taken) then null
                              else coalesce(nullif(c ->> 'locked_hint',''), 'Unavailable') end);
      end if;
    end loop;

    select name into loc_name from public.journey_locations
     where campaign_id = run.campaign_id and location_key = (sc ->> 'location_key');
  end if;

  return jsonb_build_object(
    'run', to_jsonb(run),
    'campaign', jsonb_build_object('id', camp.id, 'title', camp.title, 'subtitle', camp.subtitle,
                                   'slug', camp.slug, 'cover_image', camp.cover_image),
    'scene', case when sc is null then null else jsonb_build_object(
        'scene_key', sc ->> 'scene_key',
        'scene_type', sc ->> 'scene_type',
        'title', sc ->> 'title',
        'subtitle', sc ->> 'subtitle',
        'background_asset', sc ->> 'background_asset',
        'is_terminal', coalesce((sc ->> 'is_terminal')::boolean, false),
        'has_auto_next', (sc ->> 'auto_next_scene_key') is not null) end,
    'chapter_title', sc ->> 'chapter_title',
    'location_name', loc_name,
    'blocks', blocks,
    'choices', choices);
end $$;

create or replace function public.journey_get_world(_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); run public.journey_campaign_runs;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into run from public.journey_campaign_runs where id = _run_id;
  if run is null or run.user_id <> uid then raise exception 'Run not found'; end if;
  return public.journey_world_content(run.campaign_id, run.campaign_version);
end $$;

create or replace function public.journey_list_campaigns()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'slug', c.slug, 'title', c.title, 'subtitle', c.subtitle,
    'description', c.description, 'cover_image', c.cover_image, 'hero_image', c.hero_image,
    'status', c.status, 'version', c.version, 'author', c.author,
    'estimated_length', c.estimated_length, 'minimum_level', c.minimum_level,
    'recommended_level', c.recommended_level, 'tags', c.tags,
    'content_notes', c.content_notes, 'created_at', c.created_at
  ) order by c.created_at desc), '[]'::jsonb)
  from public.journey_campaigns c
  where c.status = 'published' or public.journey_is_author(auth.uid())
$$;

-- ============================================================
-- SECURE PLAYER MUTATION
-- ============================================================

create or replace function public.journey_create_character(
  _name text, _pronouns text default null, _origin text default null,
  _background text default null, _stats jsonb default null)
returns public.journey_characters
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ch public.journey_characters; s jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if coalesce(trim(_name), '') = '' then raise exception 'A hero needs a name'; end if;
  if (select count(*) from public.journey_characters where user_id = uid) >= 20 then
    raise exception 'Too many heroes';
  end if;
  s := coalesce(_stats, '{"might":2,"finesse":2,"wits":2,"resolve":2}'::jsonb);
  -- clamp authored stats so players cannot mint a superhero
  s := jsonb_build_object(
    'might', least(greatest(coalesce((s ->> 'might')::numeric, 2), 1), 5),
    'finesse', least(greatest(coalesce((s ->> 'finesse')::numeric, 2), 1), 5),
    'wits', least(greatest(coalesce((s ->> 'wits')::numeric, 2), 1), 5),
    'resolve', least(greatest(coalesce((s ->> 'resolve')::numeric, 2), 1), 5));
  if (coalesce((s->>'might')::numeric,0) + coalesce((s->>'finesse')::numeric,0)
      + coalesce((s->>'wits')::numeric,0) + coalesce((s->>'resolve')::numeric,0)) > 12 then
    raise exception 'Too many stat points allocated';
  end if;

  insert into public.journey_characters (user_id, name, pronouns, origin, background, stats)
  values (uid, left(trim(_name), 60), _pronouns, _origin, _background, s)
  returning * into ch;
  return ch;
end $$;

create or replace function public.journey_set_run_status(_run_id uuid, _status text)
returns public.journey_campaign_runs
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); run public.journey_campaign_runs;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  if _status not in ('abandoned','archived') then raise exception 'Status not allowed'; end if;
  update public.journey_campaign_runs r set status = _status, last_played_at = now()
   where r.id = _run_id and r.user_id = uid returning * into run;
  if run is null then raise exception 'Run not found'; end if;
  return run;
end $$;

-- Players may read their own rows but never write them directly.
revoke insert, update, delete on public.journey_campaign_runs from authenticated;
revoke insert, update, delete on public.journey_characters from authenticated;

drop policy if exists journey_runs_own on public.journey_campaign_runs;
create policy journey_runs_own_read on public.journey_campaign_runs
  for select to authenticated using (user_id = auth.uid());

drop policy if exists journey_characters_own on public.journey_characters;
create policy journey_characters_own_read on public.journey_characters
  for select to authenticated using (user_id = auth.uid());

drop policy if exists journey_combat_own on public.journey_combat_sessions;
create policy journey_combat_own_read on public.journey_combat_sessions
  for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.journey_combat_sessions from authenticated;

-- ============================================================
-- HIDDEN CONTENT: authors only. Players go through runtime RPCs.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'journey_scenes','journey_scene_blocks','journey_choices','journey_enemies','journey_endings',
    'journey_codex_entries','journey_locations','journey_npcs','journey_quests','journey_items',
    'journey_acts','journey_chapters','journey_campaign_variables','journey_factions'
  ] loop
    execute format('drop policy if exists %1$s_read on public.%1$I', t);
    execute format($f$
      create policy %1$s_read on public.%1$I
        for select to authenticated
        using (public.journey_is_author(auth.uid()))
    $f$, t);
  end loop;
end $$;

drop policy if exists journey_campaigns_read on public.journey_campaigns;
create policy journey_campaigns_read on public.journey_campaigns
  for select to authenticated
  using (public.journey_is_author(auth.uid()));