-- Append-only history of scalar competitor state readings (open role count,
-- lowest public price), one row per crawl per metric. competitor_hiring and
-- competitor_pricing are upsert-only snapshot tables (see their own
-- migrations) — they answer "what's true right now" but keep no history, so
-- momentum's hiring/pricing components could only ever measure how many
-- discrete signal events fired, never the actual magnitude of change (a
-- competitor adding 1 role and one adding 40 looked identical). This table
-- lets computeMomentum compare real values across two windows instead of
-- just counting events. Populated alongside the existing upserts in
-- checkJobPostingsDiff/checkPricingStructure (src/lib/scraping.ts) — no new
-- scrape, just one more row written from data already being fetched.
create table if not exists competitor_state_history (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors (id) on delete cascade,
  metric text not null check (metric in ('open_role_count', 'lowest_price')),
  value numeric not null,
  recorded_at timestamptz not null default now()
);

create index if not exists competitor_state_history_lookup_idx
  on competitor_state_history (competitor_id, metric, recorded_at);

alter table competitor_state_history enable row level security;

-- Writes only ever happen from the cron crawl route via the service-role
-- client (bypasses RLS), same as competitor_hiring/competitor_pricing —
-- this policy is read-only.
create policy "users can read state history for their account's competitors"
  on competitor_state_history for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );
