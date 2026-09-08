-- Per-account schedule for the weekly Slack digest (separate from the
-- always-Monday-15:00-UTC weekly email cron): a day-of-week + hour in the
-- account's own IANA timezone, checked by an hourly cron rather than a
-- single fixed-UTC trigger. Defaults to Sunday night (day 0, hour 20) in
-- UTC until an account sets its own timezone, matching the product's
-- stated default of "Sunday night, the user's local time."
alter table accounts add column if not exists timezone text not null default 'UTC';
alter table accounts add column if not exists slack_digest_day smallint not null default 0
  check (slack_digest_day between 0 and 6); -- 0 = Sunday .. 6 = Saturday, JS Date#getDay() convention
alter table accounts add column if not exists slack_digest_hour smallint not null default 20
  check (slack_digest_hour between 0 and 23);

-- Last successful weekly-Slack-digest send, used to guard against sending
-- twice in the same account-local week if the hourly cron's local-time
-- match window and a manual/backfill run ever overlap.
alter table accounts add column if not exists slack_digest_sent_at timestamptz;
