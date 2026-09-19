-- Who signed in and what they open, for Admin -> Users / Accounts.
--
-- Supabase Auth already keeps created_at (sign-up) and last_sign_in_at, but
-- not a count of sign-ins or anything about what a person does afterwards.
--   login   one row per explicit sign-in on the login form
--   view    one row per in-app page a signed-in customer opens
--           (path is the feature route, e.g. /app/win-loss, never a query
--           string or an id)
-- Written and read only through the service-role client (no RLS policies),
-- same as llm_usage. Admin "view as" sessions never write here.
create table if not exists user_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  account_id uuid references accounts (id) on delete cascade,
  kind text not null check (kind in ('login', 'view')),
  path text,
  created_at timestamptz not null default now()
);

create index if not exists user_activity_user_idx on user_activity (user_id, created_at desc);
create index if not exists user_activity_account_idx on user_activity (account_id, created_at desc);

alter table user_activity enable row level security;
