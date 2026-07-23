-- Ripplewatch core schema.
-- Run via `supabase db push` (Supabase CLI) or paste into the SQL editor
-- of a Supabase project once one exists — see .env.example for the keys
-- this app needs once the project is live.

create extension if not exists "pgcrypto";

-- Waitlist ------------------------------------------------------------

create table if not exists waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  company_name text,
  created_at timestamptz not null default now()
);

alter table waitlist_signups enable row level security;

-- Anyone (including anonymous visitors) can join the waitlist. Reading
-- the list back is an admin-only operation done via the service-role
-- client in /admin, which bypasses RLS entirely, so no select policy
-- is defined here.
create policy "anyone can join the waitlist"
  on waitlist_signups for insert
  to anon, authenticated
  with check (true);

-- Accounts (one per customer workspace) --------------------------------

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  positioning text,
  icp text,
  has_sales_crm boolean not null default false,
  has_plg boolean not null default false,
  lost_deal_notes text,
  churn_notes text,
  tier text not null default 'starter' check (tier in ('starter', 'plus', 'plus_human')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;

-- Profiles (links a Supabase auth user to an account + role) -----------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  account_id uuid references accounts (id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Auto-create a profile row the moment a user signs up. Needed because
-- Supabase can require email confirmation before a session (and thus
-- auth.uid()) exists, so a client-side insert right after signUp() would
-- fail RLS — this runs as the table owner instead, bypassing that.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Returns the caller's account_id, used to scope every other table's
-- RLS policies without repeating the profiles subquery everywhere.
create or replace function auth_account_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select account_id from profiles where id = auth.uid();
$$;

create policy "users can read their own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid());

-- Created right after signup, before an account exists yet.
create policy "users can create their own profile"
  on profiles for insert
  to authenticated
  with check (id = auth.uid());

-- Lets onboarding attach the account it just created to the user's profile.
create policy "users can update their own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users can read their own account"
  on accounts for select
  to authenticated
  using (id = auth_account_id());

-- Onboarding creates the account before the user's profile points at it,
-- so this can't be scoped by auth_account_id() yet — any authenticated
-- user may create one account for themselves during onboarding.
create policy "authenticated users can create an account"
  on accounts for insert
  to authenticated
  with check (true);

create policy "users can update their own account"
  on accounts for update
  to authenticated
  using (id = auth_account_id());

-- Competitors ------------------------------------------------------------

create table if not exists competitors (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  name text not null,
  domain text,
  created_at timestamptz not null default now()
);

alter table competitors enable row level security;

create policy "users can manage their account's competitors"
  on competitors for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

-- Signals ------------------------------------------------------------

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors (id) on delete cascade,
  type text not null check (type in ('pricing', 'job_posting', 'review', 'news', 'funding')),
  title text not null,
  summary text,
  occurred_on date not null default current_date,
  scored boolean not null default false,
  relevance_level text check (relevance_level in ('High', 'Medium', 'Low')),
  relevance_reasoning text,
  -- 'manual' = seeded by an admin for demo/testing, 'pipeline' = produced by
  -- the future scraping + scoring pipeline. Lets the admin panel tell them apart.
  source text not null default 'manual' check (source in ('manual', 'pipeline')),
  created_at timestamptz not null default now()
);

alter table signals enable row level security;

create policy "users can read signals for their account's competitors"
  on signals for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );

-- Integrations (Slack / email / CRM connection state) -------------------

create table if not exists integrations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  provider text not null check (provider in ('slack', 'email', 'salesforce', 'intercom')),
  connected boolean not null default false,
  connected_at timestamptz,
  unique (account_id, provider)
);

alter table integrations enable row level security;

create policy "users can manage their account's integrations"
  on integrations for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());
