-- Tracks delivery separately from scoring: a signal can be scored well
-- before it's actually sent anywhere, and Slack (real-time) and email
-- (batched) are sent on different schedules, so each needs its own marker
-- to avoid double-sending across cron runs.
alter table signals
  add column if not exists slack_sent_at timestamptz,
  add column if not exists email_digest_sent_at timestamptz;
