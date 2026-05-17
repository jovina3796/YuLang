-- Per-role default allow-set. Admin can edit via /people?tab=permissions.
-- Each user_profiles.allowed_pages is a subset of (or null = inherit) the
-- corresponding row here, validated server-side by sanitizeAllowedPages.
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role          text PRIMARY KEY,
  allowed_pages text[] NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Seed defaults idempotently. Existing rows are not overwritten.
INSERT INTO public.role_permissions (role, allowed_pages) VALUES
  ('admin',  ARRAY[
    '/dashboard','/trips','/vehicles','/people','/schedule',
    '/fuel','/maintenance','/inspection',
    '/reports','/finance','/payroll','/vendor-info',
    '/claims','/leaves','/overtimes','/settings'
  ]),
  ('driver', ARRAY[
    '/dashboard','/payroll','/claims','/leaves','/overtimes'
  ])
ON CONFLICT (role) DO NOTHING;
