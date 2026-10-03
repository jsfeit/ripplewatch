-- Individual competitor mentions from sales calls, logged by the customer's
-- assistant after reading their own call tool (Gong, Zoom, etc.) through that
-- tool's MCP. Until now call mentions only ever existed as a per-crawl count
-- (competitor_state_history.call_mention_count) with nothing behind it, so
-- nothing could be shown, audited or deduplicated.
--
-- dedupe_key is a hash of competitor + date + quote, so an assistant that
-- re-reads the same calls on a later refresh doesn't double count. Writes go
-- through the service role (the MCP tool); customers can read their own.
create table if not exists call_mentions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  competitor_id uuid not null references competitors (id) on delete cascade,
  quote text not null,
  occurred_on date not null default current_date,
  source text not null default 'assistant',
  dedupe_key text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists call_mentions_dedupe_idx on call_mentions (account_id, dedupe_key);
create index if not exists call_mentions_competitor_idx on call_mentions (competitor_id, occurred_on desc);

alter table call_mentions enable row level security;

create policy "users can read their account's call mentions"
  on call_mentions for select
  to authenticated
  using (account_id = auth_account_id());
