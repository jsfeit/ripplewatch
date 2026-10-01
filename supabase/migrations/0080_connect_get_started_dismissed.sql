-- Tracks whether a Connect account has finished or explicitly skipped the
-- post-checkout get-started flow (MCP connect + optional context setup), so
-- /app/get-started/page.tsx can stop redirecting them back once they're
-- done, independent of whether they filled in positioning/competitors.
alter table accounts add column if not exists connect_get_started_dismissed_at timestamptz;
