-- Replaces 0073's two-table split (account_nps_responses +
-- account_customer_asks) with one table — the split read as two disconnected
-- systems in the UI (two panels, two forms, two imports) for what's really
-- one concept: a piece of feedback from the account's own customer, which
-- MAY carry a 0-10 NPS score. Modeled directly on competitor_win_loss
-- (0027): one outcome-flexible log, one form, one CSV import, not a rigid
-- type per shape. Both source tables are empty in production (shipped
-- moments ago, nothing logged yet), so this drops and replaces rather than
-- migrating rows.

drop table if exists account_nps_responses;
drop table if exists account_customer_asks;

create table if not exists account_customer_feedback (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  -- Always required — even a pure NPS entry needs SOME text (the reason),
  -- same as how a win/loss "general" entry requires a real reason. For a
  -- score-only response with nothing else recorded, callers fall back to a
  -- short generated summary rather than leaving this empty.
  summary text not null,
  -- Optional: the "NPS as one example" part — present when this entry is a
  -- scored survey response, null for a plain ask/feature-request with no
  -- score attached. Nothing else about the row's shape changes based on
  -- whether this is set.
  score smallint check (score between 0 and 10),
  -- Free text, where this came from (e.g. "Support ticket", "Sales call",
  -- "Survey") — not a foreign key, same reasoning as competitor_win_loss's
  -- reason field: this describes an external event, not a Ripplewatch row.
  source text,
  respondent text,
  status text not null default 'new' check (status in ('new', 'considering', 'planned', 'shipped', 'declined')),
  -- When the feedback was actually given, not when it was logged here —
  -- matters for a backfilled CSV import to produce a real trend line
  -- instead of every row landing on the import date.
  feedback_date date not null default current_date,
  origin text not null default 'manual' check (origin in ('manual', 'csv_import')),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table account_customer_feedback enable row level security;

create policy "users can manage customer feedback for their own account"
  on account_customer_feedback for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

create index if not exists account_customer_feedback_account_id_idx on account_customer_feedback (account_id, feedback_date);
