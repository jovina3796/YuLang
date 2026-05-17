-- Drivers: bank info for payroll transfers.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS bank_name    text,
  ADD COLUMN IF NOT EXISTS bank_account text;
