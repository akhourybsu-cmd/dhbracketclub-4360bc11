-- ============================================================
-- THE SPLENDID JOURNEY of Unimaginable Consequence
-- Narrative RPG platform (Mesoplasia) — foundation schema
-- ============================================================

-- ---------- helper: admin check ----------
create or replace function public.journey_is_author(_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.is_app_admin(_uid), false) or coalesce(public.is_platform_owner(_uid), false)
$$;

-- ============================================================
-- CONTENT TABLES
-- ============================================================

create table public.journey_campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  description text,
  cover_image text,
  hero_image text,
  status text not null default 'draft' check (status in ('draft','testing','published','archived')),
  version integer not null default 1,
  author text,
  estimated_length text,
  minimum_level integer not null default 1,
  recommended_level integer not null default 1,
  starting_scene_key text,
  content_notes text,
  config jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  author_notes text,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.journey_acts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  act_key text not null,
  title text not null,
  subtitle text,
  display_order integer not null default 0,
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, act_key)
);

create table public.journey_chapters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  act_id uuid references public.journey_acts(id) on delete set null,
  chapter_key text not null,
  title text not null,
  subtitle text,
  intro_text text,
  artwork text,
  display_order integer not null default 0,
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, chapter_key)
);

create table public.journey_locations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  location_key text not null,
  name text not null,
  region text,
  description text,
  image text,
  ambient_audio text,
  map_position jsonb,
  codex_key text,
  metadata jsonb not null default '{}'::jsonb,
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, location_key)
);

create table public.journey_scenes (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  chapter_id uuid references public.journey_chapters(id) on delete set null,
  scene_key text not null,
  scene_type text not null default 'narrative',
  title text,
  subtitle text,
  location_key text,
  background_asset text,
  ambient_audio text,
  music_track text,
  entry_effects jsonb not null default '[]'::jsonb,
  entry_conditions jsonb,
  auto_next_scene_key text,
  is_terminal boolean not null default false,
  ending_key text,
  display_order integer not null default 0,
  tags text[] not null default '{}',
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, scene_key)
);

create table public.journey_scene_blocks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  scene_id uuid not null references public.journey_scenes(id) on delete cascade,
  block_type text not null,
  display_order integer not null default 0,
  content text,
  metadata jsonb not null default '{}'::jsonb,
  conditions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journey_scene_blocks_scene_idx on public.journey_scene_blocks(scene_id, display_order);

create table public.journey_choices (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  scene_id uuid not null references public.journey_scenes(id) on delete cascade,
  choice_key text not null,
  choice_text text not null,
  short_label text,
  description text,
  display_order integer not null default 0,
  next_scene_key text,
  choice_style text not null default 'standard',
  confirmation_required boolean not null default false,
  hidden_when_unavailable boolean not null default false,
  locked_hint text,
  major_decision boolean not null default false,
  once_only boolean not null default false,
  requirements jsonb,
  effects jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, choice_key)
);
create index journey_choices_scene_idx on public.journey_choices(scene_id, display_order);

create table public.journey_npcs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  npc_key text not null,
  name text not null,
  title text,
  description text,
  portrait text,
  faction_key text,
  biography text,
  codex_key text,
  metadata jsonb not null default '{}'::jsonb,
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, npc_key)
);

create table public.journey_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  item_key text not null,
  name text not null,
  description text,
  icon text,
  image text,
  item_type text not null default 'misc',
  rarity text not null default 'common',
  stackable boolean not null default false,
  max_stack integer not null default 1,
  usable boolean not null default false,
  quest_item boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, item_key)
);

create table public.journey_quests (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  quest_key text not null,
  title text not null,
  description text,
  quest_type text not null default 'main',
  objectives jsonb not null default '[]'::jsonb,
  rewards jsonb not null default '[]'::jsonb,
  hidden_until_discovered boolean not null default false,
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, quest_key)
);

create table public.journey_codex_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  codex_key text not null,
  title text not null,
  category text not null default 'lore',
  body text,
  image text,
  display_order integer not null default 0,
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, codex_key)
);

create table public.journey_campaign_variables (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  variable_key text not null,
  label text,
  value_type text not null default 'integer' check (value_type in ('boolean','integer','decimal','string','enum')),
  default_value jsonb,
  enum_values text[],
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, variable_key)
);

