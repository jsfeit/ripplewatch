-- Who an account sells to, its website, and churn and growth over time.
--
-- sells_to lets the assistant, onboarding and relevance scoring all know whether an
-- account sells to businesses, consumers or both. Until now that lived nowhere, so a
-- consumer company was asked for "deals" and the assistant could not tell the difference.
-- website is what the company overview and the sells_to default are read from, and
-- company_overview keeps the short summary shown back to the customer.
--
-- customer_metrics holds churn and growth as numbers over time, one row per period.
-- Most consumer companies cannot say why each customer left (or whether they also use a
-- competitor), but they do know their churn rate and customer counts. Any of the number
-- columns can be null: churn_pct can be given directly, or worked out from
-- cancelled_customers / customers_start. segment is 'business' or 'consumer' so a company
-- that sells to both keeps the two apart.

alter table accounts add column if not exists website text;
alter table accounts add column if not exists sells_to text;
alter table accounts add column if not exists company_overview text;

alter table accounts drop constraint if exists accounts_sells_to_check;
alter table accounts add constraint accounts_sells_to_check
  check (sells_to is null or sells_to in ('business', 'consumer', 'both'));

create table if not exists customer_metrics (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  segment text not null default 'consumer' check (segment in ('business', 'consumer')),
  period_start date not null,
  customers_start integer check (customers_start is null or customers_start >= 0),
  new_customers integer check (new_customers is null or new_customers >= 0),
  cancelled_customers integer check (cancelled_customers is null or cancelled_customers >= 0),
  customers_end integer check (customers_end is null or customers_end >= 0),
  revenue numeric check (revenue is null or revenue >= 0),
  churn_pct numeric check (churn_pct is null or (churn_pct >= 0 and churn_pct <= 100)),
  source text not null default 'manual',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One row per account, side and month: re-sending a month updates it instead of duplicating.
create unique index if not exists customer_metrics_period_idx
  on customer_metrics (account_id, segment, period_start);

alter table customer_metrics enable row level security;

create policy "users can manage metrics for their own account"
  on customer_metrics for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());
