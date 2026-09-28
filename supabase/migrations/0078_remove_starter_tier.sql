-- Starter is gone: one dashboard plan now (still 'plus' internally, renamed
-- to "Ripplewatch Dashboard" everywhere it's shown), sitting next to
-- Ripplewatch Connect as a separate product. No paying customer was ever on
-- Starter (verified: the only accounts row on it had no Stripe subscription),
-- so this just moves that row over and tightens the constraint.
--
-- accounts.tier is a protected billing column (0014): the trigger only lets
-- service_role change it, and the SQL editor runs as postgres, so the
-- trigger is switched off for this one statement and straight back on (same
-- fix as 0075, which hit the identical error removing the Advanced tier).

begin;

alter table accounts disable trigger protect_account_billing_columns_trigger;
update accounts set tier = 'plus' where tier = 'starter';
alter table accounts enable trigger protect_account_billing_columns_trigger;

alter table accounts drop constraint if exists accounts_tier_check;
alter table accounts
  add constraint accounts_tier_check
  check (tier in ('plus', 'connect'));

commit;
