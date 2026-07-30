-- Per-call token usage log for every Anthropic call the product makes, so
-- actual LLM spend per account can be checked against the margin each
-- tier's price assumed (see the AI Pipeline Spec QA list). One row per
-- call rather than a rollup counter — cheap at current volume, and keeps
-- the option open to break spend down by function/model later without a
-- second migration.
create table if not exists llm_usage (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  function_name text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists llm_usage_account_id_idx on llm_usage (account_id);
create index if not exists llm_usage_created_at_idx on llm_usage (created_at);

alter table llm_usage enable row level security;

-- Admin-only in every sense that matters (written only by the service-role
-- client from lib/usage.ts, read only from the admin panel) — no policy
-- needed, same pattern as system_health.
