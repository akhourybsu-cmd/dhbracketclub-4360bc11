CREATE OR REPLACE FUNCTION public.journey_state_number(_state jsonb, _bucket text, _key text)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public
AS $function$
  select coalesce(
    case
      when (_state -> _bucket ->> _key) ~ '^\s*-?\d+(\.\d+)?\s*$'
        then (_state -> _bucket ->> _key)::numeric
      else null
    end, 0)
$function$;