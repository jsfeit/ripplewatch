-- "Voice of customer" — Ripplewatch has always tracked competitors
-- extensively but never gave an account's own customer sentiment any
-- structured home; it lived (if anywhere) buried in the free-text
-- won_deal_notes/lost_deal_notes/churn_notes blob, same problem win/loss
-- itself had before 0027. This gives NPS-style survey scores and
-- standalone customer asks/feature-requests their own dated, queryable
-- rows, the same "structured log, not a text blob" pattern win/loss
-- already established — feeding fact sheets and market profile with real
-- customer signal instead of only competitor signal.

create table if not exists account_nps_responses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  -- Standard 0-10 NPS scale — promoter/passive/detractor bucketing (9-10 /
  -- 7-8 / 0-6) is computed in application code from this, not stored, so
  -- the bucketing rule can change without a backfill.
  score smallint not null check (score between 0 and 10),
  reason text,
  -- Free text, not a foreign key — this is the ACCOUNT's own customer who
  -- gave the response, not a Ripplewatch user, so there's no table row to
  -- reference. Optional: a bulk CSV import commonly has no per-response
  -- identity at all.
  respondent text,
  -- When the response was actually collected, not when it was logged here
  -- — matters for building a real trend line out of a backfilled CSV
  -- import, where every row would otherwise land on the same import date.
  survey_date date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'csv_import')),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table account_nps_responses enable row level security;

create policy "users can manage NPS responses for their own account"
  on account_nps_responses for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

create index if not exists account_nps_responses_account_id_idx on account_nps_responses (account_id, survey_date);

-- Separate from an NPS response's own reason text: an ask can come from
-- anywhere (a sales call, a support ticket, a survey open-end), not only a
-- scored NPS response, and it needs its own lifecycle (new -> considering
-- -> planned -> shipped/declined) rather than just sitting as a comment
-- next to a score.
create table if not exists account_customer_asks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  summary text not null,
  source text,
  status text not null default 'new' check (status in ('new', 'considering', 'planned', 'shipped', 'declined')),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table account_customer_asks enable row level security;

create policy "users can manage customer asks for their own account"
  on account_customer_asks for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

create index if not exists account_customer_asks_account_id_idx on account_customer_asks (account_id, status);
