-- Idempotent fix: (re)create the policies onboarding depends on, in case
-- they didn't take effect the first time. Safe to run even if they already
-- exist and are working correctly.

drop policy if exists "users can create their own profile" on profiles;
create policy "users can create their own profile"
  on profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "users can update their own profile" on profiles;
create policy "users can update their own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "authenticated users can create an account" on accounts;
create policy "authenticated users can create an account"
  on accounts for insert
  to authenticated
  with check (true);
