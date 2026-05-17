-- Per-vendor billing cycle + payment delay
-- billing_cycle_start_day: day-of-month when the billing period begins.
--   1  => natural month (1st ~ end of month)
--   26 => previous month 26th ~ current month 25th (e.g. 全台)
-- payment_delay_months: months between billing-period close and payment.
--   0 => paid same month it closes
--   1 => paid the following month
--   2 => paid two months after close (e.g. April period closes -> paid in June)
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS billing_cycle_start_day int NOT NULL DEFAULT 1
    CHECK (billing_cycle_start_day BETWEEN 1 AND 28),
  ADD COLUMN IF NOT EXISTS payment_delay_months    int NOT NULL DEFAULT 2
    CHECK (payment_delay_months BETWEEN 0 AND 6);
