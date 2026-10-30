-- Recent competitor lookups for the free read, one row per domain. The same big competitors get
-- named again and again by different visitors, and the lookup (news search, pricing page, a year of
-- pricing history) is what costs money, so a lookup under two days old is reused instead of redone.
-- Written and read by the server with the service role only, so RLS is on with no policies. A row is
-- replaced the next time its domain is looked up; a stale row is simply ignored.
create table if not exists snapshot_cache (
  domain text primary key,
  result jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table snapshot_cache enable row level security;
