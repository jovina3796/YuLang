-- Mark exactly one rate rule per service_type as the "default" used by
-- LINE quick text trip reports. When a driver types a token like 「低鮮」
-- (no destination/stop info), the parser picks the rate rule flagged here
-- as the default for that service_type.
--
-- Schema:
--   vendor_rate_rules.is_service_default boolean default false
--
-- Constraint:
--   At most one active row per service_type may be flagged as default.
--   Enforced via partial unique index (only where is_service_default = true).

ALTER TABLE public.vendor_rate_rules
  ADD COLUMN IF NOT EXISTS is_service_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_rate_rules_service_default_unique
  ON public.vendor_rate_rules (service_type)
  WHERE is_service_default = true;
