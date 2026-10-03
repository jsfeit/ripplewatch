-- Lifecycle emails for Connect accounts: a day-2 "here's what we found" and a
-- day-7 check-in, each sent at most once, plus a per-account opt-out. The
-- existing drip tracks leads (pre-signup); these track paying accounts.
alter table accounts add column if not exists onboarding_email_day2_sent_at timestamptz;
alter table accounts add column if not exists onboarding_email_day7_sent_at timestamptz;
alter table accounts add column if not exists onboarding_emails_unsubscribed_at timestamptz;
