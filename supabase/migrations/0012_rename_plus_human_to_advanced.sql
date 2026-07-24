-- Pricing restructure: "Plus + Human" is replaced by a self-serve
-- "Advanced" tier (more competitors/seats, assisted onboarding, but no
-- longer sales-gated). Existing accounts on the old tier are migrated
-- automatically rather than left pointing at a value the new check
-- constraint would reject.

update accounts set tier = 'advanced' where tier = 'plus_human';

alter table accounts drop constraint if exists accounts_tier_check;
alter table accounts add constraint accounts_tier_check
  check (tier in ('starter', 'plus', 'advanced'));
