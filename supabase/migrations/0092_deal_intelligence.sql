-- Win/loss rows become real deals with a real timeline.
--
-- Until now a row only knew when it was LOGGED (created_at), so a bulk import of last year's losses
-- all landed on the day of the import and every "did losses cluster after a competitor's move"
-- calculation saw one big spike today. closed_on is the deal's own close date; readers use
-- coalesce(closed_on, created_at::date). The other columns keep what the source said (deal id,
-- amount, owner, segment, the raw row) so a re-import updates a deal instead of duplicating it, and
-- so the interpretation can always be traced back to the row it came from.
--
-- reason_themes / reason_detail are the structured read of the free-text reason, so counting
-- "losses citing price" or "losses citing reporting" is a query, not a fresh LLM pass each time.

alter table competitor_win_loss add column if not exists closed_on date;
alter table competitor_win_loss add column if not exists amount numeric;
alter table competitor_win_loss add column if not exists deal_ref text;
alter table competitor_win_loss add column if not exists deal_name text;
alter table competitor_win_loss add column if not exists owner text;
alter table competitor_win_loss add column if not exists segment text;
alter table competitor_win_loss add column if not exists source text not null default 'manual';
alter table competitor_win_loss add column if not exists import_id uuid;
alter table competitor_win_loss add column if not exists raw jsonb;
alter table competitor_win_loss add column if not exists reason_themes text[] not null default '{}';
alter table competitor_win_loss add column if not exists reason_detail text;
alter table competitor_win_loss add column if not exists competitor_raw text;

-- One row per deal per account. NULL deal_refs (manual entries) never collide with each other, and the
-- index is not partial so an upsert can name it as its conflict target.
create unique index if not exists competitor_win_loss_deal_ref_idx
  on competitor_win_loss (account_id, deal_ref);
create index if not exists competitor_win_loss_closed_on_idx on competitor_win_loss (account_id, closed_on);
create index if not exists competitor_win_loss_import_idx on competitor_win_loss (import_id);

-- One row per upload / assistant import: what column mapping was used and how much came in, so a bad
-- mapping can be found and undone (delete the rows with that import_id).
create table if not exists win_loss_imports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  source text not null,
  filename text,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  mapping jsonb,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table win_loss_imports enable row level security;

create policy "users can manage imports for their own account"
  on win_loss_imports for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

-- Free-form things the team knows that no CRM holds: what they are building and when it ships,
-- pricing plans, a customer's offhand comment, a sales call insight. The text is stored as written;
-- kind/status/product_areas/themes are the structured read of it, so it can be lined up against loss
-- reasons and competitor moves.
create table if not exists context_notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  body text not null,
  kind text not null default 'other'
    check (kind in ('roadmap', 'pricing', 'customer', 'sales', 'market', 'other')),
  status text check (status in ('idea', 'planned', 'in_progress', 'shipped')),
  product_areas text[] not null default '{}',
  themes text[] not null default '{}',
  effective_on date not null default current_date,
  expected_on date,
  source text not null default 'manual',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists context_notes_account_idx on context_notes (account_id, effective_on desc);

alter table context_notes enable row level security;

create policy "users can manage context notes for their own account"
  on context_notes for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

-- The latest "what is costing us deals" read for an account. Facts are computed in code and the model
-- only writes the interpretation; input_hash lets an unchanged account reuse the last one instead of
-- paying for a new generation.
create table if not exists deal_impact_briefs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  findings jsonb not null default '[]',
  coverage jsonb not null default '{}',
  input_hash text not null,
  generated_at timestamptz not null default now()
);

create index if not exists deal_impact_briefs_account_idx on deal_impact_briefs (account_id, generated_at desc);

alter table deal_impact_briefs enable row level security;

create policy "users can read impact briefs for their own account"
  on deal_impact_briefs for select
  to authenticated
  using (account_id = auth_account_id());
