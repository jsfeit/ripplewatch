-- One-off/marketing email campaigns, sent manually from admin — distinct
-- from the product's transactional emails (digests, invites) in
-- src/lib/resend.ts. Only one segment exists today (waitlist signups who
-- haven't converted to an account), but the shape supports adding more
-- later without a schema change.
create table if not exists email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text not null check (segment in ('waitlist_not_signed_up')),
  subject text not null,
  body text not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table email_campaigns enable row level security;

-- Admin-only in every sense that matters (built and used only from
-- /admin/campaigns, which the middleware already gates on profiles.role);
-- no policy needed since all access goes through the service-role client.

create table if not exists email_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references email_campaigns (id) on delete cascade,
  email text not null,
  resend_message_id text,
  sent_at timestamptz not null default now(),
  unique (campaign_id, email)
);

alter table email_campaign_recipients enable row level security;
