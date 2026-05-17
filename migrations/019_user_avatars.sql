-- 019: user avatar support
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Public bucket for avatars. Safe to re-run.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;
