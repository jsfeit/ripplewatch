-- Structured current-state hiring snapshot per competitor — same shape and
-- role as competitor_seo/competitor_pricing: `signals` (type='job_posting')
-- already tracks new-listing events over time, this table holds the latest
-- full reading (how many roles are open right now, and roughly what
-- departments) for a dashboard-style view. Populated by the same daily
-- careers-page scrape that already produces job_posting signals (see
-- checkJobPostingsDiff in src/lib/scraping.ts) — no new data source, just a
-- second thing written from a scrape that was already happening.
create table if not exists competitor_hiring (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null unique references competitors (id) on delete cascade,
  open_role_count integer not null,
  department_breakdown jsonb not null default '{}',
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table competitor_hiring enable row level security;

-- Writes only ever happen from the cron crawl route via the service-role
-- client (bypasses RLS), same as competitor_seo/competitor_pricing — this
-- policy is read-only.
create policy "users can read hiring data for their account's competitors"
  on competitor_hiring for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );
