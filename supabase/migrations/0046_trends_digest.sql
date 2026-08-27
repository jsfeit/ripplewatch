-- Cached weekly momentum takeaway ("X is hiring aggressively, Y is
-- cooling") shown at the top of the Dashboard's Trends section, generated
-- by generateMomentumDigest() in the same digest-weekly cron run that
-- already computes weekly_verdict — same staleness-gated read pattern
-- (see VERDICT_STALE_MS in dashboard/page.tsx) applied to a second column
-- rather than overloading weekly_verdict with a second, different kind of
-- takeaway.
alter table accounts add column if not exists trends_digest text;
alter table accounts add column if not exists trends_digest_generated_at timestamptz;
