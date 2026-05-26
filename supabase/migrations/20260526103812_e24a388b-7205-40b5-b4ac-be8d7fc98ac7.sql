
-- 1) Remove user-supplied _amount from ad/bonus reward RPCs; hardcode rewards.
DROP FUNCTION IF EXISTS public.claim_ad_reward_atomic(uuid, text, integer);
DROP FUNCTION IF EXISTS public.claim_bonus_reward_atomic(uuid, integer);

CREATE OR REPLACE FUNCTION public.claim_ad_reward_atomic(_user_id uuid, _ad_type text)
 RETURNS TABLE(ok boolean, reason text, points integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recent integer;
  new_pts integer;
  reward constant integer := 20;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':ad', 0));
  SELECT count(*) INTO recent FROM public.ad_views
    WHERE user_id = _user_id AND created_at > now() - interval '1 minute';
  IF recent > 0 THEN RETURN QUERY SELECT false, 'rate_limited'::text, 0; RETURN; END IF;
  INSERT INTO public.ad_views(user_id, ad_type) VALUES (_user_id, _ad_type);
  UPDATE public.profiles p SET points = GREATEST(0, p.points + reward)
    WHERE p.id = _user_id RETURNING p.points INTO new_pts;
  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, reward, 'ad_view', 'Watched ' || _ad_type);
  RETURN QUERY SELECT true, NULL::text, new_pts;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_bonus_reward_atomic(_user_id uuid)
 RETURNS TABLE(ok boolean, reason text, points integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  recent integer;
  new_pts integer;
  reward constant integer := 10;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':bonus', 0));
  SELECT count(*) INTO recent FROM public.ad_views
    WHERE user_id = _user_id AND ad_type = 'bonus_click'
      AND created_at > now() - interval '30 seconds';
  IF recent > 0 THEN RETURN QUERY SELECT false, 'rate_limited'::text, 0; RETURN; END IF;
  INSERT INTO public.ad_views(user_id, ad_type) VALUES (_user_id, 'bonus_click');
  UPDATE public.profiles p SET points = GREATEST(0, p.points + reward)
    WHERE p.id = _user_id RETURNING p.points INTO new_pts;
  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, reward, 'bonus', 'Bonus ad click');
  RETURN QUERY SELECT true, NULL::text, new_pts;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.claim_ad_reward_atomic(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward_atomic(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_bonus_reward_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_bonus_reward_atomic(uuid) TO authenticated;

-- 2) Drop client-side profile UPDATE policies. All mutations go through SECURITY DEFINER RPCs.
DROP POLICY IF EXISTS "profiles update own" ON public.profiles;
DROP POLICY IF EXISTS "profiles admin update" ON public.profiles;

-- 3) Drop client-side withdrawals INSERT policy. Inserts go through request_withdrawal_v2 RPC.
DROP POLICY IF EXISTS "withdrawals insert own" ON public.withdrawals;

-- 4) Lock down all SECURITY DEFINER RPCs from anon/public.
REVOKE EXECUTE ON FUNCTION public.claim_daily_checkin(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_checkin(uuid, integer) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_task(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal_v2(uuid, text, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_v2(uuid, text, text, numeric) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal_atomic(uuid, numeric, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal_atomic(uuid, numeric, integer, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_points(uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_points(uuid, integer, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_process_withdrawal(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_process_withdrawal(uuid, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_points(uuid, integer) FROM PUBLIC, anon, authenticated;
