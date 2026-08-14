-- Read-only external API keys (see /api/v1/*) — Plus/Advanced feature,
-- gated in code via API_ACCESS_ALLOWED (src/lib/tier-limits.ts), not RLS,
-- since RLS has no notion of tier.
--
-- Only key_hash is ever stored; the plaintext key is shown once at
-- creation and never persisted or retrievable again, same as Stripe
-- restricted keys / GitHub PATs. key_prefix is stored purely for display
-- ("rw_live_ab12...") so a user can tell keys apart in the list without
-- re-exposing the secret.
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  name text not null default 'API key',
  key_hash text not null unique,
  key_prefix text not null,
  created_by uuid references profiles (id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  -- Fixed-window rate limiting (see src/lib/api-auth.ts): reset lazily
  -- whenever a request lands more than 60s after rate_limit_window_started_at,
  -- rather than a cron sweep or external store — fine at this request volume.
  rate_limit_window_started_at timestamptz,
  rate_limit_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists api_keys_account_id_idx on api_keys (account_id);

alter table api_keys enable row level security;

-- Covers the Settings UI (list/create/revoke), which runs as the signed-in
-- user. Actual request-time authentication in /api/v1/* looks keys up by
-- hash via the service-role client instead — an inbound request carries
-- only a bearer token, no Supabase session, so RLS can't apply there.
create policy "users can manage api keys for their account"
  on api_keys for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());
