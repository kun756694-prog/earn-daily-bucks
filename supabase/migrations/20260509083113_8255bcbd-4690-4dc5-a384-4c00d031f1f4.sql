
CREATE OR REPLACE FUNCTION public.claim_bonus_reward_atomic(_user_id uuid, _amount integer)
 RETURNS TABLE(ok boolean, reason text, points integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE recent integer; new_pts integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':bonus', 0));
  SELECT count(*) INTO recent FROM public.ad_views
    WHERE user_id = _user_id AND ad_type = 'bonus_click'
      AND created_at > now() - interval '30 seconds';
  IF recent > 0 THEN RETURN QUERY SELECT false, 'rate_limited'::text, 0; RETURN; END IF;
  INSERT INTO public.ad_views(user_id, ad_type) VALUES (_user_id, 'bonus_click');
  UPDATE public.profiles p SET points = GREATEST(0, p.points + _amount)
    WHERE p.id = _user_id RETURNING p.points INTO new_pts;
  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, _amount, 'bonus', 'Bonus ad click');
  RETURN QUERY SELECT true, NULL::text, new_pts;
END; $function$;

CREATE OR REPLACE FUNCTION public.claim_ad_reward_atomic(_user_id uuid, _ad_type text, _amount integer)
 RETURNS TABLE(ok boolean, reason text, points integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE recent integer; new_pts integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':ad', 0));
  SELECT count(*) INTO recent FROM public.ad_views
    WHERE user_id = _user_id AND created_at > now() - interval '1 minute';
  IF recent > 0 THEN RETURN QUERY SELECT false, 'rate_limited'::text, 0; RETURN; END IF;
  INSERT INTO public.ad_views(user_id, ad_type) VALUES (_user_id, _ad_type);
  UPDATE public.profiles p SET points = GREATEST(0, p.points + _amount)
    WHERE p.id = _user_id RETURNING p.points INTO new_pts;
  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, _amount, 'ad_view', 'Watched ' || _ad_type);
  RETURN QUERY SELECT true, NULL::text, new_pts;
END; $function$;

CREATE OR REPLACE FUNCTION public.claim_task_reward_atomic(_user_id uuid, _task_id text, _amount integer)
 RETURNS TABLE(ok boolean, reason text, points integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE ad_key text := 'task_' || _task_id; started timestamptz; new_pts integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT started_at INTO started FROM public.task_starts
    WHERE user_id = _user_id AND task_id = _task_id;
  IF started IS NULL THEN RETURN QUERY SELECT false, 'not_started'::text, 0; RETURN; END IF;
  IF started > now() - interval '15 seconds' THEN RETURN QUERY SELECT false, 'too_soon'::text, 0; RETURN; END IF;
  BEGIN
    INSERT INTO public.ad_views(user_id, ad_type) VALUES (_user_id, ad_key);
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'already_claimed'::text, 0; RETURN;
  END;
  UPDATE public.profiles p SET points = GREATEST(0, p.points + _amount)
    WHERE p.id = _user_id RETURNING p.points INTO new_pts;
  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, _amount, 'task', 'Completed ' || _task_id);
  RETURN QUERY SELECT true, NULL::text, new_pts;
END; $function$;
