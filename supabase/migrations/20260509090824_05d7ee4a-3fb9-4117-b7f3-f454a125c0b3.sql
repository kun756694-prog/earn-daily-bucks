CREATE OR REPLACE FUNCTION public.claim_daily_checkin(_user_id uuid, _amount integer)
RETURNS TABLE(claimed boolean, points integer, next_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  updated_row public.profiles%ROWTYPE;
  last_at timestamptz;
  reward_amount constant integer := 10;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.profiles
     SET points = points + reward_amount,
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
$function$;

CREATE OR REPLACE FUNCTION public.request_withdrawal_atomic(_user_id uuid, _ton_amount numeric, _points integer, _ton_address text)
RETURNS TABLE(ok boolean, reason text, new_points integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  pending_count integer;
  remaining integer;
  points_per_ton constant integer := 20000;
  min_ton constant integer := 15;
  expected_points integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _ton_amount IS NULL OR _ton_amount < min_ton OR _ton_amount > 10000 THEN
    RETURN QUERY SELECT false, 'invalid_amount'::text, 0;
    RETURN;
  END IF;

  IF _ton_address IS NULL OR length(_ton_address) < 40 OR length(_ton_address) > 80
     OR _ton_address !~ '^[A-Za-z0-9_-]+$' THEN
    RETURN QUERY SELECT false, 'invalid_address'::text, 0;
    RETURN;
  END IF;

  expected_points := (_ton_amount * points_per_ton)::integer;

  SELECT count(*) INTO pending_count FROM public.withdrawals
   WHERE user_id = _user_id AND status = 'pending';
  IF pending_count > 0 THEN
    RETURN QUERY SELECT false, 'pending_exists'::text, 0;
    RETURN;
  END IF;

  UPDATE public.profiles
     SET points = points - expected_points
   WHERE id = _user_id AND points >= expected_points
  RETURNING points INTO remaining;

  IF remaining IS NULL THEN
    RETURN QUERY SELECT false, 'insufficient_points'::text, 0;
    RETURN;
  END IF;

  INSERT INTO public.withdrawals(user_id, ton_address, points_spent, ton_amount, status)
  VALUES (_user_id, _ton_address, expected_points, _ton_amount, 'pending');

  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, -expected_points, 'withdrawal', 'Withdrawal request: ' || _ton_amount || ' TON');

  RETURN QUERY SELECT true, NULL::text, remaining;
END;
$function$;