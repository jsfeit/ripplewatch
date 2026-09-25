-- Advanced tier is gone: everything it included (20 competitors, Zoom call
-- insights, Intercom, unlimited seats, onboarding support) now lives on
-- Plus. No paying customers were on it (verified: the only accounts row on
-- 'advanced' had no Stripe subscription), so this just moves that row over
-- and tightens the constraint so the retired value can't come back.

update accounts set tier = 'plus' where tier = 'advanced';

alter table accounts drop constraint if exists accounts_tier_check;
alter table accounts
  add constraint accounts_tier_check
  check (tier in ('starter', 'plus'));
