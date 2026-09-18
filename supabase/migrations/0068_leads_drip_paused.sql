-- Lets an admin stop the automated lead-drip emails for one lead — the case
-- that prompted this: a cold-outreach prospect replied to a founder-written
-- email and started using the competitor snapshot tool, which captured them
-- as a lead, so the daily lead-drip cron would have started sending them
-- automated "finish signing up" nudges in the middle of a real
-- conversation. The cron skips any lead with this set (see
-- /api/cron/lead-drip); nothing else about the lead changes.
alter table leads add column if not exists drip_paused_at timestamptz;
