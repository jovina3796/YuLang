-- Optional explicit deduction month for misc transactions.
-- When set, the expense is counted in this month's deduction stats instead of transaction_date's month.
ALTER TABLE misc_transactions
  ADD COLUMN IF NOT EXISTS deduct_month date;
