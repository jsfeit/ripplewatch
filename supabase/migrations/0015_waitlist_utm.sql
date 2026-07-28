-- Captures which campaign/channel a waitlist signup came from, so outbound
-- links (launch email, LinkedIn, Product Hunt, paid spend) can be
-- attributed once there's enough volume to compare.
alter table waitlist_signups
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;
