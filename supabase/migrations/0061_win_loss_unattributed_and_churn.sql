-- Most losses and nearly all B2C churn never name who a customer picked
-- instead — competitor_id was NOT NULL from day one (0027), so every one of
-- those entries had nowhere structured to go and fell back to an undated,
-- unstructured text blob (accounts.lost_deal_notes/churn_notes) that
-- Momentum and per-competitor fact sheets never read. This makes
-- competitor_id optional so an "I lost this deal/customer, don't know to
-- who" entry still gets a real, dated, queryable row — the basis for
-- correlating attrition timing against detected competitor changes even
-- without knowing exactly who won.
--
-- account_id is added directly (backfilled from the competitor's account)
-- rather than relying on the competitor_id join for RLS/scoping, since a
-- null competitor_id has no join to follow. 'churned' joins 'won'/'lost' as
-- a first-class outcome so B2C churn — previously a completely separate,
-- account-only, competitor-less text blob — becomes just another entry in
-- the same log, optionally attributed like everything else here.

alter table competitor_win_loss add column if not exists account_id uuid references accounts (id) on delete cascade;

update competitor_win_loss wl
set account_id = c.account_id
from competitors c
where wl.competitor_id = c.id and wl.account_id is null;

alter table competitor_win_loss alter column account_id set not null;
alter table competitor_win_loss alter column competitor_id drop not null;

alter table competitor_win_loss drop constraint if exists competitor_win_loss_outcome_check;
alter table competitor_win_loss add constraint competitor_win_loss_outcome_check
  check (outcome in ('won', 'lost', 'churned'));

create index if not exists competitor_win_loss_account_id_idx on competitor_win_loss (account_id);

-- Old policy only ever reachable rows via a competitor_id join, which a
-- null competitor_id has no way to satisfy — replaced with the account_id
-- column directly, which every row (attributed or not) now always has.
drop policy if exists "users can manage win/loss entries for their account's competitors" on competitor_win_loss;

create policy "users can manage win/loss entries for their own account"
  on competitor_win_loss for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());
