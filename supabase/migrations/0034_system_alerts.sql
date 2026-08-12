-- Dedup cooldown for org-wide ops alerts (e.g. Anthropic credit exhaustion
-- — see maybeAlertCreditExhaustion in anthropic.ts). Not account-scoped
-- like cost_alert_sent_month, since this fires per outage, not per tenant.
-- Service-role only, same treatment as llm_usage: RLS enabled, no policy.
create table if not exists system_alerts (
  key text primary key,
  last_sent_at timestamptz not null default now()
);

alter table system_alerts enable row level security;
