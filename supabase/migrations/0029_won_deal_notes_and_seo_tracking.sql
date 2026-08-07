-- Mirrors lost_deal_notes: a general (not tied to one competitor) win-reason
-- blob, filled by the "general won" bucket of imported win/loss data (no
-- identifiable competitor named, but a real reason) and read by every
-- competitor's fact sheet as supporting whyWeWin context.
alter table accounts add column if not exists won_deal_notes text;

-- New signal category: SEO/traffic tracking (rank + traffic changes on a
-- competitor's domain). Data source is stubbed for now (see
-- src/lib/seo-data.ts) pending a DataForSEO account/API key.
alter table signals drop constraint if exists signals_type_check;
alter table signals add constraint signals_type_check
  check (type in ('pricing', 'job_posting', 'review', 'news', 'funding', 'seo'));

-- No page_snapshots entry needed for SEO: unlike pricing (raw page text,
-- hashed and diffed before an LLM summarizes the change), the traffic data
-- source returns structured metrics directly — diffed as plain numbers
-- against the last competitor_seo row, no raw-text snapshot to hash.

-- Structured current-state SEO/traffic snapshot per competitor — same shape
-- and role as competitor_pricing: `signals` tracks the deltas, this table
-- holds the latest full reading for a dashboard-style view.
create table if not exists competitor_seo (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null unique references competitors (id) on delete cascade,
  organic_traffic_estimate integer,
  traffic_trend text check (traffic_trend in ('up', 'down', 'flat', 'unknown')),
  top_keywords jsonb not null default '[]',
  note text,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table competitor_seo enable row level security;

-- Writes only ever happen from the cron crawl route via the service-role
-- client (bypasses RLS), same as competitor_pricing — this policy is
-- read-only.
create policy "users can read seo data for their account's competitors"
  on competitor_seo for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );
