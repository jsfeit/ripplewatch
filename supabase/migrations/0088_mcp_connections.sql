-- Which AI assistant each connected account uses, and how much.
-- Until now the only trace of a connection was accounts.mcp_last_connected_at, so there was no
-- way to tell Claude from ChatGPT from a directory's health checker, or to see which listing
-- brought a user in. One row per account and OAuth client: the consent screen records who asked
-- (name and where it redirects back to), and every MCP request after that bumps last_seen_at and
-- request_count. A connection made before this shipped appears as 'unknown' on its next request.
create table if not exists mcp_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  client_id text not null,
  client_name text,
  redirect_host text,
  assistant text not null default 'unknown',
  first_connected_at timestamptz not null default now(),
  last_seen_at timestamptz,
  request_count integer not null default 0,
  unique (account_id, client_id)
);

create index if not exists mcp_connections_assistant_idx on mcp_connections (assistant);
create index if not exists mcp_connections_last_seen_idx on mcp_connections (last_seen_at desc);

-- No policies on purpose: with row level security on and nothing granted, only the service role
-- can touch it.
alter table mcp_connections enable row level security;

-- Atomic "saw a request from this client". Inserts the row if the connection pre-dates this table.
create or replace function mcp_connection_touch(p_account_id uuid, p_client_id text)
returns void
language sql
as $$
  insert into mcp_connections (account_id, client_id, last_seen_at, request_count)
  values (p_account_id, p_client_id, now(), 1)
  on conflict (account_id, client_id)
  do update set last_seen_at = now(), request_count = mcp_connections.request_count + 1;
$$;

revoke execute on function mcp_connection_touch(uuid, text) from public, anon, authenticated;
