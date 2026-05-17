-- Misc income / expense ledger (其他收支紀錄).
-- Records anything that is not captured by trips, fuel, or maintenance:
-- e.g. parking, tolls, office supplies, refunds, miscellaneous income.

CREATE TABLE IF NOT EXISTS misc_transactions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type             text        NOT NULL CHECK (type IN ('income', 'expense')),
  category         text,
  amount           numeric     NOT NULL,
  description      text,
  transaction_date date        NOT NULL,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_misc_transactions_date ON misc_transactions (transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_misc_transactions_type ON misc_transactions (type);
