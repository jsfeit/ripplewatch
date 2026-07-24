-- Pricing restructure: "Plus + Human" is replaced by a self-serve
-- "Advanced" tier (more competitors/seats, assisted onboarding, but no
-- longer sales-gated). Existing accounts on the old tier are migrated
-- automatically rather than left pointing at a value the new check
-- constraint would reject.
--
-- Ordering is deliberate: the constraint must be fully absent while the
-- data migrates. Adding the new constraint before the UPDATE fails
-- validation against still-'plus_human' rows; running the UPDATE while the
-- old constraint is still active fails because it doesn't allow
-- 'advanced' yet. Dropping it first, with no constraint in between, avoids
-- both.

alter table accounts drop constraint if exists accounts_tier_check;

update accounts set tier = 'advanced' where tier = 'plus_human';

alter table accounts add constraint accounts_tier_check
  check (tier in ('starter', 'plus', 'advanced'));
