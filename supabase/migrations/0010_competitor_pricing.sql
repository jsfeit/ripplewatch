-- Structured current-state pricing per competitor (tiers, features, billing
-- model) — separate from `signals`, which tracks *changes* over time.
-- One row per competitor, overwritten on each pricing crawl.
create table if not exists competitor_pricing (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null unique references competitors (id) on delete cascade,
  billing_model text not null default 'unknown'
    check (billing_model in ('subscription', 'per_seat', 'usage_based', 'custom', 'unknown')),
  publicly_priced boolean not null default true,
  note text,
  tiers jsonb not null default '[]',
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table competitor_pricing enable row level security;

-- Writes only ever happen from the cron crawl route via the service-role
-- client (bypasses RLS), same as `signals` — this policy is read-only.
create policy "users can read pricing for their account's competitors"
  on competitor_pricing for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );
