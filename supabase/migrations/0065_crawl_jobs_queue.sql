-- Decomposes the crawl from "one request does every competitor for one (or
-- every) account" into small, independently-processed jobs. The old shape
-- ran the whole fan-out inside a single Vercel function invocation bounded
-- by a 300s timeout — fine for a handful of fast competitors, but a genuine
-- ceiling that scales with total competitor/account count, not something a
-- concurrency tweak removes. One competitor's checks (a handful of fetches
-- plus a couple of LLM calls) comfortably finishes in a small fraction of
-- that budget, so shrinking the unit of work to one job = one competitor
-- removes the ceiling entirely: however many competitors or accounts exist,
-- there are just more small jobs, processed a bounded batch at a time by a
-- frequent worker cron (see /api/cron/crawl-worker), instead of one giant
-- job that can outgrow its budget.
--
-- crawl_runs groups a day's jobs for one account so scoring (which pulls
-- CRM/call-transcript data per account, not per competitor — expensive
-- enough that it should run once per day per account, same cadence as
-- today, not once per worker tick) can wait until every job in a run has
-- finished before it runs.
create table crawl_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  total_jobs int not null,
  created_at timestamptz not null default now(),
  scored_at timestamptz
);

create index crawl_runs_account_created_idx on crawl_runs (account_id, created_at desc);
-- Used by the finalize check to cheaply find not-yet-scored runs without
-- scanning every run ever created.
create index crawl_runs_unscored_idx on crawl_runs (created_at) where scored_at is null;

create table crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references crawl_runs(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  competitor_id uuid not null references competitors(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- What the worker's claim query filters/orders by.
create index crawl_jobs_pending_idx on crawl_jobs (created_at) where status = 'pending';
-- What the finalize check joins against to see if a run is fully done.
create index crawl_jobs_run_idx on crawl_jobs (run_id);

-- Only the cron worker and admin recrawl route (both service-role) ever
-- touch these tables — no end-user-facing read/write, so RLS is enabled
-- with no policies (service role bypasses RLS entirely; every other role
-- is fully denied by default), same shape as suggested_competitors before
-- migration 0024 added member-read.
alter table crawl_runs enable row level security;
alter table crawl_jobs enable row level security;

-- SKIP LOCKED lets multiple worker invocations (should one ever overlap —
-- e.g. a slow tick still running when the next one fires) claim disjoint
-- batches instead of racing over the same rows or blocking on each other.
-- Plain SECURITY INVOKER (the default): runs under the caller's own role,
-- so this is exactly as restricted as a direct query would be — service
-- role bypasses RLS as usual, anything else is blocked by RLS with zero
-- rows affected, same as it would be without this function existing.
create or replace function claim_crawl_jobs(batch_size int)
returns setof crawl_jobs
language plpgsql
as $$
begin
  return query
    update crawl_jobs
    set status = 'running', started_at = now()
    where id in (
      select id from crawl_jobs
      where status = 'pending'
      order by created_at
      limit batch_size
      for update skip locked
    )
    returning *;
end;
$$;
