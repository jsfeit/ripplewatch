-- Referral program: a paying customer gets a personal shareable code
-- (accounts.referral_code, generated lazily in Settings), the company they
-- refer gets 2 months free immediately at signup (applied via a one-off
-- Stripe coupon at checkout, no column needed to track that — the checkout
-- route's existing "first paid checkout only" invariant covers it), and
-- the referrer gets their own reward only once the referral has been an
-- active paying customer for 60 days (see /api/cron/referral-rewards) —
-- deliberately not immediate, to avoid rewarding a referral that churns
-- right away.
alter table accounts add column if not exists referral_code text unique;
alter table accounts add column if not exists referred_by_account_id uuid references accounts(id) on delete set null;
-- Last coupon attached to THIS account's own subscription as a referrer
-- reward — admin visibility/debugging only, Stripe's subscription object
-- is the actual source of truth for what's applied.
alter table accounts add column if not exists referral_reward_coupon_id text;

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_account_id uuid not null references accounts(id) on delete cascade,
  -- unique: an account can only ever have been referred by one company,
  -- ever — prevents a later signup from re-attributing an existing account.
  referred_account_id uuid not null references accounts(id) on delete cascade unique,
  referred_at timestamptz not null default now(),
  -- Set once the referred account has been active/paying for 60 days —
  -- null means "still pending," checked daily by the referral-rewards cron.
  qualified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists referrals_referrer_idx on referrals(referrer_account_id);
create index if not exists referrals_qualified_idx on referrals(qualified_at) where qualified_at is null;

alter table referrals enable row level security;

-- Referrers can see their own referral list (Settings > Refer & earn) —
-- everything else (marking qualified, applying the Stripe reward) only
-- ever happens via the service-role admin client (the cron), so no
-- insert/update policy is needed for regular users.
drop policy if exists "users can read their account's referrals" on referrals;
create policy "users can read their account's referrals"
  on referrals for select
  to authenticated
  using (referrer_account_id = auth_account_id());

-- Affiliate program: a public application form (name, email, why they'd be
-- a good fit, what channels they offer) — lead-capture only for now, no
-- automated commission tracking. Reviewed and status-updated from Admin;
-- every submission also emails jeremyripplewatch@gmail.com immediately.
create table if not exists affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  why_good_fit text not null,
  channels text not null,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table affiliate_applications enable row level security;
-- No public policies — the application API route always inserts via the
-- service-role admin client, and only Admin ever reads these.
