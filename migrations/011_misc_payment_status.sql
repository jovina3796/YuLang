-- Misc transactions: track cash payment status (pending vs paid) for items like 車貸
-- so we can show 待支付 / 已支付 distinctly on the dashboard.
ALTER TABLE misc_transactions
  ADD COLUMN IF NOT EXISTS payment_method  text,
  ADD COLUMN IF NOT EXISTS payment_status  text NOT NULL DEFAULT 'paid'
    CHECK (payment_status IN ('paid', 'pending')),
  ADD COLUMN IF NOT EXISTS due_date        date,
  ADD COLUMN IF NOT EXISTS paid_at         date;

CREATE INDEX IF NOT EXISTS idx_misc_payment_status
  ON misc_transactions (payment_status, due_date);
