-- RLS audit: found and closed four gaps where a signed-in user could act
-- outside their own account via a direct Supabase REST/JS call (bypassing
-- the Next.js app entirely — RLS is the only backstop for that path).
--
-- 1. profiles.role had no protection beyond "id = auth.uid()" on UPDATE, so
--    any user could set their own role to 'admin' and pass the /admin
--    panel's role check (see middleware.ts) — full cross-tenant access to
--    every account, signal, and admin action.
-- 2. profiles.account_id had the same gap — any user could attach their
--    profile to an arbitrary existing account_id and inherit that
--    account's competitors, signals, integrations, documents, and invites.
-- 3. accounts.tier / stripe_customer_id / stripe_subscription_id /
--    subscription_status could be updated directly by the account's own
--    authenticated user, e.g. self-granting the Advanced tier without
--    paying. These are only ever meant to change via the Stripe webhook
--    or admin override, both of which run on the service-role client.
-- 4. account_documents' insert/update WITH CHECK only verified
--    uploaded_by = auth.uid(), not account_id — a user could set
--    account_id to a victim's account and have their upload show up in
--    that account's document list.
--
-- Fix pattern for 1-3: a BEFORE UPDATE trigger that lets service-role
-- writes (webhook, admin tooling) through unchanged, but rejects changes
-- to the protected columns from an ordinary authenticated session. Onboarding
-- and invite-acceptance — the two legitimate paths that set
-- profiles.account_id — already run via the admin client or, for
-- onboarding, are covered by the new created_by check below.

-- profiles.role / profiles.account_id ------------------------------------

alter table accounts add column if not exists created_by uuid references auth.users (id);

create or replace function protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    raise exception 'role cannot be changed directly';
  end if;

  if new.account_id is distinct from old.account_id then
    if old.account_id is not null then
      raise exception 'account_id cannot be reassigned';
    end if;
    if not exists (
      select 1 from accounts where id = new.account_id and created_by = auth.uid()
    ) then
      raise exception 'account_id must reference an account you created';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_columns_trigger on profiles;
create trigger protect_profile_columns_trigger
  before update on profiles
  for each row execute function protect_profile_columns();

-- accounts billing fields --------------------------------------------------

create or replace function protect_account_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.tier is distinct from old.tier
    or new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.subscription_status is distinct from old.subscription_status
  then
    raise exception 'billing fields can only be changed by the system';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_account_billing_columns_trigger on accounts;
create trigger protect_account_billing_columns_trigger
  before update on accounts
  for each row execute function protect_account_billing_columns();

-- account_documents cross-tenant injection --------------------------------

drop policy if exists "users can manage their own uploads or their account's" on account_documents;
create policy "users can manage their own uploads or their account's"
  on account_documents for all
  to authenticated
  using (uploaded_by = auth.uid() or account_id = auth_account_id())
  with check (uploaded_by = auth.uid() and (account_id is null or account_id = auth_account_id()));
