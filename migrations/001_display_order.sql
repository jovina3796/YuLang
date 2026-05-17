-- Add display_order to entities used in dropdowns and rate-rule rows.
-- Lower numbers appear first; NULLs sort last (fall back to name).

ALTER TABLE vendors            ADD COLUMN IF NOT EXISTS display_order int;
ALTER TABLE drivers            ADD COLUMN IF NOT EXISTS display_order int;
ALTER TABLE vehicles           ADD COLUMN IF NOT EXISTS display_order int;
ALTER TABLE vendor_rate_rules  ADD COLUMN IF NOT EXISTS display_order int;

CREATE INDEX IF NOT EXISTS idx_vendors_display_order            ON vendors            (display_order);
CREATE INDEX IF NOT EXISTS idx_drivers_display_order            ON drivers            (display_order);
CREATE INDEX IF NOT EXISTS idx_vehicles_display_order           ON vehicles           (display_order);
CREATE INDEX IF NOT EXISTS idx_vendor_rate_rules_display_order  ON vendor_rate_rules  (display_order);
