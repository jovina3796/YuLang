-- Driver leaves & overtimes: simple approval workflow (pending → approved / rejected).
-- Overtime pay goes to payroll; this table only records hours + approval state.

create table if not exists public.driver_leaves (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references public.drivers(id) on delete cascade,
  leave_type    text not null check (leave_type in ('sick', 'personal', 'annual', 'other')),
  start_date    date not null,
  end_date      date not null,
  hours         numeric,
  reason        text,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  reviewed_by   text,
  reviewed_at   timestamptz,
  reject_reason text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_driver_leaves_driver on public.driver_leaves(driver_id);
create index if not exists idx_driver_leaves_status on public.driver_leaves(status);

create table if not exists public.driver_overtimes (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references public.drivers(id) on delete cascade,
  work_date     date not null,
  hours         numeric not null check (hours > 0),
  reason        text,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  reviewed_by   text,
  reviewed_at   timestamptz,
  reject_reason text,
  notes         text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_driver_overtimes_driver on public.driver_overtimes(driver_id);
create index if not exists idx_driver_overtimes_status on public.driver_overtimes(status);
