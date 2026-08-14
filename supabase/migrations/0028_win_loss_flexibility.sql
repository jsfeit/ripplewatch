-- Real win/loss data isn't always a clean "lost to tracked competitor X for
-- reason Y" row: sometimes the competitor is known but not tracked yet,
-- sometimes there's a reason with no competitor at all ("No Decision,"
-- "Built In-House," a deal that just went quiet), and sometimes a tracked
-- competitor is known but no reason was ever recorded. reason nullable so
-- an outcome-only entry ("lost to Xero, no reason given") can still be
-- logged instead of being silently dropped for missing one field.
alter table competitor_win_loss alter column reason drop not null;

-- Lets the CSV/HubSpot import routes (running as the signed-in user, not
-- the service-role client) suggest a competitor named in imported win/loss
-- data but not currently tracked — reuses the same suggested_competitors
-- table and "one suggestion per (account, name), ever" uniqueness the
-- weekly discovery cron already relies on, so a dismissed suggestion still
-- never resurfaces even if it shows up in a later import.
drop policy if exists "users can suggest competitors from imported win/loss data" on suggested_competitors;
create policy "users can suggest competitors from imported win/loss data"
  on suggested_competitors for insert
  to authenticated
  with check (account_id = auth_account_id());
