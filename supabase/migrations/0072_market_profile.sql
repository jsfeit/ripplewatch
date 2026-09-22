-- The macro context Industry Pulse doesn't provide: what market this
-- account actually competes in (name, maturity, growth direction) and
-- where their own product sits in it, synthesized from the same
-- already-sourced research industry_trends and accounts.company_research
-- produce, not a fresh unrelated pass. See src/lib/market-profile.ts.
--
-- One row per account (not append-only like industry_trends): this is a
-- current snapshot that gets replaced on refresh, not a feed of dated
-- items, so accounts.id is the natural key rather than a generated_at
-- history.
create table if not exists market_profile (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references accounts (id) on delete cascade,
  market_name text not null,
  market_description text not null,
  maturity text not null check (maturity in ('emerging', 'growing', 'mature', 'consolidating')),
  growth_direction text not null check (growth_direction in ('heating_up', 'steady', 'cooling')),
  growth_reason text not null,
  -- [{ text, source: { name, url } | null }] — same shape as
  -- industry_trends.trends[].source. A dynamic without a source is kept
  -- (it may be synthesized from the account's own already-sourced
  -- company_research rather than a fresh citation) but the UI treats an
  -- unsourced one differently than a cited one.
  dynamics jsonb not null default '[]'::jsonb,
  product_summary text not null,
  generated_at timestamptz not null default now(),
  -- Set when a person edits any field by hand. While set, the monthly
  -- refresh cron skips this account so it never silently overwrites a
  -- correction; Regenerate clears it.
  user_edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists market_profile_account_idx on market_profile (account_id);

alter table market_profile enable row level security;

-- Read follows industry_trends's "for all" shape. Update is its own policy,
-- unlike industry_trends: a member can correct their own market profile in
-- place (see PATCH /api/market-profile), same "users can manage their own"
-- shape as competitors (migration 0001) but update-only — insert stays
-- service-role-only (generation is always the LLM synthesis, never a blank
-- row a member creates by hand) and there's nothing to delete (Regenerate
-- overwrites, it doesn't remove).
create policy "users can read their account's market profile"
  on market_profile for select
  to authenticated
  using (account_id = auth_account_id());

create policy "users can update their account's market profile"
  on market_profile for update
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());
