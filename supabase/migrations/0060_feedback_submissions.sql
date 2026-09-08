-- In-app feedback/bug reports, submitted from Settings. Same "lead-capture,
-- always emailed, reviewed by hand" model as affiliate_applications
-- (0053_referrals_and_affiliates.sql) rather than a support-ticket system —
-- this always goes straight to the founder, not a queue.
create table if not exists feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_by_email text,
  category text not null default 'general' check (category in ('bug', 'idea', 'general')),
  message text not null,
  page_path text,
  created_at timestamptz not null default now()
);

alter table feedback_submissions enable row level security;
-- No public policies — the API route always inserts via the service-role
-- admin client after authenticating the caller itself; nothing reads this
-- table back through the client (the founder gets it by email, not an
-- in-app view).
