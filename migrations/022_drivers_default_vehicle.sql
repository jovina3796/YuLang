-- Default vehicle per driver. Used when daily schedule has no vehicle assigned
-- (e.g. LINE quick fuel report needs to infer the vehicle).
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS default_vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_drivers_default_vehicle_id ON public.drivers(default_vehicle_id);
