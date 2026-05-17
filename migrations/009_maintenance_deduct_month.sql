-- Maintenance: explicit deduction month (which month's run-cost this should be counted in)
ALTER TABLE maintenance_logs
  ADD COLUMN IF NOT EXISTS deduct_month date;
