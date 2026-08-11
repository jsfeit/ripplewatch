-- Stores the once-a-week synthesized "verdict" so it can be reused by both
-- the weekly digest email and the News dashboard banner instead of
-- generating it twice (see /api/cron/digest-weekly and dashboard/page.tsx).
alter table accounts
  add column if not exists weekly_verdict text,
  add column if not exists weekly_verdict_generated_at timestamptz;
