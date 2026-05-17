-- Simplify fuel_logs: form keeps 日期/車輛/目前里程/金額/付款方式/備註 only.
-- Adds payment_method + notes; relaxes driver_id and liters to nullable.
ALTER TABLE fuel_logs
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS notes          text;

ALTER TABLE fuel_logs ALTER COLUMN driver_id DROP NOT NULL;
ALTER TABLE fuel_logs ALTER COLUMN liters    DROP NOT NULL;
