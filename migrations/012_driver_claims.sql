-- Driver claims: 司機請款 (停車費 / 罰單 / 消耗品報銷 etc.) with approval workflow.
-- Lifecycle: pending → approved → paid  (or rejected)
create table if not exists public.driver_claims (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references public.drivers(id) on delete cascade,
  claim_type    text not null check (claim_type in ('parking', 'fine', 'supply', 'other')),
  category      text,
  amount        numeric not null check (amount >= 0),
  occurred_at   date not null,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'paid')),
  reviewed_by   text,
  reviewed_at   timestamptz,
  reject_reason text,
  paid_at       date,
  receipt_url   text,
  notes         text,
  -- When approved, the matching misc_transactions row id (so paid status stays in sync).
  misc_tx_id    uuid references public.misc_transactions(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_driver_claims_driver on public.driver_claims(driver_id);
create index if not exists idx_driver_claims_status on public.driver_claims(status);
