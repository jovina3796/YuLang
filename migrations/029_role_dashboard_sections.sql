-- Per-role dashboard section visibility. Lets admin hide sensitive cards
-- (financial KPIs, pending payments, etc.) from non-admin roles.
ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS allowed_dashboard_sections text[];

-- Seed defaults idempotently. Only fills rows that currently have NULL,
-- so re-running this migration won't overwrite admin-edited values.
UPDATE public.role_permissions
SET allowed_dashboard_sections = ARRAY[
  'kpi','recent_trips','maintenance','vehicles','people_approvals',
  'schedule','pending_payments','calendar','notes','login_info'
]
WHERE role = 'admin' AND allowed_dashboard_sections IS NULL;

UPDATE public.role_permissions
SET allowed_dashboard_sections = ARRAY[
  'schedule','calendar','notes','login_info'
]
WHERE role = 'driver' AND allowed_dashboard_sections IS NULL;