create table public.journey_factions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  faction_key text not null,
  name text not null,
  description text,
  image text,
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, faction_key)
);

create table public.journey_endings (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  ending_key text not null,
  name text not null,
  description text,
  priority integer not null default 0,
  requirements jsonb,
  epilogue_blocks jsonb not null default '[]'::jsonb,
  spoiler_safe_label text,
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, ending_key)
);

create table public.journey_enemies (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  enemy_key text not null,
  name text not null,
  description text,
  portrait text,
  max_health integer not null default 10,
  armor integer not null default 0,
  attack integer not null default 2,
  abilities jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  author_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, enemy_key)
);

-- ============================================================
-- PLAYER TABLES
-- ============================================================

create table public.journey_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  portrait text,
  pronouns text,
  origin text,
  background text,
  level integer not null default 1,
  xp integer not null default 0,
  stats jsonb not null default '{"might":2,"finesse":2,"wits":2,"resolve":2}'::jsonb,
  traits text[] not null default '{}',
  abilities text[] not null default '{}',
  health integer not null default 20,
  max_health integer not null default 20,
  currency integer not null default 0,
  equipment jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journey_characters_user_idx on public.journey_characters(user_id);

create table public.journey_campaign_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  campaign_id uuid not null references public.journey_campaigns(id) on delete cascade,
  campaign_version integer not null default 1,
  character_id uuid references public.journey_characters(id) on delete set null,
  current_scene_key text,
  current_chapter_key text,
  status text not null default 'active' check (status in ('active','completed','abandoned','archived')),
  is_test_run boolean not null default false,
  state jsonb not null default '{}'::jsonb,
  ending_key text,
  playtime_seconds integer not null default 0,
  run_number integer not null default 1,
  started_at timestamptz not null default now(),
  last_played_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index journey_runs_user_idx on public.journey_campaign_runs(user_id, campaign_id);

create table public.journey_run_choice_history (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.journey_campaign_runs(id) on delete cascade,
  user_id uuid not null,
  scene_key text not null,
  choice_key text,
  choice_text_snapshot text,
  campaign_version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index journey_history_run_idx on public.journey_run_choice_history(run_id, created_at);

create table public.journey_combat_sessions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.journey_campaign_runs(id) on delete cascade,
  user_id uuid not null,
  scene_key text not null,
  status text not null default 'active' check (status in ('active','victory','defeat','escaped','resolved')),
  round integer not null default 1,
  player_state jsonb not null default '{}'::jsonb,
  enemies jsonb not null default '[]'::jsonb,
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- GRANTS
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'journey_campaigns','journey_acts','journey_chapters','journey_scenes','journey_scene_blocks',
    'journey_choices','journey_npcs','journey_locations','journey_items','journey_quests',
    'journey_codex_entries','journey_campaign_variables','journey_factions','journey_endings','journey_enemies',
    'journey_characters','journey_campaign_runs','journey_run_choice_history','journey_combat_sessions'
  ] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Campaigns: published readable by all authenticated; authors see everything.
create policy journey_campaigns_read on public.journey_campaigns
  for select to authenticated
  using (status = 'published' or public.journey_is_author(auth.uid()));
create policy journey_campaigns_write on public.journey_campaigns
  for all to authenticated
  using (public.journey_is_author(auth.uid()))
  with check (public.journey_is_author(auth.uid()));

-- Child content tables: readable when parent campaign is readable; writable by authors.
do $$
declare t text;
begin
  foreach t in array array[
    'journey_acts','journey_chapters','journey_scenes','journey_scene_blocks','journey_choices',
    'journey_npcs','journey_locations','journey_items','journey_quests','journey_codex_entries',
    'journey_campaign_variables','journey_factions','journey_endings','journey_enemies'
  ] loop
    execute format($f$
      create policy %1$s_read on public.%1$I
        for select to authenticated
        using (exists (select 1 from public.journey_campaigns c
                       where c.id = %1$I.campaign_id
                         and (c.status = 'published' or public.journey_is_author(auth.uid()))))
    $f$, t);
    execute format($f$
      create policy %1$s_write on public.%1$I
        for all to authenticated
        using (public.journey_is_author(auth.uid()))
        with check (public.journey_is_author(auth.uid()))
    $f$, t);
  end loop;
