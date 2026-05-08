
-- Atomic increment, returns new balance
CREATE OR REPLACE FUNCTION public.increment_points(_user_id uuid, _delta integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_points integer;
BEGIN
  UPDATE public.profiles
     SET points = GREATEST(0, points + _delta)
   WHERE id = _user_id
  RETURNING points INTO new_points;
  RETURN new_points;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_points(uuid, integer) FROM PUBLIC, anon, authenticated;

-- Atomic daily check-in: only awards if 24h elapsed
CREATE OR REPLACE FUNCTION public.claim_daily_checkin(_user_id uuid, _amount integer)
RETURNS TABLE(claimed boolean, points integer, next_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_row public.profiles%ROWTYPE;
  last_at timestamptz;
BEGIN
  UPDATE public.profiles
     SET points = points + _amount,
         last_checkin_at = now()
   WHERE id = _user_id
     AND (last_checkin_at IS NULL OR last_checkin_at < now() - interval '24 hours')
  RETURNING * INTO updated_row;

  IF updated_row.id IS NOT NULL THEN
    RETURN QUERY SELECT true, updated_row.points, (updated_row.last_checkin_at + interval '24 hours');
  ELSE
    SELECT p.last_checkin_at INTO last_at FROM public.profiles p WHERE p.id = _user_id;
    RETURN QUERY SELECT false, 0, COALESCE(last_at + interval '24 hours', now());
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_daily_checkin(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin(uuid, integer) TO authenticated;

-- Atomic withdrawal request
CREATE OR REPLACE FUNCTION public.request_withdrawal_atomic(
  _user_id uuid, _ton_amount numeric, _points integer, _ton_address text
) RETURNS TABLE(ok boolean, reason text, new_points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pending_count integer;
  remaining integer;
BEGIN
  SELECT count(*) INTO pending_count FROM public.withdrawals
   WHERE user_id = _user_id AND status = 'pending';
  IF pending_count > 0 THEN
    RETURN QUERY SELECT false, 'pending_exists'::text, 0;
    RETURN;
  END IF;

  UPDATE public.profiles
     SET points = points - _points
   WHERE id = _user_id AND points >= _points
  RETURNING points INTO remaining;

  IF remaining IS NULL THEN
    RETURN QUERY SELECT false, 'insufficient_points'::text, 0;
    RETURN;
  END IF;

  INSERT INTO public.withdrawals(user_id, ton_address, points_spent, ton_amount, status)
  VALUES (_user_id, _ton_address, _points, _ton_amount, 'pending');

  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, -_points, 'withdrawal', 'Withdrawal request: ' || _ton_amount || ' TON');

  RETURN QUERY SELECT true, NULL::text, remaining;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal_atomic(uuid, numeric, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_atomic(uuid, numeric, integer, text) TO authenticated;

-- Admin adjust points (verifies caller is admin)
CREATE OR REPLACE FUNCTION public.admin_adjust_points(_target uuid, _delta integer, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_points integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.profiles
     SET points = GREATEST(0, points + _delta)
   WHERE id = _target
  RETURNING points INTO new_points;

  IF new_points IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_target, _delta, 'admin_adjust', _reason);

  RETURN new_points;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_points(uuid, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_adjust_points(uuid, integer, text) TO authenticated;
