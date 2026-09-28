-- Starter is gone: one dashboard plan now (still 'plus' internally, renamed
-- to "Ripplewatch Dashboard" everywhere it's shown), sitting next to
-- Ripplewatch Connect as a separate product. No paying customer was ever on
-- Starter (verified: the only accounts row on it had no Stripe subscription),
-- so this just moves that row over and tightens the constraint.

update accounts set tier = 'plus' where tier = 'starter';

alter table accounts drop constraint if exists accounts_tier_check;
alter table accounts
  add constraint accounts_tier_check
  check (tier in ('plus', 'connect'));
