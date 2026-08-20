-- Tracks a 3-email drip sent to captured leads (quiz, onboarding-abandon)
-- who never signed up, mirroring the payment_reminder_1/2_sent_at columns
-- already on accounts. unsubscribed_at lets a recipient opt out; this is
-- unsolicited marketing email (unlike the payment reminders, which go to
-- someone who already created an account), so an opt-out is necessary, not
-- optional.
alter table leads add column if not exists drip_email_1_sent_at timestamptz;
alter table leads add column if not exists drip_email_2_sent_at timestamptz;
alter table leads add column if not exists drip_email_3_sent_at timestamptz;
alter table leads add column if not exists unsubscribed_at timestamptz;
