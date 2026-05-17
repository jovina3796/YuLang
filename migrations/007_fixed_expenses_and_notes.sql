-- Fixed monthly expenses (e.g. GPS 月租, 靠行費, 保險月扣)
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  category    text,
  amount      numeric(12,2) NOT NULL,
  vehicle_id  uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  notes       text,
  active      boolean NOT NULL DEFAULT true,
  start_month date,
  end_month   date,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fixed_expenses_active ON fixed_expenses(active);

-- Company-wide shared notes (memo / 備忘錄 on dashboard)
CREATE TABLE IF NOT EXISTS notes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content       text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_order ON notes(display_order, created_at);
