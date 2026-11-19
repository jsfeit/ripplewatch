-- Any number a customer has about their own business, as a time series.
--
-- Ripplewatch started with fixed kinds of data (deals, churn, customer feedback). Every company also has numbers
-- nobody could list in advance: approval rate by segment, bank-link completion, activation, average limit, time to
-- first draw. The assistant reads them from whatever the customer connected and sends them here as aggregates, one row
-- per metric, segment and period. Raw customer records never need to leave the customer's own systems.
--
-- Each row says what it measures (label, unit) and which direction is good (higher_is), so a change can be described
-- as better or worse without anyone hard-coding the metric. segment is a cohort name ('' when the number covers
-- everyone), kept non-null so re-sending a period updates the row instead of duplicating it. competitor_id is set only
-- when the number is about one competitor (for example customers who mention them).
create table if not exists account_data_points (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  metric text not null check (metric ~ '^[a-z][a-z0-9_]{1,59}$'),
  label text,
  unit text,
  value numeric not null,
  period_start date not null,
  period_days integer not null default 7 check (period_days between 1 and 366),
  segment text not null default '',
  competitor_id uuid references competitors (id) on delete set null,
  higher_is text not null default 'better' check (higher_is in ('better', 'worse', 'neutral')),
  source text not null default 'assistant',
  note text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists account_data_points_period_idx
  on account_data_points (account_id, metric, segment, period_start);

create index if not exists account_data_points_metric_idx
  on account_data_points (account_id, metric, period_start desc);

alter table account_data_points enable row level security;

create policy "users can manage data points for their own account"
  on account_data_points for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());
