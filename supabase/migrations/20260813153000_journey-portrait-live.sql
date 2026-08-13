-- The Splendid Journey — portraits resolve from the live NPC table.
--
-- Previously runtime speaker portraits were read from the run's pinned release
-- snapshot, so a journey already in progress (or one whose release predated the
-- portrait upload) kept showing the initial-medallion bubble. Portraits are
-- cosmetic, not story state, so resolve them from the current draft journey_npcs
-- keyed by campaign — an uploaded portrait then appears immediately, for every
-- run, without a re-publish.

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
  npcmap jsonb := '{}'::jsonb;
  spk text;
begin
  if uid is null then raise exception 'Not authenticated'; end if;
  select * into run from public.journey_campaign_runs where id = _run_id;
  if run is null or run.user_id <> uid then raise exception 'Run not found'; end if;
  select * into camp from public.journey_campaigns where id = run.campaign_id;

  st := coalesce(run.state, '{}'::jsonb);
  sc := public.journey_scene_content(run.campaign_id, run.campaign_version, run.current_scene_key);

  -- Latest character portraits from the draft (cosmetic; not version-pinned).
  select coalesce(jsonb_object_agg(npc_key, to_jsonb(portrait)), '{}'::jsonb)
    into npcmap
    from public.journey_npcs
   where campaign_id = run.campaign_id and nullif(portrait, '') is not null;

  if sc is not null then
    for b in select * from jsonb_array_elements(coalesce(sc -> 'blocks', '[]'::jsonb)) loop
      if public.journey_eval_requirements(b -> 'conditions', st) then
        if (b ->> 'block_type') = 'dialogue' and (b -> 'metadata') is not null then
          spk := b -> 'metadata' ->> 'speaker_key';
          if spk is not null and (npcmap ? spk) then
            b := jsonb_set(b, '{metadata,portrait}', npcmap -> spk, true);
          end if;
        end if;
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
