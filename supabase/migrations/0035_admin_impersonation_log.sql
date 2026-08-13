create table if not exists admin_impersonation_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  admin_email text not null,
  target_account_id uuid not null references accounts(id) on delete cascade,
  target_account_name text,
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Service-role only (admin panel + middleware use createAdminClient()) —
-- nothing here should be readable through a regular user's RLS-scoped
-- session, including the admin's own.
alter table admin_impersonation_log enable row level security;

create index if not exists admin_impersonation_log_admin_id_idx on admin_impersonation_log (admin_id);
create index if not exists admin_impersonation_log_target_account_id_idx on admin_impersonation_log (target_account_id);
