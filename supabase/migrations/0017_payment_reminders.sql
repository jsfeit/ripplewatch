-- Tracks the 2-step "signed up but never finished checkout" email sequence
-- so the cron job sending it can't double-send a step, and knows which
-- accounts have already completed the sequence.
alter table accounts
  add column if not exists payment_reminder_1_sent_at timestamptz,
  add column if not exists payment_reminder_2_sent_at timestamptz;
