
-- 1) Prevent duplicate task claims and provide a stable key for upserts
CREATE UNIQUE INDEX IF NOT EXISTS ad_views_user_task_uniq
  ON public.ad_views(user_id, ad_type)
  WHERE ad_type LIKE 'task_%';

-- 2) Task start tracking for server-side timing enforcement
CREATE TABLE IF NOT EXISTS public.task_starts (
  user_id uuid NOT NULL,
  task_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, task_id)
);

ALTER TABLE public.task_starts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_starts select own" ON public.task_starts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 3) start_task: record/refresh start time
CREATE OR REPLACE FUNCTION public.start_task(_user_id uuid, _task_id text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s timestamptz;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.task_starts(user_id, task_id, started_at)
  VALUES (_user_id, _task_id, now())
  ON CONFLICT (user_id, task_id) DO UPDATE
    SET started_at = CASE
      WHEN public.task_starts.started_at < now() - interval '1 hour' THEN now()
      ELSE public.task_starts.started_at
    END
  RETURNING started_at INTO s;
  RETURN s;
END;
$$;

-- 4) Atomic claim: ad reward (rate-limited, 1 per minute)
CREATE OR REPLACE FUNCTION public.claim_ad_reward_atomic(_user_id uuid, _ad_type text, _amount integer)
RETURNS TABLE(ok boolean, reason text, points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent integer;
  new_pts integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':ad', 0));

  SELECT count(*) INTO recent FROM public.ad_views
    WHERE user_id = _user_id AND created_at > now() - interval '1 minute';
  IF recent > 0 THEN
    RETURN QUERY SELECT false, 'rate_limited'::text, 0;
    RETURN;
  END IF;

  INSERT INTO public.ad_views(user_id, ad_type) VALUES (_user_id, _ad_type);

  UPDATE public.profiles SET points = GREATEST(0, points + _amount)
    WHERE id = _user_id RETURNING points INTO new_pts;

  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, _amount, 'ad_view', 'Watched ' || _ad_type);

  RETURN QUERY SELECT true, NULL::text, new_pts;
END;
$$;

-- 5) Atomic claim: bonus (rate-limited, 1 per 30s)
CREATE OR REPLACE FUNCTION public.claim_bonus_reward_atomic(_user_id uuid, _amount integer)
RETURNS TABLE(ok boolean, reason text, points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent integer;
  new_pts integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':bonus', 0));

  SELECT count(*) INTO recent FROM public.ad_views
    WHERE user_id = _user_id AND ad_type = 'bonus_click'
      AND created_at > now() - interval '30 seconds';
  IF recent > 0 THEN
    RETURN QUERY SELECT false, 'rate_limited'::text, 0;
    RETURN;
  END IF;

  INSERT INTO public.ad_views(user_id, ad_type) VALUES (_user_id, 'bonus_click');

  UPDATE public.profiles SET points = GREATEST(0, points + _amount)
    WHERE id = _user_id RETURNING points INTO new_pts;

  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, _amount, 'bonus', 'Bonus ad click');

  RETURN QUERY SELECT true, NULL::text, new_pts;
END;
$$;

-- 6) Atomic claim: task (one per task per user, requires >=15s since start_task)
CREATE OR REPLACE FUNCTION public.claim_task_reward_atomic(_user_id uuid, _task_id text, _amount integer)
RETURNS TABLE(ok boolean, reason text, points integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ad_key text := 'task_' || _task_id;
  started timestamptz;
  new_pts integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT started_at INTO started FROM public.task_starts
    WHERE user_id = _user_id AND task_id = _task_id;
  IF started IS NULL THEN
    RETURN QUERY SELECT false, 'not_started'::text, 0;
    RETURN;
  END IF;
  IF started > now() - interval '15 seconds' THEN
    RETURN QUERY SELECT false, 'too_soon'::text, 0;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.ad_views(user_id, ad_type) VALUES (_user_id, ad_key);
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, 'already_claimed'::text, 0;
    RETURN;
  END;

  UPDATE public.profiles SET points = GREATEST(0, points + _amount)
    WHERE id = _user_id RETURNING points INTO new_pts;

  INSERT INTO public.points_transactions(user_id, amount, type, reason)
  VALUES (_user_id, _amount, 'task', 'Completed ' || _task_id);

  RETURN QUERY SELECT true, NULL::text, new_pts;
END;
$$;

-- 7) Lock down execute privileges
REVOKE EXECUTE ON FUNCTION public.increment_points(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_ad_reward_atomic(uuid, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_bonus_reward_atomic(uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_task_reward_atomic(uuid, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.start_task(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward_atomic(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_bonus_reward_atomic(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_task_reward_atomic(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_task(uuid, text) TO authenticated;
