CREATE OR REPLACE FUNCTION public.journey_apply_effects(_effects jsonb, _state jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path = public
AS $function$
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
    -- Authored values may be words (e.g. "unset") for text variables; only
    -- treat genuinely numeric values as numbers, otherwise fall back to 1.
    amount := case
      when (e ->> 'value') ~ '^\s*-?\d+(\.\d+)?\s*$' then (e ->> 'value')::numeric
      else 1
    end;
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
        cur := public.journey_state_number(s, 'inventory', k);
        s := jsonb_set(s, array['inventory', k], to_jsonb(cur + amount), true);
      when 'remove_item' then
        cur := public.journey_state_number(s, 'inventory', k);
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
        null;
    end case;
  end loop;
  return s;
end
$function$;

CREATE OR REPLACE FUNCTION public.journey_eval_requirements(_req jsonb, _state jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path = public
AS $function$
declare
  kind text;
  child jsonb;
  ok boolean;
  target text;
  reqnum numeric;
begin
  if _req is null or _req = 'null'::jsonb then return true; end if;

  if jsonb_typeof(_req) = 'array' then
    for child in select * from jsonb_array_elements(_req) loop
      if not public.journey_eval_requirements(child, _state) then return false; end if;
    end loop;
    return true;
  end if;

  kind := coalesce(_req ->> 'type', _req ->> 'op');
  target := _req ->> 'key';
  reqnum := case
    when (_req ->> 'value') ~ '^\s*-?\d+(\.\d+)?\s*$' then (_req ->> 'value')::numeric
    else 0
  end;

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
      return public.journey_state_number(_state, 'inventory', target) >= greatest(reqnum, 1);
    when 'does_not_have_item' then
      return public.journey_state_number(_state, 'inventory', target) < greatest(reqnum, 1);
    when 'stat_minimum' then
      return public.journey_state_number(_state, 'stats', target) >= reqnum;
    when 'stat_maximum' then
      return public.journey_state_number(_state, 'stats', target) <= reqnum;
    when 'variable_equals','campaign_variable_equals' then
      return coalesce((_state -> 'variables' ->> target), '') = coalesce((_req ->> 'value'), '');
    when 'variable_minimum' then
      return public.journey_state_number(_state, 'variables', target) >= reqnum;
    when 'variable_maximum' then
      return public.journey_state_number(_state, 'variables', target) <= reqnum;
    when 'relationship_minimum' then
      return public.journey_state_number(_state, 'relationships', target) >= reqnum;
    when 'relationship_maximum' then
      return public.journey_state_number(_state, 'relationships', target) <= reqnum;
    when 'faction_reputation_minimum' then
      return public.journey_state_number(_state, 'factions', target) >= reqnum;
    when 'faction_reputation_maximum' then
      return public.journey_state_number(_state, 'factions', target) <= reqnum;
    when 'quest_status' then
      return coalesce((_state -> 'quests' -> target ->> 'status'), 'not_started') = coalesce((_req ->> 'value'), 'active');
    when 'has_trait' then
      return (_state -> 'traits') @> to_jsonb(array[target]);
    when 'has_ability' then
      return (_state -> 'abilities') @> to_jsonb(array[target]);
    when 'level_minimum' then
      return coalesce((_state ->> 'level')::numeric, 1) >= greatest(reqnum, 1);
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
      return coalesce((_state ->> 'health')::numeric, 0) >= reqnum;
    else
      return false;
  end case;
end
$function$;