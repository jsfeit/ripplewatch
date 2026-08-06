-- Structured, per-competitor win/loss log — replaces relying solely on the
-- single free-text lost_deal_notes/churn_notes blob captured once at
-- onboarding (account-level, not tied to any specific competitor, and never
-- updated afterward). Customers log entries directly ("we lost this deal to
-- Acme because X"); this is both the input to the competitor fact sheet
-- (see below) and, going forward, a sharper signal for scoreSignal's
-- "documented loss reason" rubric step than the static onboarding text.
create table if not exists competitor_win_loss (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors (id) on delete cascade,
  outcome text not null check (outcome in ('won', 'lost')),
  reason text not null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table competitor_win_loss enable row level security;

create policy "users can manage win/loss entries for their account's competitors"
  on competitor_win_loss for all
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  )
  with check (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );

-- Cached fact-sheet output (per competitor: "why we win" / "why we lose"),
-- generated on demand rather than on every crawl — see generateFactSheet in
-- anthropic.ts. Regenerated whenever a customer clicks Refresh, not tied to
-- the crawl schedule, since it depends on win/loss entries and positioning
-- that don't change nearly as often as signals do.
alter table competitors add column if not exists fact_sheet_why_we_win text;
alter table competitors add column if not exists fact_sheet_why_we_lose text;
alter table competitors add column if not exists fact_sheet_generated_at timestamptz;
