-- Two additive features: (1) free-form document uploads during onboarding
-- (stored only, not yet parsed into scoring context), and (2) team invites
-- so an account can have more than one login, gated by SEAT_LIMIT in
-- src/lib/tier-limits.ts.

-- Documents -----------------------------------------------------------

-- account_id starts null: onboarding uploads happen before the account
-- exists. /api/onboarding/complete links them to the new account by
-- updating rows where uploaded_by = the signed-in user and account_id is
-- still null — same pattern profiles.account_id already uses.
create table if not exists account_documents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  size_bytes integer,
  created_at timestamptz not null default now()
);

alter table account_documents enable row level security;

create policy "users can manage their own uploads or their account's"
  on account_documents for all
  to authenticated
  using (uploaded_by = auth.uid() or account_id = auth_account_id())
  with check (uploaded_by = auth.uid());

insert into storage.buckets (id, name, public)
values ('account-documents', 'account-documents', false)
on conflict (id) do nothing;

-- Objects are stored under `{user_id}/{filename}` — this policy scopes
-- access to the uploader's own folder, checked against the path itself
-- since storage.objects has no account_id column to join against.
create policy "users can manage objects in their own folder"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'account-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'account-documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Invites ---------------------------------------------------------------

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('member', 'admin')),
  token uuid not null default gen_random_uuid(),
  invited_by uuid references auth.users (id),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (account_id, email)
);

alter table invites enable row level security;

-- Accepting an invite runs through the admin client (service role) since
-- the invitee's profile isn't linked to this account_id yet, so it can't
-- pass auth_account_id() at that point — no anon/public select policy is
-- needed for the accept flow itself.
create policy "account members can manage their account's invites"
  on invites for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());
