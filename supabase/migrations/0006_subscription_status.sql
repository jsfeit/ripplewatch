-- Tracks Stripe's subscription lifecycle status (active, past_due, canceled,
-- unpaid, etc) so billing health is visible in Settings/admin without going
-- to the Stripe dashboard for every account.
alter table accounts add column if not exists subscription_status text;
