-- 30-day retention after cancelling: when the subscription was cancelled, and
-- when the "your data will be deleted" notice went out. /api/cron/retention
-- deletes an account's data 30 days after canceled_at (only when
-- RETENTION_DELETE_ENABLED=true; otherwise it just reports what it would do).
alter table accounts add column if not exists canceled_at timestamptz;
alter table accounts add column if not exists retention_notice_sent_at timestamptz;

-- Accounts already cancelled get a fresh 30 days from now, never an immediate deletion.
update accounts set canceled_at = now() where subscription_status = 'canceled' and canceled_at is null;

create index if not exists accounts_canceled_at_idx on accounts (canceled_at) where canceled_at is not null;
