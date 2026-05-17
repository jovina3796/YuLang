-- Per-resource data scope ('all' vs 'self') for roles that should only see
-- their own records on certain pages (e.g. drivers viewing /trips).
-- Stored as jsonb so future resources (claims, leaves, payroll, ...) can be
-- added without further schema migrations.
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS data_scope jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed defaults idempotently. Only fills rows that are still empty so
-- re-running this migration won't overwrite admin-edited values.
UPDATE public.role_permissions
SET data_scope = '{"trips":"all"}'::jsonb
WHERE role = 'admin' AND (data_scope IS NULL OR data_scope = '{}'::jsonb);

UPDATE public.role_permissions
SET data_scope = '{"trips":"self"}'::jsonb
WHERE role = 'driver' AND (data_scope IS NULL OR data_scope = '{}'::jsonb);
