-- Connect accounts get two new emails: a daily alert on days with a
-- High-relevance competitor change, and a monthly recap. Both default on, each
-- has an opt-out switch, and the recap records when it last went out so a
-- re-run of the cron can't send it twice in one month.
alter table accounts add column if not exists connect_daily_alert_enabled boolean not null default true;
alter table accounts add column if not exists connect_monthly_recap_enabled boolean not null default true;
alter table accounts add column if not exists connect_monthly_recap_sent_at timestamptz;
