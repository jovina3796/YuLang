-- Personal profile fields for login accounts. Mirrors driver-side equivalents
-- but is also useful for admin accounts that aren't linked to a driver.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS real_name text,
  ADD COLUMN IF NOT EXISTS phone     text;
