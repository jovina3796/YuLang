-- Inspection log table — records each vehicle inspection event
create table if not exists public.inspection_logs (
  id                uuid primary key default gen_random_uuid(),
  vehicle_id        uuid not null references public.vehicles(id) on delete cascade,
  inspected_at      date not null,
  result            text,                       -- e.g. 通過 / 複驗 / 不合格
  fee               numeric,
  vendor_name       text,
  mileage_at_service integer,
  next_due_date     date,
  license_url       text,                       -- 行照圖片
  receipt_url       text,                       -- 收據圖片/PDF
  deduct_month      date,
  notes             text,
  created_at        timestamptz not null default now()
);

create index if not exists inspection_logs_vehicle_id_idx on public.inspection_logs(vehicle_id);
create index if not exists inspection_logs_inspected_at_idx on public.inspection_logs(inspected_at);
