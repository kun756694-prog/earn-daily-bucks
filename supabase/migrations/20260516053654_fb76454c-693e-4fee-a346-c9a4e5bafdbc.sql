
CREATE OR REPLACE FUNCTION public.admin_process_withdrawal(_withdrawal_id uuid, _action text, _note text DEFAULT NULL)
RETURNS TABLE(ok boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.withdrawals%ROWTYPE;
  new_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF _action NOT IN ('approve','reject') THEN
    RETURN QUERY SELECT false, 'invalid_action'::text; RETURN;
  END IF;

  SELECT * INTO w FROM public.withdrawals WHERE id = _withdrawal_id FOR UPDATE;
  IF w.id IS NULL THEN
    RETURN QUERY SELECT false, 'not_found'::text; RETURN;
  END IF;
  IF w.status <> 'pending' THEN
    RETURN QUERY SELECT false, 'already_processed'::text; RETURN;
  END IF;

  IF _action = 'approve' THEN
    new_status := 'success';
  ELSE
    new_status := 'rejected';
    UPDATE public.profiles SET points = points + w.points_spent WHERE id = w.user_id;
    INSERT INTO public.points_transactions(user_id, amount, type, reason)
    VALUES (w.user_id, w.points_spent, 'refund', 'Withdrawal rejected refund');
  END IF;

  UPDATE public.withdrawals
     SET status = new_status, processed_at = now(), admin_note = _note
   WHERE id = _withdrawal_id;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;
