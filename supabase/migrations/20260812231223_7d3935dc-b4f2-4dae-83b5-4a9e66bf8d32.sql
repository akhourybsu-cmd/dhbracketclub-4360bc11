create or replace function public.journey_effect_notices(_effects jsonb)
returns jsonb language plpgsql immutable as $$
declare e jsonb; out_arr jsonb := '[]'::jsonb; k text; amt numeric; t text; msg text;
begin
  if _effects is null or jsonb_typeof(_effects) <> 'array' then return out_arr; end if;
  for e in select * from jsonb_array_elements(_effects) loop
    t := coalesce(e ->> 'type', e ->> 'op');
    k := coalesce(e ->> 'key', '');
    begin
      amt := coalesce((e ->> 'value')::numeric, 1);
    exception when others then amt := 1;
    end;
    msg := case t
      when 'add_item' then 'Acquired: ' || k
      when 'remove_item' then 'Lost: ' || k
      when 'gain_gold' then 'Gained ' || amt::text || ' coin'
      when 'lose_gold' then 'Spent ' || amt::text || ' coin'
      when 'gain_xp' then amt::text || ' experience'
      when 'damage_player' then 'You take ' || amt::text || ' damage'
      when 'heal_player' then 'You recover ' || amt::text || ' health'
      when 'start_quest' then 'New quest: ' || k
      when 'complete_quest' then 'Quest complete: ' || k
      when 'fail_quest' then 'Quest failed: ' || k
      when 'unlock_codex' then 'Codex updated'
      when 'unlock_location' then 'New location discovered'
      when 'unlock_trait' then 'New trait: ' || k
      when 'unlock_ability' then 'New ability: ' || k
      else null
    end;
    if msg is not null then
      out_arr := out_arr || to_jsonb(msg);
    end if;
  end loop;
  return out_arr;
end $$;