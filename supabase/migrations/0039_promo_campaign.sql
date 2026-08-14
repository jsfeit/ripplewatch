-- A single evergreen promo campaign (one row, upserted from /admin), not a
-- history table — the admin UI always reads/writes the oldest row.
create table if not exists promo_campaigns (
  id uuid primary key default gen_random_uuid(),
  active boolean not null default false,
  percent_off integer not null,
  duration_months integer not null,
  code text not null,
  banner_text text not null,
  stripe_coupon_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table promo_campaigns enable row level security;

-- No public policies: the banner and checkout both read this through the
-- service-role client (src/lib/promo-campaign.ts), which explicitly
-- selects only the columns each caller needs — the banner never sees
-- stripe_coupon_id, for instance. Writes only via the admin API route.
