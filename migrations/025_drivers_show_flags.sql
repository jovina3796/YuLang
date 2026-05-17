-- Driver visibility flags. Two independent toggles for whether a driver
-- appears on the dashboard's 人員管理 card and on the schedule page.
-- A trigger flips both off when status changes to 'inactive', so離職司機
-- automatically disappear from those views (admin can still flip back if needed).
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS show_in_dashboard boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_schedule  boolean NOT NULL DEFAULT true;

-- Auto-hide on inactive
CREATE OR REPLACE FUNCTION public.drivers_sync_visibility()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'inactive' THEN
    NEW.show_in_dashboard := false;
    NEW.show_in_schedule  := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_drivers_sync_visibility ON public.drivers;
CREATE TRIGGER trg_drivers_sync_visibility
  BEFORE INSERT OR UPDATE OF status ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.drivers_sync_visibility();
