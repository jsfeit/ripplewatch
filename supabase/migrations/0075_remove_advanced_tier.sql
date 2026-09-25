-- Advanced tier is gone: everything it included (20 competitors, Zoom call
-- insights, Intercom, unlimited seats, onboarding support) now lives on
-- Plus. No paying customers were on it (verified: the only accounts row on
-- 'advanced' had no Stripe subscription), so this just moves that row over
-- and tightens the constraint so the retired value can't come back.
--
-- accounts.tier is a protected billing column (0014): the trigger only lets
-- service_role change it, and the SQL editor runs as postgres, so the
-- trigger is switched off for this one statement and straight back on.

begin;

alter table accounts disable trigger protect_account_billing_columns_trigger;
update accounts set tier = 'plus' where tier = 'advanced';
alter table accounts enable trigger protect_account_billing_columns_trigger;

alter table accounts drop constraint if exists accounts_tier_check;
alter table accounts
  add constraint accounts_tier_check
  check (tier in ('starter', 'plus'));

commit;
