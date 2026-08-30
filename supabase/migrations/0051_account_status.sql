-- Admin-controlled account status, separate from subscription_status (which
-- mirrors Stripe's billing lifecycle and is written by webhooks, not admins).
-- Lets support pause a test/demo account without deleting it: every cron
-- that iterates accounts and burns real Anthropic credits or sends email
-- (crawl, digest-daily, digest-weekly, industry-trends,
-- discover-competitors, payment-reminders) skips anything not "active".
alter table accounts add column if not exists status text not null default 'active';
alter table accounts add constraint accounts_status_check check (status in ('active', 'hold', 'cancelled'));
