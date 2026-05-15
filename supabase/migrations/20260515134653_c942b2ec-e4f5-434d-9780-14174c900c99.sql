
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS method text NOT NULL DEFAULT 'ton',
  ADD COLUMN IF NOT EXISTS payout_details text;

UPDATE public.withdrawals SET payout_details = ton_address WHERE payout_details IS NULL;

ALTER TABLE public.withdrawals ALTER COLUMN ton_address DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.request_withdrawal_v2(
  _user_id uuid,
  _method text,
  _payout_details text,
  _amount_units numeric
)
RETURNS TABLE(ok boolean, reason text, new_points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pending_count integer;
  remaining integer;
  points_per_unit constant integer := 10000;
  expected_points integer;
  details_ok boolean := false;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _method NOT IN ('wave','kbzpay','tng','duitnow','ton') THEN
    RETURN QUERY SELECT false, 'invalid_method'::text, 0; RETURN;
  END IF;

  IF _amount_units IS NULL OR _amount_units < 1 OR _amount_units > 100000 THEN
    RETURN QUERY SELECT false, 'invalid_amount'::text, 0; RETURN;
  END IF;

  IF _payout_details IS NULL THEN
    RETURN QUERY SELECT false, 'invalid_details'::text, 0; RETURN;
  END IF;

  IF _method IN ('wave','kbzpay','tng') THEN
    details_ok := length(_payout_details) BETWEEN 6 AND 20 AND _payout_details ~ '^[0-9+\- ]+$';
  ELSIF _method = 'duitnow' THEN
    details_ok := length(_payout_details) BETWEEN 5 AND 40 AND _payout_details ~ '^[A-Za-z0-9@._\-+ ]+$';
  ELSIF _method = 'ton' THEN
    details_ok := length(_payout_details) BETWEEN 40 AND 80 AND _payout_details ~ '^[A-Za-z0-9_-]+$';
  END IF;

  IF NOT details_ok THEN
    RETURN QUERY SELECT false, 'invalid_details'::text, 0; RETURN;
  END IF;

  expected_points := (_amount_units * points_per_unit)::integer;

  SELECT count(*) INTO pending_count FROM public.withdrawals
   WHERE user_id = _user_id AND status = 'pending';
  IF pending_count > 0 THEN
    RETURN QUERY SELECT false, 'pending_exists'::text, 0; RETURN;
  END IF;

  UPDATE public.profiles
     SET points = points - expected_points
   WHERE id = _user_id AND points >= expected_points
  RETURNING points INTO remaining;

  IF remaining IS NULL THEN
    RETURN QUERY SELECT false, 'insufficient_points'::text, 0; RETURN;
  END IF;

  INSERT INTO public.withdrawals(user_id, method, payout_details, ton_address, points_spent, ton_amount, status)
  VALUES (
    _user_id, _method, _payout_details,
    CASE WHEN _method = 'ton' THEN _payout_details ELSE NULL END,
    expected_points, _amount_units, 'pending'
  );

  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, -expected_points, 'withdrawal',
    'Withdrawal via ' || _method || ': ' || _amount_units);

  RETURN QUERY SELECT true, NULL::text, remaining;
END;
$function$;
