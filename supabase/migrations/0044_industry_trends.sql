-- Many tracked competitors are small enough that there's rarely company-
-- specific news to score, leaving Trends thin for those accounts. This adds
-- a monthly, ICP-scoped market-level pulse (see /api/cron/industry-trends)
-- independent of any single competitor's news volume — same "for all" RLS
-- shape as suggested_competitors (migration 0024): only the cron (service
-- role) writes, members just read their own account's rows.
create table if not exists industry_trends (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  trends jsonb not null default '[]',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists industry_trends_account_generated_idx
  on industry_trends (account_id, generated_at desc);

alter table industry_trends enable row level security;

create policy "users can read their account's industry trends"
  on industry_trends for select
  to authenticated
  using (account_id = auth_account_id());
