-- Drivers: extended HR fields per spec.
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS employee_no            text,
  ADD COLUMN IF NOT EXISTS birth_date             date,
  ADD COLUMN IF NOT EXISTS id_number              text,
  ADD COLUMN IF NOT EXISTS household_address      text,
  ADD COLUMN IF NOT EXISTS mail_address           text,
  ADD COLUMN IF NOT EXISTS email                  text,
  ADD COLUMN IF NOT EXISTS license_renewal_date   date,
  ADD COLUMN IF NOT EXISTS hire_date              date,
  ADD COLUMN IF NOT EXISTS leave_date             date,
  ADD COLUMN IF NOT EXISTS labor_insurance        text,
  ADD COLUMN IF NOT EXISTS health_insurance       text,
  ADD COLUMN IF NOT EXISTS line_user_id           text;

CREATE INDEX IF NOT EXISTS idx_drivers_employee_no ON public.drivers(employee_no);
