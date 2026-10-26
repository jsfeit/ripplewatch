-- Audit log: who did what on an account, shown to the account owner in
-- Settings and exportable as CSV. Rows are written by the server with the
-- service role and read through an owner-only route, so RLS is on with no
-- policies. Kept 12 months (/api/cron/audit-log-purge) and removed with the
-- account.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('user', 'assistant', 'system')),
  actor_id uuid,
  actor_label text,
  action text not null,
  target text,
  detail jsonb,
  ip text
);

create index if not exists audit_log_account_created_idx on audit_log (account_id, created_at desc);
create index if not exists audit_log_created_idx on audit_log (created_at);

alter table audit_log enable row level security;
