-- Hardened, session-derived club enrollment.
-- Behavior preserved: password match is case-insensitive against active clubs,
-- one club per account, idempotent for repeat submissions of the same request.

CREATE OR REPLACE FUNCTION public.join_club_with_password(_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller uuid := auth.uid();
  matched_club_id uuid;
  existing_membership uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to join a club'
      USING ERRCODE = '28000';
  END IF;

  IF _password IS NULL OR length(trim(_password)) = 0 THEN
    RAISE EXCEPTION 'Club password required' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO matched_club_id
  FROM public.clubs
  WHERE status = 'active'
    AND join_password IS NOT NULL
    AND lower(join_password) = lower(trim(_password))
  LIMIT 1;

  IF matched_club_id IS NULL THEN
    RAISE EXCEPTION 'That club password is not valid or is no longer active'
      USING ERRCODE = '22023';
  END IF;

  SELECT club_id INTO existing_membership
  FROM public.club_members
  WHERE user_id = caller
  LIMIT 1;

  IF existing_membership IS NOT NULL THEN
    -- Idempotent: re-submitting the same valid request is a no-op.
    IF existing_membership = matched_club_id THEN
      RETURN matched_club_id;
    END IF;
    RAISE EXCEPTION 'This account already belongs to a different club'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.club_members (club_id, user_id, role)
  VALUES (matched_club_id, caller, 'member')
  ON CONFLICT DO NOTHING;

  RETURN matched_club_id;
END;
$$;

-- Legacy 2-arg overload: keep the signature for compatibility but never trust
-- the client-supplied identity. Enrollment always targets auth.uid().
CREATE OR REPLACE FUNCTION public.join_club_with_password(_password text, _user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to join a club'
      USING ERRCODE = '28000';
  END IF;

  IF _user_id IS NOT NULL AND _user_id <> caller THEN
    RAISE EXCEPTION 'Not authorized to enroll another account'
      USING ERRCODE = '42501';
  END IF;

  RETURN public.join_club_with_password(_password);
END;
$$;

-- Anonymous callers must never reach club enrollment.
REVOKE ALL ON FUNCTION public.join_club_with_password(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_club_with_password(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_club_with_password(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_club_with_password(text, uuid) TO authenticated;