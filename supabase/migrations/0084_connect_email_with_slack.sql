-- Slack is where a Connect team sees alerts and recaps. Email is the fallback
-- for accounts without Slack, or an explicit extra for those with it: this
-- records that choice. Default false means "Slack only" once Slack is connected.
alter table accounts add column if not exists connect_email_with_slack boolean not null default false;
