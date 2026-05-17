-- User profiles: role-based access on top of Supabase Auth.
-- Each auth.users row has exactly one profile.
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('admin', 'driver')),
  driver_id   uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  display_name text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_driver_id ON public.user_profiles(driver_id);
