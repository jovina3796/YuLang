-- LINE Bot conversation state, keyed by LINE userId.
-- Survives Vercel cold starts (in-memory state would not).
CREATE TABLE IF NOT EXISTS public.line_sessions (
  line_user_id text PRIMARY KEY,
  state        text NOT NULL DEFAULT 'idle',
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_drivers_line_user_id ON public.drivers(line_user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_phone        ON public.drivers(phone);
