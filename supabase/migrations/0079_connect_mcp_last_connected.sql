-- Tracks the last time an account authenticated a real MCP request (a
-- connector call from Claude/ChatGPT, or an API key from another tool),
-- so Settings can show a genuine "connected" status instead of just
-- assuming a copied URL was ever pasted anywhere. Set from
-- /api/mcp/route.ts on every successfully authenticated request.
alter table accounts add column if not exists mcp_last_connected_at timestamptz;