end $$;

-- Player-owned tables
create policy journey_characters_own on public.journey_characters
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy journey_runs_own on public.journey_campaign_runs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy journey_history_own on public.journey_run_choice_history
  for select to authenticated using (user_id = auth.uid());
create policy journey_combat_own on public.journey_combat_sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- updated_at triggers
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'journey_campaigns','journey_acts','journey_chapters','journey_scenes','journey_scene_blocks',
    'journey_choices','journey_npcs','journey_locations','journey_items','journey_quests',
    'journey_codex_entries','journey_campaign_variables','journey_factions','journey_endings','journey_enemies',
    'journey_characters','journey_campaign_runs','journey_combat_sessions'
  ] loop
    execute format('create trigger set_%1$s_updated_at before update on public.%1$I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ============================================================
-- REQUIREMENT ENGINE
-- ============================================================
create or replace function public.journey_state_number(_state jsonb, _bucket text, _key text)
returns numeric language sql immutable as $$
  select coalesce((_state -> _bucket ->> _key)::numeric, 0)
$$;

create or replace function public.journey_eval_requirements(_req jsonb, _state jsonb)
returns boolean language plpgsql stable as $$
declare
  kind text;
  child jsonb;
  ok boolean;
  target text;
  val numeric;
begin
  if _req is null or _req = 'null'::jsonb then return true; end if;

  -- array => implicit ALL
  if jsonb_typeof(_req) = 'array' then
    for child in select * from jsonb_array_elements(_req) loop
      if not public.journey_eval_requirements(child, _state) then return false; end if;
    end loop;
    return true;
  end if;

  kind := coalesce(_req ->> 'type', _req ->> 'op');
  target := _req ->> 'key';

  if kind in ('all','and') then
    for child in select * from jsonb_array_elements(coalesce(_req -> 'conditions', '[]'::jsonb)) loop
      if not public.journey_eval_requirements(child, _state) then return false; end if;
    end loop;
    return true;
  elsif kind in ('any','or') then
    ok := false;
    for child in select * from jsonb_array_elements(coalesce(_req -> 'conditions', '[]'::jsonb)) loop
      if public.journey_eval_requirements(child, _state) then ok := true; end if;
    end loop;
    return ok;
  elsif kind = 'not' then
    for child in select * from jsonb_array_elements(coalesce(_req -> 'conditions', '[]'::jsonb)) loop
      if public.journey_eval_requirements(child, _state) then return false; end if;
    end loop;
    return true;
  end if;

  case kind
    when 'flag_equals' then
      return coalesce((_state -> 'flags' -> target)::text, 'null') = coalesce((_req -> 'value')::text, 'true');
    when 'flag_exists' then
      return (_state -> 'flags') ? target and coalesce((_state -> 'flags' ->> target), 'false') <> 'false';
    when 'flag_not_exists' then
      return not ((_state -> 'flags') ? target) or coalesce((_state -> 'flags' ->> target), 'false') = 'false';
    when 'has_item' then
      return coalesce((_state -> 'inventory' ->> target)::numeric, 0) >= coalesce((_req ->> 'value')::numeric, 1);
    when 'does_not_have_item' then
      return coalesce((_state -> 'inventory' ->> target)::numeric, 0) < coalesce((_req ->> 'value')::numeric, 1);
    when 'stat_minimum' then
      return public.journey_state_number(_state, 'stats', target) >= coalesce((_req ->> 'value')::numeric, 0);
    when 'stat_maximum' then
      return public.journey_state_number(_state, 'stats', target) <= coalesce((_req ->> 'value')::numeric, 0);
    when 'variable_equals','campaign_variable_equals' then
      return coalesce((_state -> 'variables' ->> target), '') = coalesce((_req ->> 'value'), '');
    when 'variable_minimum' then
      return public.journey_state_number(_state, 'variables', target) >= coalesce((_req ->> 'value')::numeric, 0);
    when 'variable_maximum' then
      return public.journey_state_number(_state, 'variables', target) <= coalesce((_req ->> 'value')::numeric, 0);
    when 'relationship_minimum' then
      return public.journey_state_number(_state, 'relationships', target) >= coalesce((_req ->> 'value')::numeric, 0);
    when 'relationship_maximum' then
      return public.journey_state_number(_state, 'relationships', target) <= coalesce((_req ->> 'value')::numeric, 0);
    when 'faction_reputation_minimum' then
      return public.journey_state_number(_state, 'factions', target) >= coalesce((_req ->> 'value')::numeric, 0);
    when 'faction_reputation_maximum' then
      return public.journey_state_number(_state, 'factions', target) <= coalesce((_req ->> 'value')::numeric, 0);
    when 'quest_status' then
      return coalesce((_state -> 'quests' -> target ->> 'status'), 'not_started') = coalesce((_req ->> 'value'), 'active');
    when 'has_trait' then
      return (_state -> 'traits') @> to_jsonb(array[target]);
    when 'has_ability' then
      return (_state -> 'abilities') @> to_jsonb(array[target]);
    when 'level_minimum' then
      return coalesce((_state ->> 'level')::numeric, 1) >= coalesce((_req ->> 'value')::numeric, 1);
    when 'previous_choice' then
      return (_state -> 'choices_made') @> to_jsonb(array[target]);
    when 'character_alive' then
      return coalesce((_state -> 'npc_status' ->> target), 'alive') <> 'dead';
    when 'character_dead' then
      return coalesce((_state -> 'npc_status' ->> target), 'alive') = 'dead';
    when 'world_state_equals' then
      return coalesce((_state -> 'world' ->> target), '') = coalesce((_req ->> 'value'), '');
    when 'codex_unlocked' then
      return (_state -> 'codex') @> to_jsonb(array[target]);
    when 'location_visited' then
      return (_state -> 'visited_locations') @> to_jsonb(array[target]);
    when 'health_minimum' then
      return coalesce((_state ->> 'health')::numeric, 0) >= coalesce((_req ->> 'value')::numeric, 0);
    else
      -- Unknown requirement types fail closed but do not crash the run.
      return false;
  end case;
end $$;

-- ============================================================
-- EFFECT ENGINE
-- ============================================================
create or replace function public.journey_apply_effects(_effects jsonb, _state jsonb)
returns jsonb language plpgsql stable as $$
declare
  e jsonb;
  s jsonb := coalesce(_state, '{}'::jsonb);
  kind text;
  k text;
  cur numeric;
  amount numeric;
  arr jsonb;
begin
  if _effects is null or jsonb_typeof(_effects) <> 'array' then return s; end if;
  for e in select * from jsonb_array_elements(_effects) loop
    kind := coalesce(e ->> 'type', e ->> 'op');
    k := e ->> 'key';
    amount := coalesce((e ->> 'value')::numeric, 1);
    case kind
      when 'set_flag' then
        s := jsonb_set(s, array['flags', k], coalesce(e -> 'value', 'true'::jsonb), true);
      when 'unset_flag' then
        s := jsonb_set(s, array['flags', k], 'false'::jsonb, true);
      when 'set_variable' then
        s := jsonb_set(s, array['variables', k], coalesce(e -> 'value', '0'::jsonb), true);
      when 'increment_variable' then
        cur := public.journey_state_number(s, 'variables', k);
        s := jsonb_set(s, array['variables', k], to_jsonb(cur + amount), true);
      when 'decrement_variable' then
        cur := public.journey_state_number(s, 'variables', k);
        s := jsonb_set(s, array['variables', k], to_jsonb(cur - amount), true);
      when 'add_item' then
        cur := coalesce((s -> 'inventory' ->> k)::numeric, 0);
        s := jsonb_set(s, array['inventory', k], to_jsonb(cur + amount), true);
      when 'remove_item' then
        cur := coalesce((s -> 'inventory' ->> k)::numeric, 0);
        s := jsonb_set(s, array['inventory', k], to_jsonb(greatest(cur - amount, 0)), true);
      when 'gain_gold' then
        s := jsonb_set(s, array['gold'], to_jsonb(coalesce((s ->> 'gold')::numeric, 0) + amount), true);
      when 'lose_gold' then
        s := jsonb_set(s, array['gold'], to_jsonb(greatest(coalesce((s ->> 'gold')::numeric, 0) - amount, 0)), true);
      when 'gain_xp' then
        s := jsonb_set(s, array['xp'], to_jsonb(coalesce((s ->> 'xp')::numeric, 0) + amount), true);
      when 'increase_stat' then
        s := jsonb_set(s, array['stats', k], to_jsonb(public.journey_state_number(s,'stats',k) + amount), true);
      when 'decrease_stat' then
        s := jsonb_set(s, array['stats', k], to_jsonb(public.journey_state_number(s,'stats',k) - amount), true);
      when 'increase_relationship' then
        s := jsonb_set(s, array['relationships', k], to_jsonb(public.journey_state_number(s,'relationships',k) + amount), true);
      when 'decrease_relationship' then
        s := jsonb_set(s, array['relationships', k], to_jsonb(public.journey_state_number(s,'relationships',k) - amount), true);
      when 'set_relationship' then
        s := jsonb_set(s, array['relationships', k], to_jsonb(amount), true);
      when 'increase_faction_reputation' then
        s := jsonb_set(s, array['factions', k], to_jsonb(public.journey_state_number(s,'factions',k) + amount), true);
      when 'decrease_faction_reputation' then
        s := jsonb_set(s, array['factions', k], to_jsonb(public.journey_state_number(s,'factions',k) - amount), true);
      when 'start_quest' then
        s := jsonb_set(s, array['quests', k], jsonb_build_object('status','active','step', coalesce(e ->> 'step','1')), true);
      when 'advance_quest' then
        s := jsonb_set(s, array['quests', k], jsonb_build_object('status','active','step', coalesce(e ->> 'step','1')), true);
      when 'complete_quest' then
        s := jsonb_set(s, array['quests', k], jsonb_build_object('status','completed','step', coalesce(e ->> 'step','')), true);
      when 'fail_quest' then
        s := jsonb_set(s, array['quests', k], jsonb_build_object('status','failed','step', coalesce(e ->> 'step','')), true);
      when 'unlock_codex' then
        arr := coalesce(s -> 'codex', '[]'::jsonb);
        if not (arr @> to_jsonb(array[k])) then s := jsonb_set(s, array['codex'], arr || to_jsonb(k), true); end if;
      when 'unlock_location' then
        arr := coalesce(s -> 'locations', '[]'::jsonb);
        if not (arr @> to_jsonb(array[k])) then s := jsonb_set(s, array['locations'], arr || to_jsonb(k), true); end if;
      when 'visit_location' then
        arr := coalesce(s -> 'visited_locations', '[]'::jsonb);
        if not (arr @> to_jsonb(array[k])) then s := jsonb_set(s, array['visited_locations'], arr || to_jsonb(k), true); end if;
      when 'unlock_trait' then
        arr := coalesce(s -> 'traits', '[]'::jsonb);
        if not (arr @> to_jsonb(array[k])) then s := jsonb_set(s, array['traits'], arr || to_jsonb(k), true); end if;
      when 'unlock_ability' then
        arr := coalesce(s -> 'abilities', '[]'::jsonb);
        if not (arr @> to_jsonb(array[k])) then s := jsonb_set(s, array['abilities'], arr || to_jsonb(k), true); end if;
      when 'damage_player' then
        s := jsonb_set(s, array['health'], to_jsonb(greatest(coalesce((s ->> 'health')::numeric, 0) - amount, 0)), true);
      when 'heal_player' then
        s := jsonb_set(s, array['health'], to_jsonb(least(coalesce((s ->> 'health')::numeric, 0) + amount,
                                                          coalesce((s ->> 'max_health')::numeric, 9999))), true);
      when 'change_world_state' then
        s := jsonb_set(s, array['world', k], coalesce(e -> 'value', '""'::jsonb), true);
      when 'character_alive' then
        s := jsonb_set(s, array['npc_status', k], '"alive"'::jsonb, true);
      when 'character_dead' then
        s := jsonb_set(s, array['npc_status', k], '"dead"'::jsonb, true);
      else
        -- unknown effects ignored (forward compatible)
        null;
    end case;
  end loop;
  return s;
end $$;

-- ============================================================
-- RUN LIFECYCLE
-- ============================================================
create or replace function public.journey_default_state(_character public.journey_characters)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'flags', '{}'::jsonb,
    'variables', '{}'::jsonb,
    'inventory', '{}'::jsonb,
    'relationships', '{}'::jsonb,
    'factions', '{}'::jsonb,
    'quests', '{}'::jsonb,
    'codex', '[]'::jsonb,
    'locations', '[]'::jsonb,
    'visited_locations', '[]'::jsonb,
    'npc_status', '{}'::jsonb,
    'world', '{}'::jsonb,
    'choices_made', '[]'::jsonb,
    'traits', to_jsonb(coalesce(_character.traits, '{}')),
    'abilities', to_jsonb(coalesce(_character.abilities, '{}')),
    'stats', coalesce(_character.stats, '{}'::jsonb),
    'health', coalesce(_character.health, 20),
    'max_health', coalesce(_character.max_health, 20),
    'xp', coalesce(_character.xp, 0),
    'level', coalesce(_character.level, 1),
    'gold', coalesce(_character.currency, 0),
    'hero_name', _character.name
  )
