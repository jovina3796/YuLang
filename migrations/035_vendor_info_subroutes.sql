-- /vendor-info split into 3 sub-routes for per-tab permission granularity:
-- /vendor-info/vendors, /vendor-info/rates, /vendor-info/subroutes (new).
-- Mirrors migration 031 (which did the same for /people).
-- Migrates existing role_permissions.allowed_pages and
-- user_profiles.allowed_pages entries containing '/vendor-info' so admins
-- and per-user overrides keep their effective access on the old two tabs;
-- the new /vendor-info/subroutes is added on top so existing admins also
-- get the new keyword-mapping tab by default.

-- role_permissions.allowed_pages
UPDATE public.role_permissions
SET allowed_pages = (
  SELECT array_agg(DISTINCT x ORDER BY x)
  FROM unnest(
    array_remove(allowed_pages, '/vendor-info')
    || ARRAY['/vendor-info/vendors','/vendor-info/rates','/vendor-info/subroutes']::text[]
  ) AS x
)
WHERE allowed_pages IS NOT NULL
  AND '/vendor-info' = ANY(allowed_pages);

-- user_profiles.allowed_pages (per-user overrides)
UPDATE public.user_profiles
SET allowed_pages = (
  SELECT array_agg(DISTINCT x ORDER BY x)
  FROM unnest(
    array_remove(allowed_pages, '/vendor-info')
    || ARRAY['/vendor-info/vendors','/vendor-info/rates','/vendor-info/subroutes']::text[]
  ) AS x
)
WHERE allowed_pages IS NOT NULL
  AND '/vendor-info' = ANY(allowed_pages);
