-- ============ WALLETS ============
CREATE TABLE public.user_wallets (
  user_id UUID PRIMARY KEY,
  balance_credits BIGINT NOT NULL DEFAULT 0,
  lifetime_purchased_credits BIGINT NOT NULL DEFAULT 0,
  lifetime_granted_credits BIGINT NOT NULL DEFAULT 0,
  lifetime_spent_credits BIGINT NOT NULL DEFAULT 0,
  blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet" ON public.user_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all wallets" ON public.user_wallets
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update wallets" ON public.user_wallets
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_user_wallets_updated
  BEFORE UPDATE ON public.user_wallets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ TRANSACTIONS ============
CREATE TYPE public.credit_txn_type AS ENUM ('purchase','usage','grant','refund','reversal');

CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type public.credit_txn_type NOT NULL,
  credits_delta BIGINT NOT NULL,
  usd_amount NUMERIC(12,4),
  balance_after BIGINT NOT NULL,
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  ai_usage_id UUID,
  actor_user_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_credit_txn_user ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_txn_pi ON public.credit_transactions(stripe_payment_intent) WHERE stripe_payment_intent IS NOT NULL;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions" ON public.credit_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all transactions" ON public.credit_transactions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ============ AI USAGE LOG ============
CREATE TABLE public.ai_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  provider_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  charged_credits BIGINT NOT NULL DEFAULT 0,
  charged_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
  profit_usd NUMERIC(12,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_usage_user ON public.ai_usage_log(user_id, created_at DESC);
CREATE INDEX idx_ai_usage_created ON public.ai_usage_log(created_at DESC);
CREATE INDEX idx_ai_usage_feature ON public.ai_usage_log(feature, created_at DESC);
ALTER TABLE public.ai_usage_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai usage" ON public.ai_usage_log
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all ai usage" ON public.ai_usage_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ============ STRIPE CHECKOUT SESSIONS ============
CREATE TABLE public.stripe_checkout_sessions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  credits BIGINT NOT NULL,
  usd_amount NUMERIC(12,4) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payment_intent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_checkout_user ON public.stripe_checkout_sessions(user_id, created_at DESC);
ALTER TABLE public.stripe_checkout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own checkouts" ON public.stripe_checkout_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all checkouts" ON public.stripe_checkout_sessions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- ============ AUTO-CREATE WALLET ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();

-- Backfill wallets for existing users
INSERT INTO public.user_wallets (user_id)
  SELECT id FROM auth.users
  ON CONFLICT (user_id) DO NOTHING;

-- ============ ATOMIC CHARGE FUNCTION ============
CREATE OR REPLACE FUNCTION public.charge_credits(
  _user_id UUID,
  _credits BIGINT,
  _usd_amount NUMERIC,
  _ai_usage_id UUID,
  _note TEXT
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _new_balance BIGINT;
  _is_blocked BOOLEAN;
BEGIN
  SELECT balance_credits, blocked INTO _new_balance, _is_blocked
  FROM public.user_wallets WHERE user_id = _user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.user_wallets (user_id) VALUES (_user_id);
    _new_balance := 0;
    _is_blocked := false;
  END IF;

  IF _is_blocked THEN
    RAISE EXCEPTION 'wallet_blocked';
  END IF;

  IF _new_balance < _credits THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  _new_balance := _new_balance - _credits;

  UPDATE public.user_wallets
    SET balance_credits = _new_balance,
        lifetime_spent_credits = lifetime_spent_credits + _credits
    WHERE user_id = _user_id;

  INSERT INTO public.credit_transactions
    (user_id, type, credits_delta, usd_amount, balance_after, ai_usage_id, note)
  VALUES
    (_user_id, 'usage', -_credits, _usd_amount, _new_balance, _ai_usage_id, _note);

  RETURN _new_balance;
END; $$;

-- ============ ATOMIC CREDIT FUNCTION ============
CREATE OR REPLACE FUNCTION public.credit_wallet(
  _user_id UUID,
  _credits BIGINT,
  _usd_amount NUMERIC,
  _type public.credit_txn_type,
  _stripe_session_id TEXT,
  _stripe_payment_intent TEXT,
  _actor_user_id UUID,
  _note TEXT
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new_balance BIGINT;
BEGIN
  -- Idempotency: don't double-credit the same Stripe payment
  IF _stripe_payment_intent IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.credit_transactions
    WHERE stripe_payment_intent = _stripe_payment_intent AND type = 'purchase'
  ) THEN
    SELECT balance_credits INTO _new_balance FROM public.user_wallets WHERE user_id = _user_id;
    RETURN COALESCE(_new_balance, 0);
  END IF;

  INSERT INTO public.user_wallets (user_id, balance_credits)
    VALUES (_user_id, _credits)
    ON CONFLICT (user_id) DO UPDATE
      SET balance_credits = public.user_wallets.balance_credits + _credits,
          lifetime_purchased_credits = public.user_wallets.lifetime_purchased_credits
            + CASE WHEN _type = 'purchase' THEN _credits ELSE 0 END,
          lifetime_granted_credits = public.user_wallets.lifetime_granted_credits
            + CASE WHEN _type = 'grant' THEN _credits ELSE 0 END
    RETURNING balance_credits INTO _new_balance;

  INSERT INTO public.credit_transactions
    (user_id, type, credits_delta, usd_amount, balance_after,
     stripe_session_id, stripe_payment_intent, actor_user_id, note)
  VALUES
    (_user_id, _type, _credits, _usd_amount, _new_balance,
     _stripe_session_id, _stripe_payment_intent, _actor_user_id, _note);

  RETURN _new_balance;
END; $$;