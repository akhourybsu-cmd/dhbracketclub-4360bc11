-- Rune Delve — atomic wallet operations
--
-- The client previously did read-modify-write on rune_delve_wallet with an
-- ABSOLUTE value computed from a stale read, and the spend UPDATE had no
-- balance guard. Two concurrent spends (fast double-tap, two tabs) could each
-- read the same balance and both succeed — a double-spend / lost-update. These
-- SECURITY DEFINER RPCs move the arithmetic server-side so earn/spend are
-- atomic and spend can never overdraw.
--
-- Idempotent: safe to re-run.

-- ── Earn ────────────────────────────────────────────────────────────────────
-- Adds shards (and lifetime_shards_earned) with relative arithmetic. Creates
-- the wallet row on first earn. Runs as the caller (auth.uid()).
create or replace function public.rune_delve_earn_shards(p_amount integer)
returns public.rune_delve_wallet
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.rune_delve_wallet;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_must_be_positive';
  end if;

  insert into public.rune_delve_wallet (user_id, shards, lifetime_shards_earned, slots_unlocked)
  values (v_uid, p_amount, p_amount, 2)
  on conflict (user_id) do update
    set shards = public.rune_delve_wallet.shards + excluded.shards,
        lifetime_shards_earned = public.rune_delve_wallet.lifetime_shards_earned + excluded.lifetime_shards_earned
  returning * into v_row;

  return v_row;
end;
$$;

-- ── Spend ─────────────────────────────────────────────────────────────────--
-- Deducts shards atomically. The WHERE guard (shards >= p_amount) is evaluated
-- under the row lock the UPDATE takes, so two concurrent spends can never both
-- succeed past the balance — the second sees the already-decremented value and
-- affects zero rows, which raises insufficient_shards.
create or replace function public.rune_delve_spend_shards(p_amount integer)
returns public.rune_delve_wallet
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row public.rune_delve_wallet;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount_must_be_positive';
  end if;

  update public.rune_delve_wallet
     set shards = shards - p_amount
   where user_id = v_uid
     and shards >= p_amount
  returning * into v_row;

  if not found then
    raise exception 'insufficient_shards';
  end if;

  return v_row;
end;
$$;

-- Callable only by authenticated users; the functions self-scope to auth.uid().
revoke all on function public.rune_delve_earn_shards(integer) from public;
revoke all on function public.rune_delve_spend_shards(integer) from public;
grant execute on function public.rune_delve_earn_shards(integer) to authenticated;
grant execute on function public.rune_delve_spend_shards(integer) to authenticated;