$$;

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
  st := public.journey_apply_effects(
          (select entry_effects from public.journey_scenes where campaign_id = camp.id and scene_key = start_scene), st);

  insert into public.journey_campaign_runs
    (user_id, campaign_id, campaign_version, character_id, current_scene_key, current_chapter_key,
     is_test_run, state, run_number)
  values (uid, camp.id, camp.version, ch.id, start_scene,
     (select c.chapter_key from public.journey_scenes s
        left join public.journey_chapters c on c.id = s.chapter_id
       where s.campaign_id = camp.id and s.scene_key = start_scene),
     _is_test, st, n)
  returning * into run;
  return run;
end $$;

-- Authoritative choice execution
create or replace function public.journey_execute_choice(_run_id uuid, _scene_key text, _choice_key text)
returns public.journey_campaign_runs
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  run public.journey_campaign_runs;
  ch public.journey_choices;
  nxt public.journey_scenes;
  st jsonb;
  made jsonb;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into run from public.journey_campaign_runs where id = _run_id for update;
  if run is null or run.user_id <> uid then raise exception 'Run not found'; end if;
  if run.status <> 'active' then raise exception 'This journey is no longer active'; end if;
  if run.current_scene_key is distinct from _scene_key then
    raise exception 'Scene out of sync';
  end if;

  select * into ch from public.journey_choices
   where campaign_id = run.campaign_id and choice_key = _choice_key
     and scene_id = (select id from public.journey_scenes where campaign_id = run.campaign_id and scene_key = _scene_key);
  if ch is null then raise exception 'Choice not available in this scene'; end if;

  st := coalesce(run.state, '{}'::jsonb);

  if not public.journey_eval_requirements(ch.requirements, st) then
    raise exception 'Requirements not met';
  end if;
  if ch.once_only and (coalesce(st -> 'choices_made', '[]'::jsonb) @> to_jsonb(array[ch.choice_key])) then
    raise exception 'Choice already taken';
  end if;

  -- apply effects
  st := public.journey_apply_effects(ch.effects, st);
  made := coalesce(st -> 'choices_made', '[]'::jsonb);
  if not (made @> to_jsonb(ch.choice_key)) then
    st := jsonb_set(st, array['choices_made'], made || to_jsonb(ch.choice_key), true);
  end if;

  -- record history
  insert into public.journey_run_choice_history (run_id, user_id, scene_key, choice_key, choice_text_snapshot, campaign_version)
  values (run.id, uid, _scene_key, ch.choice_key, ch.choice_text, run.campaign_version);

  -- resolve destination
  if ch.next_scene_key is not null then
    select * into nxt from public.journey_scenes where campaign_id = run.campaign_id and scene_key = ch.next_scene_key;
    if nxt is null then raise exception 'Destination scene missing: %', ch.next_scene_key; end if;
    st := public.journey_apply_effects(nxt.entry_effects, st);
  end if;

  update public.journey_campaign_runs r set
    state = st,
    current_scene_key = coalesce(nxt.scene_key, r.current_scene_key),
    current_chapter_key = coalesce(
      (select c.chapter_key from public.journey_chapters c where c.id = nxt.chapter_id), r.current_chapter_key),
    status = case when nxt.is_terminal then 'completed' else r.status end,
    ending_key = coalesce(nxt.ending_key, r.ending_key),
    completed_at = case when nxt.is_terminal then now() else r.completed_at end,
    last_played_at = now()
  where r.id = run.id
  returning * into run;

  return run;
