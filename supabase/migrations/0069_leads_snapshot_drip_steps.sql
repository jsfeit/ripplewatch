-- Snapshot signups get their own longer follow-up series (6 emails over ~6
-- weeks, see sendSnapshotDripEmail in src/lib/resend.ts) instead of the
-- generic 3-step quiz/onboarding drip, whose copy ("you started setting up
-- Ripplewatch") doesn't fit someone who only tried the free snapshot tool.
-- Steps 1-3 reuse the existing columns; these add tracking for 4-6.
alter table leads add column if not exists drip_email_4_sent_at timestamptz;
alter table leads add column if not exists drip_email_5_sent_at timestamptz;
alter table leads add column if not exists drip_email_6_sent_at timestamptz;
