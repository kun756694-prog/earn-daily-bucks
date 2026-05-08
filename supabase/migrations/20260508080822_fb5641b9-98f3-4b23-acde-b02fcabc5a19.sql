
CREATE TABLE public.withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ton_address TEXT NOT NULL,
  points_spent INTEGER NOT NULL,
  ton_amount NUMERIC(18,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "withdrawals select own or admin"
  ON public.withdrawals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "withdrawals insert own"
  ON public.withdrawals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "withdrawals admin update"
  ON public.withdrawals FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE INDEX idx_withdrawals_user ON public.withdrawals(user_id, created_at DESC);
