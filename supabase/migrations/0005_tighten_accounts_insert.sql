-- Revert the 0004 diagnostic widening now that the real bug is fixed (the
-- onboarding route no longer chains .select() after inserting the account,
-- so the RLS SELECT-on-RETURNING conflict that caused the original error
-- can't happen anymore regardless of this policy's role scope).

drop policy if exists "authenticated users can create an account" on accounts;
create policy "authenticated users can create an account"
  on accounts for insert
  to authenticated
  with check (true);
