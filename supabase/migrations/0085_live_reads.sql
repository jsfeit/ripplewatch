-- One row per free "live read" run on the signup page, before an account exists.
-- Until now nothing about these was kept, so there was no way to see who tried it,
-- on which competitor, what the read said, or whether they went on to sign up.
--
-- account_id starts null and is filled in when the same visitor finishes setup
-- (the browser holds the read's id until then). Written and read only through
-- the service role: visitors are anonymous, and the admin page is the only reader.
create table if not exists live_reads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_name text,
  positioning text,
  icp text,
  competitor_domain text not null,
  competitor_name text,
  -- null when the lookup finished but no read could be written
  confidence text check (confidence in ('evidence', 'thin')),
  evidence text[] not null default '{}',
  read jsonb,
  account_id uuid references accounts (id) on delete set null
);

create index if not exists live_reads_created_idx on live_reads (created_at desc);
create index if not exists live_reads_account_idx on live_reads (account_id);

-- No policies on purpose: with row level security on and nothing granted, only the
-- service role can touch it.
alter table live_reads enable row level security;
