-- demo_mode no longer strips branding/tabs for a white-labeled prospect
-- view — it now grants the exact same app as a real account (full
-- Advanced tier, every tab, real branding), with billing as the one
-- restriction (enforced in the Stripe API routes) and a red DEMO banner
-- in the app shell making that plain. Comment updated to match; no schema
-- change, the column itself is unchanged.
comment on column accounts.demo_mode is
  'When true, grants full Advanced-tier access (see effectiveTier in tier-limits.ts) with an
   uncapped competitor count, and shows a red "DEMO" banner in the app shell. Billing actions
   are blocked server-side (see the Stripe API routes). Toggled from Admin > Accounts.';
