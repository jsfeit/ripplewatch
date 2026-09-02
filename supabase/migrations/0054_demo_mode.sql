alter table accounts add column if not exists demo_mode boolean not null default false;
comment on column accounts.demo_mode is
  'When true, the authenticated app hides Ripplewatch branding and billing-surface UI (Plan,
   Team, Referrals, Developer settings tabs; tier/plan badges) for this account. Toggled from
   Admin > Accounts; used for white-labeled prospect demos, e.g. via "View as" impersonation.';
