-- Apply before deploying the multi-currency client to a cloud environment.
-- Existing deals were USD; ownership and RLS remain unchanged.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deal_currency text NOT NULL DEFAULT 'USD'
  CHECK (deal_currency IN ('USD', 'TWD', 'EUR', 'JPY', 'GBP'));
