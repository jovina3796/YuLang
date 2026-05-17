-- Trips: persist 加成 flag (currently only computed in form, not stored).
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS is_special boolean NOT NULL DEFAULT false;
