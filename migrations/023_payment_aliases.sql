-- Payment method aliases. Maps a user-typed keyword (e.g. "阿哲卡", "簽單")
-- to the canonical payment_method stored in fuel_logs / misc_transactions.
-- Used by the LINE Bot quick fuel report to resolve free-form payment input.
CREATE TABLE IF NOT EXISTS public.payment_aliases (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias      text NOT NULL UNIQUE,
  target     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_aliases_alias ON public.payment_aliases(alias);
