-- Temporary diagnostic — widens the accounts insert policy to any role
-- (not just 'authenticated') so we can tell whether the app's requests are
-- being recognized as authenticated at all. Will be tightened back up once
-- we know which it is.

drop policy if exists "authenticated users can create an account" on accounts;
create policy "authenticated users can create an account"
  on accounts for insert
  to public
  with check (true);
