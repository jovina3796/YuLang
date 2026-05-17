-- Vehicles: category, manufacture_date, inspection dates; status restricted to 3 values.
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS category             text,
  ADD COLUMN IF NOT EXISTS manufacture_date     date,
  ADD COLUMN IF NOT EXISTS last_inspection_date date,
  ADD COLUMN IF NOT EXISTS next_inspection_date date;

-- Migrate prior status values to the new 3-state space.
UPDATE vehicles SET status = 'active' WHERE status = 'standby';

-- Backfill manufacture_date from year column (mid-year guess) for existing rows.
UPDATE vehicles
SET manufacture_date = make_date(year, 1, 1)
WHERE manufacture_date IS NULL AND year IS NOT NULL;
