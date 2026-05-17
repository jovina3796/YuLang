-- Misc transactions: receipt/photo URL (parking receipts, fines, insurance docs, etc.)
ALTER TABLE misc_transactions
  ADD COLUMN IF NOT EXISTS receipt_url text;

-- Create the storage bucket in Supabase Dashboard manually:
--   Name: misc-receipts
--   Public: true (or set RLS as desired)
