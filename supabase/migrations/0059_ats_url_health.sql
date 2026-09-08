-- Tracks consecutive fetch failures for a competitor's pricing/careers URL
-- so a stale or moved URL can self-heal instead of failing silently
-- forever. See trackUrlHealth in src/lib/scraping.ts: after
-- ATS_URL_FAILURE_REDISCOVER_THRESHOLD consecutive misses, discovery is
-- re-run from the homepage and the stored URL is replaced if a different
-- one is found; a single success resets the counter.
alter table competitors add column if not exists careers_fetch_failures smallint not null default 0;
alter table competitors add column if not exists careers_last_failed_at timestamptz;
alter table competitors add column if not exists pricing_fetch_failures smallint not null default 0;
alter table competitors add column if not exists pricing_last_failed_at timestamptz;
