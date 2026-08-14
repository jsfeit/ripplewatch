-- Weekly competitor-discovery job (see /api/cron/discover-competitors)
-- surfaces new/emerging companies here for review, separate from the
-- competitors table itself so a suggestion never affects crawling/scoring
-- until the account explicitly adds it. status tracks the review outcome so
-- a dismissed suggestion doesn't keep resurfacing on the next run.
create table if not exists suggested_competitors (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  name text not null,
  domain text,
  category text,
  reasoning text,
  status text not null default 'pending' check (status in ('pending', 'dismissed', 'added')),
  discovered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- One suggestion per (account, name) at a time — the discovery cron checks
-- this before inserting (any existing row, regardless of status, means
-- "already surfaced, don't suggest again"), and this index is the backstop
-- against a duplicate slipping through.
create unique index if not exists suggested_competitors_account_name_idx
  on suggested_competitors (account_id, lower(name));

create index if not exists suggested_competitors_account_status_idx
  on suggested_competitors (account_id, status);

alter table suggested_competitors enable row level security;

-- Members can see and update (dismiss/add-status) their own account's
-- suggestions; only the discovery cron inserts new rows, via the
-- service-role admin client, which bypasses RLS — no insert policy needed
-- for regular users.
drop policy if exists "users can read their account's suggested competitors" on suggested_competitors;
create policy "users can read their account's suggested competitors"
  on suggested_competitors for select
  to authenticated
  using (account_id = auth_account_id());

drop policy if exists "users can update their account's suggested competitors" on suggested_competitors;
create policy "users can update their account's suggested competitors"
  on suggested_competitors for update
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());
