-- Add receipt_url column to fuel_logs / driver_leaves / driver_overtimes
-- so single-receipt uploads can be attached to each record.

ALTER TABLE public.fuel_logs       ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE public.driver_leaves   ADD COLUMN IF NOT EXISTS receipt_url text;
ALTER TABLE public.driver_overtimes ADD COLUMN IF NOT EXISTS receipt_url text;