end $$;

-- Test-mode scene jump / state patch (authors only, or own test runs)
create or replace function public.journey_test_patch_run(_run_id uuid, _scene_key text, _state_patch jsonb)
returns public.journey_campaign_runs
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  run public.journey_campaign_runs;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into run from public.journey_campaign_runs where id = _run_id;
  if run is null or run.user_id <> uid then raise exception 'Run not found'; end if;
  if not public.journey_is_author(uid) then raise exception 'Not permitted'; end if;

  update public.journey_campaign_runs r set
    state = coalesce(r.state, '{}'::jsonb) || coalesce(_state_patch, '{}'::jsonb),
    current_scene_key = coalesce(_scene_key, r.current_scene_key),
    current_chapter_key = coalesce(
      (select c.chapter_key from public.journey_scenes s
         left join public.journey_chapters c on c.id = s.chapter_id
        where s.campaign_id = r.campaign_id and s.scene_key = _scene_key), r.current_chapter_key),
    status = 'active',
    last_played_at = now()
  where r.id = run.id
  returning * into run;
  return run;
end $$;

-- ============================================================
-- CAMPAIGN IMPORT (structured package → relational rows)
-- ============================================================
create or replace function public.journey_import_campaign(_package jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
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
    insert into public.journey_endings (campaign_id, ending_key, name, description, priority, requirements, epilogue_blocks, spoiler_safe_label, author_notes)
    values (cid, rec ->> 'ending_key', coalesce(rec ->> 'name','Ending'), rec ->> 'description',
            coalesce((rec ->> 'priority')::int, 0), rec -> 'requirements', coalesce(rec -> 'epilogue_blocks','[]'::jsonb),
            rec ->> 'spoiler_safe_label', rec ->> 'author_notes');
  end loop;

  -- scenes (+ nested blocks and choices)
  for rec in select * from jsonb_array_elements(coalesce(_package -> 'scenes','[]'::jsonb)) loop
    insert into public.journey_scenes (campaign_id, chapter_id, scene_key, scene_type, title, subtitle, location_key,
        background_asset, ambient_audio, music_track, entry_effects, entry_conditions, auto_next_scene_key,
        is_terminal, ending_key, display_order, tags, author_notes)
    values (cid,
        (select id from public.journey_chapters where campaign_id = cid and chapter_key = rec ->> 'chapter_key'),
        rec ->> 'scene_key', coalesce(rec ->> 'scene_type','narrative'), rec ->> 'title', rec ->> 'subtitle',
        rec ->> 'location_key', rec ->> 'background_asset', rec ->> 'ambient_audio', rec ->> 'music_track',
        coalesce(rec -> 'entry_effects','[]'::jsonb), rec -> 'entry_conditions', rec ->> 'auto_next_scene_key',
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
end $$;

grant execute on function public.journey_start_run(uuid, uuid, boolean) to authenticated;
grant execute on function public.journey_execute_choice(uuid, text, text) to authenticated;
grant execute on function public.journey_test_patch_run(uuid, text, jsonb) to authenticated;
grant execute on function public.journey_import_campaign(jsonb) to authenticated;
grant execute on function public.journey_eval_requirements(jsonb, jsonb) to authenticated;
grant execute on function public.journey_apply_effects(jsonb, jsonb) to authenticated;

-- Asset catalog entry so clubs can install the module
insert into public.platform_assets (name, slug, category, short_description, full_description, icon_name, placement_area, requires_configuration, sort_order)
values ('The Splendid Journey', 'splendid-journey', 'games',
  'A handcrafted narrative fantasy RPG set in Mesoplasia.',
  'Enter Mesoplasia: authored, branching fantasy campaigns with heroes, choices, consequences, quests, relationships and lightweight combat.',
  'ScrollText', 'games', false, 90)
on conflict (slug) do update set
  name = excluded.name, category = excluded.category, short_description = excluded.short_description,
  full_description = excluded.full_description, icon_name = excluded.icon_name,
  placement_area = excluded.placement_area, updated_at = now();
