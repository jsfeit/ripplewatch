-- Tags each scored signal with which version of the scoring prompt/schema
-- produced it, so once enough signal_eval_labels accumulate, accuracy can
-- be sliced by prompt version — "did the new prompt actually score better
-- than the old one on the same labeled set" instead of a single blended
-- number across every prompt change ever made.
alter table signals add column if not exists scoring_version text;

-- Dedupes the monthly LLM-cost-over-budget alert (see /api/cron/cost-alert)
-- so an account that's still over threshold on day 2 of being flagged
-- doesn't get emailed again every day for the rest of the month. Stores
-- the month it was last alerted for, e.g. '2026-07' — a new month means a
-- fresh comparison and a fresh chance to alert.
alter table accounts add column if not exists cost_alert_sent_month text;
