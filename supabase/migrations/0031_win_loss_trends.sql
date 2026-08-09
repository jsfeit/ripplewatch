-- Recurring themes across ALL logged win/loss reasons for an account (not
-- scoped to one competitor), each optionally linked to existing signals
-- that plausibly explain it — e.g. a "losing on price" theme linked to a
-- competitor's recent price-cut signal. Regenerated on demand (like the
-- fact sheet), old rows replaced wholesale on each generation rather than
-- versioned/accumulated.
create table if not exists win_loss_trends (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  theme text not null,
  summary text not null,
  won_count integer not null default 0,
  lost_count integer not null default 0,
  example_reasons jsonb not null default '[]',
  related_signals jsonb not null default '[]',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table win_loss_trends enable row level security;

-- Same "for all" shape as competitor_win_loss (migration 0027) — writes
-- happen from the regular (RLS-respecting) server client when a user clicks
-- Generate/Refresh, not a service-role route.
create policy "users can manage trends for their account"
  on win_loss_trends for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());
