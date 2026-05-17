-- Per-user UI theme overrides. Stores custom color tokens applied as CSS variables
-- on the dashboard root via inline <style> injection (SSR-safe, no FOUC).
-- Shape: { "bg": "#hex", "bg2": "#hex", "text": "#hex", "text2": "#hex",
--          "border": "#hex", "accent": "#hex", "accent2": "#hex" }
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS theme jsonb;
