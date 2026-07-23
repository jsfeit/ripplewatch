-- Adds what the real (non-mock) integrations, scraping pipeline, and email
-- delivery need. Additive only — 0001_init.sql has already been applied.

-- OAuth tokens / provider-specific state for Slack & HubSpot. Kept as jsonb
-- rather than per-provider columns since each provider's token shape differs.
alter table integrations add column if not exists credentials jsonb;
alter table integrations add column if not exists external_account_id text;

-- HubSpot is the real CRM integration (not Salesforce, per product decision).
alter table integrations drop constraint if exists integrations_provider_check;
alter table integrations add constraint integrations_provider_check
  check (provider in ('slack', 'email', 'hubspot', 'salesforce', 'intercom'));

-- The email the customer signed up with — needed to send digests without
-- querying the protected auth.users table from application code.
alter table accounts add column if not exists contact_email text;

-- Where to look when scraping a competitor. Nullable: scraping simply skips
-- a competitor until these are set (via admin for now).
alter table competitors add column if not exists pricing_url text;
alter table competitors add column if not exists careers_url text;

-- Latest known snapshot per competitor+source, so the crawler can diff
-- against last time instead of re-deriving history from raw signals.
create table if not exists page_snapshots (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors (id) on delete cascade,
  kind text not null check (kind in ('pricing', 'jobs')),
  content_hash text not null,
  raw_text text,
  captured_at timestamptz not null default now(),
  unique (competitor_id, kind)
);

alter table page_snapshots enable row level security;

-- Snapshots are only ever read/written by the cron job and admin tooling,
-- both of which use the service-role client and so bypass RLS entirely —
-- no policies are needed for the account's own users to touch this table.
