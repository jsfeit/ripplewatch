-- The /creators landing page (a dedicated pitch to newsletter/YouTube/X
-- creators, distinct from the general /affiliates page) submits into the
-- same affiliate_applications table rather than a new one — the fields
-- captured are identical, and payout/tracking is the same downstream
-- process either way. This column is just so Admin > Affiliates can tell
-- the two applicant pools apart at a glance.
alter table affiliate_applications add column if not exists program text not null default 'affiliate'
  check (program in ('affiliate', 'creator'));
