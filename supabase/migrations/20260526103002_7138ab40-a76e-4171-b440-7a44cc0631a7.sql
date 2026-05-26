CREATE OR REPLACE FUNCTION public.claim_task_reward_atomic(_user_id uuid, _task_id text, _amount integer)
RETURNS TABLE(ok boolean, reason text, points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ad_key text := 'task_' || _task_id;
  started timestamptz;
  recent_claim timestamptz;
  new_pts integer;
  reward constant integer := 10;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':' || ad_key, 0));

  SELECT started_at INTO started FROM public.task_starts
    WHERE user_id = _user_id AND task_id = _task_id;
  IF started IS NULL THEN
    RETURN QUERY SELECT false, 'not_started'::text, 0; RETURN;
  END IF;
  IF started > now() - interval '30 seconds' THEN
    RETURN QUERY SELECT false, 'too_soon'::text, 0; RETURN;
  END IF;

  SELECT max(created_at) INTO recent_claim FROM public.ad_views
    WHERE user_id = _user_id AND ad_type = ad_key;
  IF recent_claim IS NOT NULL AND recent_claim > now() - interval '30 minutes' THEN
    RETURN QUERY SELECT false, 'cooldown'::text, 0; RETURN;
  END IF;

  INSERT INTO public.ad_views(user_id, ad_type) VALUES (_user_id, ad_key);

  UPDATE public.profiles p SET points = GREATEST(0, p.points + reward)
    WHERE p.id = _user_id RETURNING p.points INTO new_pts;

  IF new_pts IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, reward, 'task', 'Completed ' || _task_id);

  RETURN QUERY SELECT true, NULL::text, new_pts;
END;
$function$;