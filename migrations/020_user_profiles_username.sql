-- 020: username column for user_profiles
-- Allows login by username in addition to email.
-- Lowercase letters/digits + underscore/dot, 3-30 chars; case-insensitive uniqueness.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS username text;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_username_format;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_username_format
  CHECK (username IS NULL OR username ~ '^[a-z0-9._]{3,30}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_username_lower
  ON public.user_profiles (lower(username))
  WHERE username IS NOT NULL;
