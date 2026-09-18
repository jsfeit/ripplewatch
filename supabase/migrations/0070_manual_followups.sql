-- The queue behind "a person will take a look": every time the automated
-- checks (direct fetch, archived copies, public-sources research) can't give a
-- reliable answer for a domain, a row lands here and an alert goes to the
-- operator, who resolves it from Admin -> Follow-ups.
--
-- Two kinds:
--   snapshot    a visitor to the public competitor-snapshot tool; resolving it
--               emails them the manually gathered result.
--   competitor  a competitor a paying customer added that we couldn't read;
--               resolving it writes the manually gathered pricing/hiring into
--               that competitor's real records so it shows up in their
--               dashboard.
--
-- Written and read only through the service-role client (no RLS policies),
-- same as system_alerts.
create table if not exists manual_followups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('snapshot', 'competitor')),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  domain text not null,
  -- Why the automation gave up: blocked | unreachable | ok (loaded but nothing
  -- readable) | unread (pricing/hiring not read directly, research draft only).
  reason text,
  requester_email text,
  lead_id uuid references leads (id) on delete set null,
  account_id uuid references accounts (id) on delete cascade,
  competitor_id uuid references competitors (id) on delete cascade,
  competitor_name text,
  -- The public-sources research result, if any, as a starting point to verify
  -- rather than something published to a customer unreviewed.
  draft jsonb,
  -- What the operator entered when resolving.
  resolution jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists manual_followups_status_idx on manual_followups (status, created_at desc);

-- One open item per competitor / per lead+domain, so a repeat lookup or a
-- re-crawl doesn't stack duplicates.
create unique index if not exists manual_followups_pending_competitor_idx
  on manual_followups (competitor_id) where status = 'pending' and competitor_id is not null;
create unique index if not exists manual_followups_pending_lead_domain_idx
  on manual_followups (lead_id, domain) where status = 'pending' and lead_id is not null;

alter table manual_followups enable row level security;
