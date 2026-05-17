-- /people split into 3 sub-routes for per-tab permission granularity:
-- /people/drivers, /people/users, /people/permissions.
-- Migrate any existing role_permissions.allowed_pages or
-- user_profiles.allowed_pages entries that contain the legacy '/people' key
-- so admins (and per-user overrides) keep the same effective access.

-- role_permissions.allowed_pages
UPDATE public.role_permissions
SET allowed_pages = (
  SELECT array_agg(DISTINCT x ORDER BY x)
  FROM unnest(
    array_remove(allowed_pages, '/people')
    || ARRAY['/people/drivers','/people/users','/people/permissions']::text[]
  ) AS x
)
WHERE allowed_pages IS NOT NULL
  AND '/people' = ANY(allowed_pages);

-- user_profiles.allowed_pages (per-user overrides)
UPDATE public.user_profiles
SET allowed_pages = (
  SELECT array_agg(DISTINCT x ORDER BY x)
  FROM unnest(
    array_remove(allowed_pages, '/people')
    || ARRAY['/people/drivers','/people/users','/people/permissions']::text[]
  ) AS x
)
WHERE allowed_pages IS NOT NULL
  AND '/people' = ANY(allowed_pages);
