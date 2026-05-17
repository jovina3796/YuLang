-- Per-user LINE binding (mirror of drivers.line_user_id, kept in sync).
-- Per-user allowed_pages: null means inherit role default; non-null is an
-- explicit subset of the role's default page set (validated server-side).
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS line_user_id  text,
  ADD COLUMN IF NOT EXISTS allowed_pages text[];

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_line_user_id
  ON public.user_profiles(line_user_id)
  WHERE line_user_id IS NOT NULL;
