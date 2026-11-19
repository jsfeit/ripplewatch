-- ===== 0052_signal_sentiment.sql =====
-- Whether a news/funding signal is good, bad, or neutral news for the
-- competitor's own business (not whether it's good/bad for the reader).
-- Classified alongside relevance/type in filterRelevantHeadlines (no new
-- LLM call — enriches an existing one), so Momentum's press/funding
-- component can measure whether coverage is trending better or worse
-- instead of treating all news as equally "more activity = heating up."
-- Null for existing rows and for signal types where sentiment doesn't
-- apply (pricing, job_posting) — countDelta/sentimentDelta both treat a
-- null/unclassified sentiment as neutral.
alter table signals add column if not exists sentiment text;
alter table signals drop constraint if exists signals_sentiment_check;
alter table signals add constraint signals_sentiment_check check (sentiment in ('positive', 'negative', 'neutral'));

-- ===== 0053_referrals_and_affiliates.sql =====
-- Referral program: a paying customer gets a personal shareable code
-- (accounts.referral_code, generated lazily in Settings), the company they
-- refer gets 2 months free immediately at signup (applied via a one-off
-- Stripe coupon at checkout, no column needed to track that — the checkout
-- route's existing "first paid checkout only" invariant covers it), and
-- the referrer gets their own reward only once the referral has been an
-- active paying customer for 60 days (see /api/cron/referral-rewards) —
-- deliberately not immediate, to avoid rewarding a referral that churns
-- right away.
alter table accounts add column if not exists referral_code text unique;
alter table accounts add column if not exists referred_by_account_id uuid references accounts(id) on delete set null;
-- Last coupon attached to THIS account's own subscription as a referrer
-- reward — admin visibility/debugging only, Stripe's subscription object
-- is the actual source of truth for what's applied.
alter table accounts add column if not exists referral_reward_coupon_id text;

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_account_id uuid not null references accounts(id) on delete cascade,
  -- unique: an account can only ever have been referred by one company,
  -- ever — prevents a later signup from re-attributing an existing account.
  referred_account_id uuid not null references accounts(id) on delete cascade unique,
  referred_at timestamptz not null default now(),
  -- Set once the referred account has been active/paying for 60 days —
  -- null means "still pending," checked daily by the referral-rewards cron.
  qualified_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists referrals_referrer_idx on referrals(referrer_account_id);
create index if not exists referrals_qualified_idx on referrals(qualified_at) where qualified_at is null;

alter table referrals enable row level security;

-- Referrers can see their own referral list (Settings > Refer & earn) —
-- everything else (marking qualified, applying the Stripe reward) only
-- ever happens via the service-role admin client (the cron), so no
-- insert/update policy is needed for regular users.
drop policy if exists "users can read their account's referrals" on referrals;
create policy "users can read their account's referrals"
  on referrals for select
  to authenticated
  using (referrer_account_id = auth_account_id());

-- Affiliate program: a public application form (name, email, why they'd be
-- a good fit, what channels they offer) — lead-capture only for now, no
-- automated commission tracking. Reviewed and status-updated from Admin;
-- every submission also emails jeremyripplewatch@gmail.com immediately.
create table if not exists affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  why_good_fit text not null,
  channels text not null,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table affiliate_applications enable row level security;
-- No public policies — the application API route always inserts via the
-- service-role admin client, and only Admin ever reads these.

-- ===== 0054_demo_mode.sql =====
alter table accounts add column if not exists demo_mode boolean not null default false;
comment on column accounts.demo_mode is
  'When true, the authenticated app hides Ripplewatch branding and billing-surface UI (Plan,
   Team, Referrals, Developer settings tabs; tier/plan badges) for this account. Toggled from
   Admin > Accounts; used for white-labeled prospect demos, e.g. via "View as" impersonation.';

-- ===== 0055_competitor_state_history.sql =====
-- Append-only history of scalar competitor state readings (open role count,
-- lowest public price), one row per crawl per metric. competitor_hiring and
-- competitor_pricing are upsert-only snapshot tables (see their own
-- migrations) — they answer "what's true right now" but keep no history, so
-- momentum's hiring/pricing components could only ever measure how many
-- discrete signal events fired, never the actual magnitude of change (a
-- competitor adding 1 role and one adding 40 looked identical). This table
-- lets computeMomentum compare real values across two windows instead of
-- just counting events. Populated alongside the existing upserts in
-- checkJobPostingsDiff/checkPricingStructure (src/lib/scraping.ts) — no new
-- scrape, just one more row written from data already being fetched.
create table if not exists competitor_state_history (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors (id) on delete cascade,
  metric text not null check (metric in ('open_role_count', 'lowest_price')),
  value numeric not null,
  recorded_at timestamptz not null default now()
);

create index if not exists competitor_state_history_lookup_idx
  on competitor_state_history (competitor_id, metric, recorded_at);

alter table competitor_state_history enable row level security;

-- Writes only ever happen from the cron crawl route via the service-role
-- client (bypasses RLS), same as competitor_hiring/competitor_pricing —
-- this policy is read-only.
drop policy if exists "users can read state history for their account's competitors" on competitor_state_history;
create policy "users can read state history for their account's competitors"
  on competitor_state_history for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );

-- ===== 0056_github_activity.sql =====
-- Opt-in GitHub activity tracking. Unlike pricing_url/careers_url (guessed
-- from the competitor's own domain), there's no reliable way to guess a
-- competitor's GitHub org/repo — most B2B SaaS competitors aren't open
-- source at all, and even when a GitHub org exists it's rarely obvious
-- which repo (if any) is "the product." So this is a manually-set field,
-- left null for the large majority of competitors where it doesn't apply,
-- rather than guessed-and-usually-wrong.
alter table competitors add column if not exists github_repo text;

-- Widens the metric check constraint added in 0055 to also allow a
-- periodic commit-velocity snapshot (commits in the trailing ~4 weeks,
-- from GitHub's own commit_activity API) — same append-only shape as
-- open_role_count/lowest_price, just a third source. Postgres has no
-- ALTER CHECK; drop and recreate under the same name.
alter table competitor_state_history drop constraint if exists competitor_state_history_metric_check;
alter table competitor_state_history add constraint competitor_state_history_metric_check
  check (metric in ('open_role_count', 'lowest_price', 'github_commit_velocity'));

-- ===== 0057_reviews_ads_buzz.sql =====
-- Three new momentum inputs, same "structured current-state snapshot +
-- append-only magnitude history" shape as competitor_hiring/
-- competitor_pricing/competitor_state_history:
--
-- 1. Review site sentiment (G2/Capterra) — average rating + review count,
--    the most direct "how do customers feel about them right now" read
--    Ripplewatch can get without a paid tool.
-- 2. Ad activity (Meta Ad Library) — count of currently active ads, a free
--    directional proxy for "are they ramping paid acquisition." Requires
--    META_AD_LIBRARY_ACCESS_TOKEN to be configured; the crawl simply skips
--    this check entirely when it isn't, so these rows stay empty rather
--    than showing a false zero.
-- 3. Buzz mentions (Reddit + Hacker News, both free public APIs) — mention
--    volume over the trailing 30 days plus a short LLM-written tone
--    summary, the closest free equivalent to "increases in social media
--    discussion" without a paid listening tool.
--
-- review_rating and ad_count/buzz_mentions feed momentum the same way
-- open_role_count/lowest_price/github_commit_velocity already do — see the
-- metric check constraint widened below.

alter table competitors add column if not exists g2_url text;
alter table competitors add column if not exists capterra_url text;

create table if not exists competitor_reviews (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null unique references competitors (id) on delete cascade,
  g2_rating numeric,
  g2_review_count integer,
  capterra_rating numeric,
  capterra_review_count integer,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists competitor_ads (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null unique references competitors (id) on delete cascade,
  -- A floor, not an exact count: Meta's Ad Library API doesn't return a
  -- total, so this is however many active ads the search actually returned
  -- (capped — see fetchActiveAdCount in meta-ads-data.ts), labeled as
  -- "50+" etc. in the UI rather than presented as exact.
  active_ad_count integer not null,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists competitor_buzz (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null unique references competitors (id) on delete cascade,
  mention_count_30d integer not null,
  sentiment_summary text,
  last_checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table competitor_state_history drop constraint if exists competitor_state_history_metric_check;
alter table competitor_state_history add constraint competitor_state_history_metric_check
  check (metric in (
    'open_role_count', 'lowest_price', 'github_commit_velocity',
    'review_rating', 'ad_count', 'buzz_mentions'
  ));

alter table competitor_reviews enable row level security;
alter table competitor_ads enable row level security;
alter table competitor_buzz enable row level security;

-- Writes only ever happen from the cron crawl route via the service-role
-- client (bypasses RLS), same as every other competitor_* snapshot table —
-- these policies are read-only.
drop policy if exists "users can read review data for their account's competitors" on competitor_reviews;
create policy "users can read review data for their account's competitors"
  on competitor_reviews for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );

drop policy if exists "users can read ad data for their account's competitors" on competitor_ads;
create policy "users can read ad data for their account's competitors"
  on competitor_ads for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );

drop policy if exists "users can read buzz data for their account's competitors" on competitor_buzz;
create policy "users can read buzz data for their account's competitors"
  on competitor_buzz for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );

-- ===== 0058_slack_weekly_digest_schedule.sql =====
-- Per-account schedule for the weekly Slack digest (separate from the
-- always-Monday-15:00-UTC weekly email cron): a day-of-week + hour in the
-- account's own IANA timezone, checked by an hourly cron rather than a
-- single fixed-UTC trigger. Defaults to Sunday night (day 0, hour 20) in
-- UTC until an account sets its own timezone, matching the product's
-- stated default of "Sunday night, the user's local time."
alter table accounts add column if not exists timezone text not null default 'UTC';
alter table accounts add column if not exists slack_digest_day smallint not null default 0
  check (slack_digest_day between 0 and 6); -- 0 = Sunday .. 6 = Saturday, JS Date#getDay() convention
alter table accounts add column if not exists slack_digest_hour smallint not null default 20
  check (slack_digest_hour between 0 and 23);

-- Last successful weekly-Slack-digest send, used to guard against sending
-- twice in the same account-local week if the hourly cron's local-time
-- match window and a manual/backfill run ever overlap.
alter table accounts add column if not exists slack_digest_sent_at timestamptz;

-- ===== 0059_ats_url_health.sql =====
-- Tracks consecutive fetch failures for a competitor's pricing/careers URL
-- so a stale or moved URL can self-heal instead of failing silently
-- forever. See trackUrlHealth in src/lib/scraping.ts: after
-- ATS_URL_FAILURE_REDISCOVER_THRESHOLD consecutive misses, discovery is
-- re-run from the homepage and the stored URL is replaced if a different
-- one is found; a single success resets the counter.
alter table competitors add column if not exists careers_fetch_failures smallint not null default 0;
alter table competitors add column if not exists careers_last_failed_at timestamptz;
alter table competitors add column if not exists pricing_fetch_failures smallint not null default 0;
alter table competitors add column if not exists pricing_last_failed_at timestamptz;

-- ===== 0060_feedback_submissions.sql =====
-- In-app feedback/bug reports, submitted from Settings. Same "lead-capture,
-- always emailed, reviewed by hand" model as affiliate_applications
-- (0053_referrals_and_affiliates.sql) rather than a support-ticket system —
-- this always goes straight to the founder, not a queue.
create table if not exists feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_by_email text,
  category text not null default 'general' check (category in ('bug', 'idea', 'general')),
  message text not null,
  page_path text,
  created_at timestamptz not null default now()
);

alter table feedback_submissions enable row level security;
-- No public policies — the API route always inserts via the service-role
-- admin client after authenticating the caller itself; nothing reads this
-- table back through the client (the founder gets it by email, not an
-- in-app view).

-- ===== 0061_win_loss_unattributed_and_churn.sql =====
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

drop policy if exists "users can manage win/loss entries for their own account" on competitor_win_loss;
create policy "users can manage win/loss entries for their own account"
  on competitor_win_loss for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

-- ===== 0062_changelog_blog_and_visual_diff.sql =====
-- Two more free, text-diffed page kinds alongside the existing homepage
-- check (checkProductMessagingDiff) — a competitor's changelog/release-notes
-- and blog page are exactly the same "hash it, diff on change, let the LLM
-- judge if it's meaningful" shape, just a different URL. Unlike
-- pricing/careers, not every competitor has one of these, so there's no
-- guessed-URL fallback: source_url stays null (and the row still gets
-- written, so the weekly gate applies) when nothing is found on the
-- homepage, and self-heals next week if a link shows up later.
alter table page_snapshots drop constraint if exists page_snapshots_kind_check;
alter table page_snapshots add constraint page_snapshots_kind_check
  check (kind in ('pricing', 'jobs', 'producthunt', 'websearch', 'homepage', 'changelog', 'blog'));

alter table page_snapshots add column if not exists source_url text;

-- Real visual diffing (screenshot + Claude vision comparison), gated to
-- Plus/Advanced (see VISUAL_DIFF_ALLOWED in tier-limits.ts) since unlike
-- everything else in scraping.ts this costs real money per call
-- (ScreenshotOne). Only the latest screenshot is kept per competitor — this
-- is a rolling comparison baseline, not a gallery, so there's no reason to
-- accumulate history here the way page_snapshots keeps raw_text.
create table if not exists competitor_screenshots (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null unique references competitors (id) on delete cascade,
  storage_path text not null,
  captured_at timestamptz not null default now()
);

alter table competitor_screenshots enable row level security;
-- Only ever read/written by the cron job via the service-role client, same
-- as page_snapshots (see 0002_integrations_and_scraping.sql) — no policies
-- needed for the account's own users to touch this table directly.

insert into storage.buckets (id, name, public)
values ('competitor-screenshots', 'competitor-screenshots', false)
on conflict (id) do nothing;

-- ===== 0063_affiliate_applications_program.sql =====
-- The /creators landing page (a dedicated pitch to newsletter/YouTube/X
-- creators, distinct from the general /affiliates page) submits into the
-- same affiliate_applications table rather than a new one — the fields
-- captured are identical, and payout/tracking is the same downstream
-- process either way. This column is just so Admin > Affiliates can tell
-- the two applicant pools apart at a glance.
alter table affiliate_applications add column if not exists program text not null default 'affiliate'
  check (program in ('affiliate', 'creator'));

-- ===== 0064_demo_mode_full_access.sql =====
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

-- ===== 0065_crawl_jobs_queue.sql =====
-- Decomposes the crawl from "one request does every competitor for one (or
-- every) account" into small, independently-processed jobs. The old shape
-- ran the whole fan-out inside a single Vercel function invocation bounded
-- by a 300s timeout — fine for a handful of fast competitors, but a genuine
-- ceiling that scales with total competitor/account count, not something a
-- concurrency tweak removes. One competitor's checks (a handful of fetches
-- plus a couple of LLM calls) comfortably finishes in a small fraction of
-- that budget, so shrinking the unit of work to one job = one competitor
-- removes the ceiling entirely: however many competitors or accounts exist,
-- there are just more small jobs, processed a bounded batch at a time by a
-- frequent worker cron (see /api/cron/crawl-worker), instead of one giant
-- job that can outgrow its budget.
--
-- crawl_runs groups a day's jobs for one account so scoring (which pulls
-- CRM/call-transcript data per account, not per competitor — expensive
-- enough that it should run once per day per account, same cadence as
-- today, not once per worker tick) can wait until every job in a run has
-- finished before it runs.
create table if not exists crawl_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  total_jobs int not null,
  created_at timestamptz not null default now(),
  scored_at timestamptz
);

create index if not exists crawl_runs_account_created_idx on crawl_runs (account_id, created_at desc);
-- Used by the finalize check to cheaply find not-yet-scored runs without
-- scanning every run ever created.
create index if not exists crawl_runs_unscored_idx on crawl_runs (created_at) where scored_at is null;

create table if not exists crawl_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references crawl_runs(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  competitor_id uuid not null references competitors(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

-- What the worker's claim query filters/orders by.
create index if not exists crawl_jobs_pending_idx on crawl_jobs (created_at) where status = 'pending';
-- What the finalize check joins against to see if a run is fully done.
create index if not exists crawl_jobs_run_idx on crawl_jobs (run_id);

-- Only the cron worker and admin recrawl route (both service-role) ever
-- touch these tables — no end-user-facing read/write, so RLS is enabled
-- with no policies (service role bypasses RLS entirely; every other role
-- is fully denied by default), same shape as suggested_competitors before
-- migration 0024 added member-read.
alter table crawl_runs enable row level security;
alter table crawl_jobs enable row level security;

-- SKIP LOCKED lets multiple worker invocations (should one ever overlap —
-- e.g. a slow tick still running when the next one fires) claim disjoint
-- batches instead of racing over the same rows or blocking on each other.
-- Plain SECURITY INVOKER (the default): runs under the caller's own role,
-- so this is exactly as restricted as a direct query would be — service
-- role bypasses RLS as usual, anything else is blocked by RLS with zero
-- rows affected, same as it would be without this function existing.
create or replace function claim_crawl_jobs(batch_size int)
returns setof crawl_jobs
language plpgsql
as $$
begin
  return query
    update crawl_jobs
    set status = 'running', started_at = now()
    where id in (
      select id from crawl_jobs
      where status = 'pending'
      order by created_at
      limit batch_size
      for update skip locked
    )
    returning *;
end;
$$;

-- ===== 0066_leads_metadata.sql =====
-- The quiz and competitor-snapshot capture points already collect real
-- context (quiz score/tier/weakest area, the domain someone checked and
-- what pricing we found) but throw it away — only the email lands on the
-- lead row. That context is exactly what makes a lead worth prioritizing
-- over a bare email address, so it's worth keeping. One generic jsonb
-- column rather than a growing set of single-purpose ones, since each
-- capture point's context shape is different and more capture points are
-- likely to show up over time (see leads.capture_point's own comment
-- history).
alter table leads add column if not exists metadata jsonb;

-- ===== 0067_call_mention_momentum.sql =====
-- Promotes Gong/Zoom call-mention data (already fetched per crawl for
-- signal-scoring context, see buildCallMentions in src/lib/crawl.ts) into
-- its own momentum input, same "append-only magnitude history" shape as
-- buzz_mentions/ad_count/review_rating. Previously this data was scored
-- into the picture only as narrative LLM context on individual signals —
-- it never moved a competitor's Momentum score. Opt-in like GitHub/ad
-- activity: only ever populated for accounts with a connected Gong or Zoom
-- integration on a Call Intelligence-allowed tier, so computeReliability
-- correctly zero-weights it for everyone else instead of dragging their
-- score down.

alter table competitor_state_history drop constraint if exists competitor_state_history_metric_check;
alter table competitor_state_history add constraint competitor_state_history_metric_check
  check (metric in (
    'open_role_count', 'lowest_price', 'github_commit_velocity',
    'review_rating', 'ad_count', 'buzz_mentions', 'call_mention_count'
  ));

-- ===== 0068_leads_drip_paused.sql =====
-- Lets an admin stop the automated lead-drip emails for one lead — the case
-- that prompted this: a cold-outreach prospect replied to a founder-written
-- email and started using the competitor snapshot tool, which captured them
-- as a lead, so the daily lead-drip cron would have started sending them
-- automated "finish signing up" nudges in the middle of a real
-- conversation. The cron skips any lead with this set (see
-- /api/cron/lead-drip); nothing else about the lead changes.
alter table leads add column if not exists drip_paused_at timestamptz;

-- ===== 0069_leads_snapshot_drip_steps.sql =====
-- Snapshot signups get their own longer follow-up series (6 emails over ~6
-- weeks, see sendSnapshotDripEmail in src/lib/resend.ts) instead of the
-- generic 3-step quiz/onboarding drip, whose copy ("you started setting up
-- Ripplewatch") doesn't fit someone who only tried the free snapshot tool.
-- Steps 1-3 reuse the existing columns; these add tracking for 4-6.
alter table leads add column if not exists drip_email_4_sent_at timestamptz;
alter table leads add column if not exists drip_email_5_sent_at timestamptz;
alter table leads add column if not exists drip_email_6_sent_at timestamptz;

-- ===== 0070_manual_followups.sql =====
-- The queue behind "a person will take a look": every time the automated
-- checks (direct fetch, archived copies, public-sources research) can't give a
-- reliable answer for a domain, a row lands here and an alert goes to the
-- operator, who resolves it from Admin -> Follow-ups.
--
-- Two kinds:
--   snapshot    a visitor to the public competitor-snapshot tool; resolving it
--               emails them the manually gathered result.
--   competitor  a competitor a paying customer added that we couldn't read;
--               resolving it writes the manually gathered pricing/hiring into
--               that competitor's real records so it shows up in their
--               dashboard.
--
-- Written and read only through the service-role client (no RLS policies),
-- same as system_alerts.
create table if not exists manual_followups (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('snapshot', 'competitor')),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  domain text not null,
  -- Why the automation gave up: blocked | unreachable | ok (loaded but nothing
  -- readable) | unread (pricing/hiring not read directly, research draft only).
  reason text,
  requester_email text,
  lead_id uuid references leads (id) on delete set null,
  account_id uuid references accounts (id) on delete cascade,
  competitor_id uuid references competitors (id) on delete cascade,
  competitor_name text,
  -- The public-sources research result, if any, as a starting point to verify
  -- rather than something published to a customer unreviewed.
  draft jsonb,
  -- What the operator entered when resolving.
  resolution jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists manual_followups_status_idx on manual_followups (status, created_at desc);

-- One open item per competitor / per lead+domain, so a repeat lookup or a
-- re-crawl doesn't stack duplicates.
create unique index if not exists manual_followups_pending_competitor_idx
  on manual_followups (competitor_id) where status = 'pending' and competitor_id is not null;
create unique index if not exists manual_followups_pending_lead_domain_idx
  on manual_followups (lead_id, domain) where status = 'pending' and lead_id is not null;

alter table manual_followups enable row level security;

-- ===== 0071_user_activity.sql =====
-- Who signed in and what they open, for Admin -> Users / Accounts.
--
-- Supabase Auth already keeps created_at (sign-up) and last_sign_in_at, but
-- not a count of sign-ins or anything about what a person does afterwards.
--   login   one row per explicit sign-in on the login form
--   view    one row per in-app page a signed-in customer opens
--           (path is the feature route, e.g. /app/win-loss, never a query
--           string or an id)
-- Written and read only through the service-role client (no RLS policies),
-- same as llm_usage. Admin "view as" sessions never write here.
create table if not exists user_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  account_id uuid references accounts (id) on delete cascade,
  kind text not null check (kind in ('login', 'view')),
  path text,
  created_at timestamptz not null default now()
);

create index if not exists user_activity_user_idx on user_activity (user_id, created_at desc);
create index if not exists user_activity_account_idx on user_activity (account_id, created_at desc);

alter table user_activity enable row level security;

-- ===== 0072_market_profile.sql =====
-- The macro context Industry Pulse doesn't provide: what market this
-- account actually competes in (name, maturity, growth direction) and
-- where their own product sits in it, synthesized from the same
-- already-sourced research industry_trends and accounts.company_research
-- produce, not a fresh unrelated pass. See src/lib/market-profile.ts.
--
-- One row per account (not append-only like industry_trends): this is a
-- current snapshot that gets replaced on refresh, not a feed of dated
-- items, so accounts.id is the natural key rather than a generated_at
-- history.
create table if not exists market_profile (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references accounts (id) on delete cascade,
  market_name text not null,
  market_description text not null,
  maturity text not null check (maturity in ('emerging', 'growing', 'mature', 'consolidating')),
  growth_direction text not null check (growth_direction in ('heating_up', 'steady', 'cooling')),
  growth_reason text not null,
  -- [{ text, source: { name, url } | null }] — same shape as
  -- industry_trends.trends[].source. A dynamic without a source is kept
  -- (it may be synthesized from the account's own already-sourced
  -- company_research rather than a fresh citation) but the UI treats an
  -- unsourced one differently than a cited one.
  dynamics jsonb not null default '[]'::jsonb,
  product_summary text not null,
  generated_at timestamptz not null default now(),
  -- Set when a person edits any field by hand. While set, the monthly
  -- refresh cron skips this account so it never silently overwrites a
  -- correction; Regenerate clears it.
  user_edited_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists market_profile_account_idx on market_profile (account_id);

alter table market_profile enable row level security;

-- Read follows industry_trends's "for all" shape. Update is its own policy,
-- unlike industry_trends: a member can correct their own market profile in
-- place (see PATCH /api/market-profile), same "users can manage their own"
-- shape as competitors (migration 0001) but update-only — insert stays
-- service-role-only (generation is always the LLM synthesis, never a blank
-- row a member creates by hand) and there's nothing to delete (Regenerate
-- overwrites, it doesn't remove).
drop policy if exists "users can read their account's market profile" on market_profile;
create policy "users can read their account's market profile"
  on market_profile for select
  to authenticated
  using (account_id = auth_account_id());

drop policy if exists "users can update their account's market profile" on market_profile;
create policy "users can update their account's market profile"
  on market_profile for update
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

-- ===== 0073_customer_voice.sql =====
-- "Voice of customer" — Ripplewatch has always tracked competitors
-- extensively but never gave an account's own customer sentiment any
-- structured home; it lived (if anywhere) buried in the free-text
-- won_deal_notes/lost_deal_notes/churn_notes blob, same problem win/loss
-- itself had before 0027. This gives NPS-style survey scores and
-- standalone customer asks/feature-requests their own dated, queryable
-- rows, the same "structured log, not a text blob" pattern win/loss
-- already established — feeding fact sheets and market profile with real
-- customer signal instead of only competitor signal.

create table if not exists account_nps_responses (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  -- Standard 0-10 NPS scale — promoter/passive/detractor bucketing (9-10 /
  -- 7-8 / 0-6) is computed in application code from this, not stored, so
  -- the bucketing rule can change without a backfill.
  score smallint not null check (score between 0 and 10),
  reason text,
  -- Free text, not a foreign key — this is the ACCOUNT's own customer who
  -- gave the response, not a Ripplewatch user, so there's no table row to
  -- reference. Optional: a bulk CSV import commonly has no per-response
  -- identity at all.
  respondent text,
  -- When the response was actually collected, not when it was logged here
  -- — matters for building a real trend line out of a backfilled CSV
  -- import, where every row would otherwise land on the same import date.
  survey_date date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'csv_import')),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table account_nps_responses enable row level security;

drop policy if exists "users can manage NPS responses for their own account" on account_nps_responses;
create policy "users can manage NPS responses for their own account"
  on account_nps_responses for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

create index if not exists account_nps_responses_account_id_idx on account_nps_responses (account_id, survey_date);

-- Separate from an NPS response's own reason text: an ask can come from
-- anywhere (a sales call, a support ticket, a survey open-end), not only a
-- scored NPS response, and it needs its own lifecycle (new -> considering
-- -> planned -> shipped/declined) rather than just sitting as a comment
-- next to a score.
create table if not exists account_customer_asks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  summary text not null,
  source text,
  status text not null default 'new' check (status in ('new', 'considering', 'planned', 'shipped', 'declined')),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table account_customer_asks enable row level security;

drop policy if exists "users can manage customer asks for their own account" on account_customer_asks;
create policy "users can manage customer asks for their own account"
  on account_customer_asks for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

create index if not exists account_customer_asks_account_id_idx on account_customer_asks (account_id, status);

-- ===== 0074_customer_feedback_consolidated.sql =====
-- Replaces 0073's two-table split (account_nps_responses +
-- account_customer_asks) with one table — the split read as two disconnected
-- systems in the UI (two panels, two forms, two imports) for what's really
-- one concept: a piece of feedback from the account's own customer, which
-- MAY carry a 0-10 NPS score. Modeled directly on competitor_win_loss
-- (0027): one outcome-flexible log, one form, one CSV import, not a rigid
-- type per shape. Both source tables are empty in production (shipped
-- moments ago, nothing logged yet), so this drops and replaces rather than
-- migrating rows.

drop table if exists account_nps_responses;
drop table if exists account_customer_asks;

create table if not exists account_customer_feedback (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  -- Always required — even a pure NPS entry needs SOME text (the reason),
  -- same as how a win/loss "general" entry requires a real reason. For a
  -- score-only response with nothing else recorded, callers fall back to a
  -- short generated summary rather than leaving this empty.
  summary text not null,
  -- Optional: the "NPS as one example" part — present when this entry is a
  -- scored survey response, null for a plain ask/feature-request with no
  -- score attached. Nothing else about the row's shape changes based on
  -- whether this is set.
  score smallint check (score between 0 and 10),
  -- Free text, where this came from (e.g. "Support ticket", "Sales call",
  -- "Survey") — not a foreign key, same reasoning as competitor_win_loss's
  -- reason field: this describes an external event, not a Ripplewatch row.
  source text,
  respondent text,
  status text not null default 'new' check (status in ('new', 'considering', 'planned', 'shipped', 'declined')),
  -- When the feedback was actually given, not when it was logged here —
  -- matters for a backfilled CSV import to produce a real trend line
  -- instead of every row landing on the import date.
  feedback_date date not null default current_date,
  origin text not null default 'manual' check (origin in ('manual', 'csv_import')),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table account_customer_feedback enable row level security;

drop policy if exists "users can manage customer feedback for their own account" on account_customer_feedback;
create policy "users can manage customer feedback for their own account"
  on account_customer_feedback for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

create index if not exists account_customer_feedback_account_id_idx on account_customer_feedback (account_id, feedback_date);

-- ===== 0075_remove_advanced_tier.sql =====
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

-- ===== 0076_connect_wallet.sql =====
-- Ripplewatch Connect: a standalone, prepaid product. The customer pays a
-- monthly platform fee (a normal Stripe subscription) and funds a wallet that
-- usage draws down. Credits are only added after a payment succeeds and usage
-- is refused at a zero balance, so there is never usage on credit.
--
-- The wallet lives here (not in Stripe) because Stripe Billing has no
-- prepaid-with-auto-reload primitive: its billing credits apply at invoice
-- time, so a customer can spend past a balance and be billed afterward. Stripe
-- still collects every payment; this ledger records what was bought and used.

-- 'connect' is an account tier alongside starter and plus: a Connect account
-- has no dashboard plan, just the platform fee and the wallet.
alter table accounts drop constraint if exists accounts_tier_check;
alter table accounts
  add constraint accounts_tier_check
  check (tier in ('starter', 'plus', 'connect'));

-- Amounts are stored in micro-dollars (millionths of a dollar): a single
-- answer can cost a fraction of a cent, which whole cents would round away.
create table if not exists connect_wallets (
  account_id uuid primary key references accounts (id) on delete cascade,
  balance_micros bigint not null default 0,
  -- Auto-reload: when the balance falls below the threshold, charge the saved
  -- card for the reload amount. Minimum reload is $50 (enforced in the app).
  auto_reload_enabled boolean not null default true,
  reload_amount_cents integer not null default 5000 check (reload_amount_cents >= 5000),
  reload_threshold_cents integer not null default 1000 check (reload_threshold_cents >= 0),
  -- Set when an auto-reload payment fails; auto-reload stays off until the
  -- customer fixes their card and re-enables it, rather than retrying forever.
  reload_failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists connect_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  kind text not null check (kind in ('funding', 'usage', 'refund', 'adjustment')),
  -- Positive adds credit, negative uses it.
  amount_micros bigint not null,
  balance_after_micros bigint not null,
  -- Idempotency key, unique per account: a Stripe invoice id for funding, a
  -- tool-call id or day key for usage. Applying the same ref twice is a no-op,
  -- so a retried webhook or cron can't double-credit or double-charge.
  ref text not null,
  description text,
  meta jsonb,
  created_at timestamptz not null default now(),
  unique (account_id, ref)
);

create index if not exists connect_wallet_ledger_account_idx
  on connect_wallet_ledger (account_id, created_at desc);

alter table connect_wallets enable row level security;
alter table connect_wallet_ledger enable row level security;

-- Customers can read their own balance and history. Nothing writes through
-- RLS: every change goes through connect_wallet_apply below, run with the
-- service role.
drop policy if exists "users can read their own wallet" on connect_wallets;
create policy "users can read their own wallet"
  on connect_wallets for select
  to authenticated
  using (account_id = auth_account_id());

drop policy if exists "users can read their own wallet ledger" on connect_wallet_ledger;
create policy "users can read their own wallet ledger"
  on connect_wallet_ledger for select
  to authenticated
  using (account_id = auth_account_id());

-- The one way the balance changes. Atomic and idempotent:
--   * serialized per account with an advisory lock, so two concurrent calls
--     can't both pass a balance check;
--   * a ref that's already in the ledger is a no-op (applied = false);
--   * a debit that would take the balance below zero is refused unless
--     p_allow_negative is set (used only for the small overrun of a call that
--     already ran, which the caller bounds with a minimum-balance check).
create or replace function connect_wallet_apply(
  p_account_id uuid,
  p_amount_micros bigint,
  p_kind text,
  p_ref text,
  p_description text default null,
  p_meta jsonb default null,
  p_allow_negative boolean default false
)
returns table (applied boolean, balance_micros bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
begin
  perform pg_advisory_xact_lock(hashtext('connect_wallet:' || p_account_id::text));

  insert into connect_wallets (account_id) values (p_account_id) on conflict (account_id) do nothing;

  if exists (select 1 from connect_wallet_ledger l where l.account_id = p_account_id and l.ref = p_ref) then
    select w.balance_micros into v_balance from connect_wallets w where w.account_id = p_account_id;
    return query select false, v_balance;
    return;
  end if;

  select w.balance_micros into v_balance from connect_wallets w where w.account_id = p_account_id;

  if p_amount_micros < 0 and not p_allow_negative and v_balance + p_amount_micros < 0 then
    return query select false, v_balance;
    return;
  end if;

  v_balance := v_balance + p_amount_micros;

  update connect_wallets w
     set balance_micros = v_balance, updated_at = now()
   where w.account_id = p_account_id;

  insert into connect_wallet_ledger (account_id, kind, amount_micros, balance_after_micros, ref, description, meta)
  values (p_account_id, p_kind, p_amount_micros, v_balance, p_ref, p_description, p_meta);

  return query select true, v_balance;
end;
$$;

revoke all on function connect_wallet_apply(uuid, bigint, text, text, text, jsonb, boolean) from public;
revoke all on function connect_wallet_apply(uuid, bigint, text, text, text, jsonb, boolean) from anon, authenticated;
grant execute on function connect_wallet_apply(uuid, bigint, text, text, text, jsonb, boolean) to service_role;

-- ===== 0077_connect_wallet_reload_claim.sql =====
-- Auto-reload needs one thing the base wallet (0076) doesn't have: a way to
-- make sure only ONE reload charge starts when several calls notice a low
-- balance at the same moment. connect_wallet_claim_reload is an atomic claim:
-- it returns true to exactly one caller, only when a reload is actually due,
-- and holds the claim for a few minutes so a slow or crashed attempt doesn't
-- block the wallet forever.

alter table connect_wallets add column if not exists reload_started_at timestamptz;

create or replace function connect_wallet_claim_reload(p_account_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claimed uuid;
begin
  update connect_wallets w
     set reload_started_at = now()
   where w.account_id = p_account_id
     and w.auto_reload_enabled
     and w.reload_failed_at is null
     -- balance is in micro-dollars, the threshold in cents (1 cent = 10,000 micros)
     and w.balance_micros < (w.reload_threshold_cents::bigint * 10000)
     and (w.reload_started_at is null or w.reload_started_at < now() - interval '5 minutes')
  returning w.account_id into v_claimed;

  return v_claimed is not null;
end;
$$;

revoke all on function connect_wallet_claim_reload(uuid) from public;
revoke all on function connect_wallet_claim_reload(uuid) from anon, authenticated;
grant execute on function connect_wallet_claim_reload(uuid) to service_role;

-- ===== 0078_remove_starter_tier.sql =====
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

-- ===== 0079_connect_mcp_last_connected.sql =====
-- Tracks the last time an account authenticated a real MCP request (a
-- connector call from Claude/ChatGPT, or an API key from another tool),
-- so Settings can show a genuine "connected" status instead of just
-- assuming a copied URL was ever pasted anywhere. Set from
-- /api/mcp/route.ts on every successfully authenticated request.
alter table accounts add column if not exists mcp_last_connected_at timestamptz;

-- ===== 0080_connect_get_started_dismissed.sql =====
-- Tracks whether a Connect account has finished or explicitly skipped the
-- post-checkout get-started flow (MCP connect + optional context setup), so
-- /app/get-started/page.tsx can stop redirecting them back once they're
-- done, independent of whether they filled in positioning/competitors.
alter table accounts add column if not exists connect_get_started_dismissed_at timestamptz;

-- ===== 0081_connect_onboarding_emails.sql =====
-- Lifecycle emails for Connect accounts: a day-2 "here's what we found" and a
-- day-7 check-in, each sent at most once, plus a per-account opt-out. The
-- existing drip tracks leads (pre-signup); these track paying accounts.
alter table accounts add column if not exists onboarding_email_day2_sent_at timestamptz;
alter table accounts add column if not exists onboarding_email_day7_sent_at timestamptz;
alter table accounts add column if not exists onboarding_emails_unsubscribed_at timestamptz;

-- ===== 0082_call_mentions.sql =====
-- Individual competitor mentions from sales calls, logged by the customer's
-- assistant after reading their own call tool (Gong, Zoom, etc.) through that
-- tool's MCP. Until now call mentions only ever existed as a per-crawl count
-- (competitor_state_history.call_mention_count) with nothing behind it, so
-- nothing could be shown, audited or deduplicated.
--
-- dedupe_key is a hash of competitor + date + quote, so an assistant that
-- re-reads the same calls on a later refresh doesn't double count. Writes go
-- through the service role (the MCP tool); customers can read their own.
create table if not exists call_mentions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  competitor_id uuid not null references competitors (id) on delete cascade,
  quote text not null,
  occurred_on date not null default current_date,
  source text not null default 'assistant',
  dedupe_key text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists call_mentions_dedupe_idx on call_mentions (account_id, dedupe_key);
create index if not exists call_mentions_competitor_idx on call_mentions (competitor_id, occurred_on desc);

alter table call_mentions enable row level security;

drop policy if exists "users can read their account's call mentions" on call_mentions;
create policy "users can read their account's call mentions"
  on call_mentions for select
  to authenticated
  using (account_id = auth_account_id());

-- ===== 0083_connect_notification_prefs.sql =====
-- Connect accounts get two new emails: a daily alert on days with a
-- High-relevance competitor change, and a monthly recap. Both default on, each
-- has an opt-out switch, and the recap records when it last went out so a
-- re-run of the cron can't send it twice in one month.
alter table accounts add column if not exists connect_daily_alert_enabled boolean not null default true;
alter table accounts add column if not exists connect_monthly_recap_enabled boolean not null default true;
alter table accounts add column if not exists connect_monthly_recap_sent_at timestamptz;

-- ===== 0084_connect_email_with_slack.sql =====
-- Slack is where a Connect team sees alerts and recaps. Email is the fallback
-- for accounts without Slack, or an explicit extra for those with it: this
-- records that choice. Default false means "Slack only" once Slack is connected.
alter table accounts add column if not exists connect_email_with_slack boolean not null default false;

-- ===== 0085_live_reads.sql =====
-- One row per free "live read" run on the signup page, before an account exists.
-- Until now nothing about these was kept, so there was no way to see who tried it,
-- on which competitor, what the read said, or whether they went on to sign up.
--
-- account_id starts null and is filled in when the same visitor finishes setup
-- (the browser holds the read's id until then). Written and read only through
-- the service role: visitors are anonymous, and the admin page is the only reader.
create table if not exists live_reads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  company_name text,
  positioning text,
  icp text,
  competitor_domain text not null,
  competitor_name text,
  -- null when the lookup finished but no read could be written
  confidence text check (confidence in ('evidence', 'thin')),
  evidence text[] not null default '{}',
  read jsonb,
  account_id uuid references accounts (id) on delete set null
);

create index if not exists live_reads_created_idx on live_reads (created_at desc);
create index if not exists live_reads_account_idx on live_reads (account_id);

-- No policies on purpose: with row level security on and nothing granted, only the
-- service role can touch it.
alter table live_reads enable row level security;

-- ===== 0086_contact_messages.sql =====
-- Every message sent through the /contact form, kept in addition to the email
-- to the operator, so a message can't be lost if the email fails or lands in spam.
-- Written only through the service role (visitors are anonymous).
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  topic text not null,
  name text not null,
  email text not null,
  company text,
  message text,
  -- whether the alert email to the operator went out
  emailed boolean not null default false
);

create index if not exists contact_messages_created_idx on contact_messages (created_at desc);

-- No policies on purpose: with row level security on and nothing granted, only the
-- service role can touch it.
alter table contact_messages enable row level security;

-- ===== 0087_live_reads_utm.sql =====
-- Remember which campaign or post sent the visitor who ran a free live read.
-- Until now the UTM tags on the email links (utm_source / utm_medium / utm_campaign)
-- were only kept on leads, so a free read from an Instantly email could not be tied
-- back to the campaign that sent it. Nullable and additive: existing rows stay as they are.
alter table live_reads
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

-- ===== 0088_mcp_connections.sql =====
-- Which AI assistant each connected account uses, and how much.
-- Until now the only trace of a connection was accounts.mcp_last_connected_at, so there was no
-- way to tell Claude from ChatGPT from a directory's health checker, or to see which listing
-- brought a user in. One row per account and OAuth client: the consent screen records who asked
-- (name and where it redirects back to), and every MCP request after that bumps last_seen_at and
-- request_count. A connection made before this shipped appears as 'unknown' on its next request.
create table if not exists mcp_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  client_id text not null,
  client_name text,
  redirect_host text,
  assistant text not null default 'unknown',
  first_connected_at timestamptz not null default now(),
  last_seen_at timestamptz,
  request_count integer not null default 0,
  unique (account_id, client_id)
);

create index if not exists mcp_connections_assistant_idx on mcp_connections (assistant);
create index if not exists mcp_connections_last_seen_idx on mcp_connections (last_seen_at desc);

-- No policies on purpose: with row level security on and nothing granted, only the service role
-- can touch it.
alter table mcp_connections enable row level security;

-- Atomic "saw a request from this client". Inserts the row if the connection pre-dates this table.
create or replace function mcp_connection_touch(p_account_id uuid, p_client_id text)
returns void
language sql
as $$
  insert into mcp_connections (account_id, client_id, last_seen_at, request_count)
  values (p_account_id, p_client_id, now(), 1)
  on conflict (account_id, client_id)
  do update set last_seen_at = now(), request_count = mcp_connections.request_count + 1;
$$;

revoke execute on function mcp_connection_touch(uuid, text) from public, anon, authenticated;

-- ===== 0089_data_retention.sql =====
-- 30-day retention after cancelling: when the subscription was cancelled, and
-- when the "your data will be deleted" notice went out. /api/cron/retention
-- deletes an account's data 30 days after canceled_at (only when
-- RETENTION_DELETE_ENABLED=true; otherwise it just reports what it would do).
alter table accounts add column if not exists canceled_at timestamptz;
alter table accounts add column if not exists retention_notice_sent_at timestamptz;

-- Accounts already cancelled get a fresh 30 days from now, never an immediate deletion.
update accounts set canceled_at = now() where subscription_status = 'canceled' and canceled_at is null;

create index if not exists accounts_canceled_at_idx on accounts (canceled_at) where canceled_at is not null;

-- ===== 0090_audit_log.sql =====
-- Audit log: who did what on an account, shown to the account owner in
-- Settings and exportable as CSV. Rows are written by the server with the
-- service role and read through an owner-only route, so RLS is on with no
-- policies. Kept 12 months (/api/cron/audit-log-purge) and removed with the
-- account.
create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  actor_type text not null check (actor_type in ('user', 'assistant', 'system')),
  actor_id uuid,
  actor_label text,
  action text not null,
  target text,
  detail jsonb,
  ip text
);

create index if not exists audit_log_account_created_idx on audit_log (account_id, created_at desc);
create index if not exists audit_log_created_idx on audit_log (created_at);

alter table audit_log enable row level security;

-- ===== 0091_snapshot_cache.sql =====
-- Recent competitor lookups for the free read, one row per domain. The same big competitors get
-- named again and again by different visitors, and the lookup (news search, pricing page, a year of
-- pricing history) is what costs money, so a lookup under two days old is reused instead of redone.
-- Written and read by the server with the service role only, so RLS is on with no policies. A row is
-- replaced the next time its domain is looked up; a stale row is simply ignored.
create table if not exists snapshot_cache (
  domain text primary key,
  result jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table snapshot_cache enable row level security;

-- ===== 0092_deal_intelligence.sql =====
-- Win/loss rows become real deals with a real timeline.
--
-- Until now a row only knew when it was LOGGED (created_at), so a bulk import of last year's losses
-- all landed on the day of the import and every "did losses cluster after a competitor's move"
-- calculation saw one big spike today. closed_on is the deal's own close date; readers use
-- coalesce(closed_on, created_at::date). The other columns keep what the source said (deal id,
-- amount, owner, segment, the raw row) so a re-import updates a deal instead of duplicating it, and
-- so the interpretation can always be traced back to the row it came from.
--
-- reason_themes / reason_detail are the structured read of the free-text reason, so counting
-- "losses citing price" or "losses citing reporting" is a query, not a fresh LLM pass each time.

alter table competitor_win_loss add column if not exists closed_on date;
alter table competitor_win_loss add column if not exists amount numeric;
alter table competitor_win_loss add column if not exists deal_ref text;
alter table competitor_win_loss add column if not exists deal_name text;
alter table competitor_win_loss add column if not exists owner text;
alter table competitor_win_loss add column if not exists segment text;
alter table competitor_win_loss add column if not exists source text not null default 'manual';
alter table competitor_win_loss add column if not exists import_id uuid;
alter table competitor_win_loss add column if not exists raw jsonb;
alter table competitor_win_loss add column if not exists reason_themes text[] not null default '{}';
alter table competitor_win_loss add column if not exists reason_detail text;
alter table competitor_win_loss add column if not exists competitor_raw text;

-- One row per deal per account. NULL deal_refs (manual entries) never collide with each other, and the
-- index is not partial so an upsert can name it as its conflict target.
create unique index if not exists competitor_win_loss_deal_ref_idx
  on competitor_win_loss (account_id, deal_ref);
create index if not exists competitor_win_loss_closed_on_idx on competitor_win_loss (account_id, closed_on);
create index if not exists competitor_win_loss_import_idx on competitor_win_loss (import_id);

-- One row per upload / assistant import: what column mapping was used and how much came in, so a bad
-- mapping can be found and undone (delete the rows with that import_id).
create table if not exists win_loss_imports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  source text not null,
  filename text,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  mapping jsonb,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table win_loss_imports enable row level security;

drop policy if exists "users can manage imports for their own account" on win_loss_imports;
create policy "users can manage imports for their own account"
  on win_loss_imports for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

-- Free-form things the team knows that no CRM holds: what they are building and when it ships,
-- pricing plans, a customer's offhand comment, a sales call insight. The text is stored as written;
-- kind/status/product_areas/themes are the structured read of it, so it can be lined up against loss
-- reasons and competitor moves.
create table if not exists context_notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  body text not null,
  kind text not null default 'other'
    check (kind in ('roadmap', 'pricing', 'customer', 'sales', 'market', 'other')),
  status text check (status in ('idea', 'planned', 'in_progress', 'shipped')),
  product_areas text[] not null default '{}',
  themes text[] not null default '{}',
  effective_on date not null default current_date,
  expected_on date,
  source text not null default 'manual',
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists context_notes_account_idx on context_notes (account_id, effective_on desc);

alter table context_notes enable row level security;

drop policy if exists "users can manage context notes for their own account" on context_notes;
create policy "users can manage context notes for their own account"
  on context_notes for all
  to authenticated
  using (account_id = auth_account_id())
  with check (account_id = auth_account_id());

-- The latest "what is costing us deals" read for an account. Facts are computed in code and the model
-- only writes the interpretation; input_hash lets an unchanged account reuse the last one instead of
-- paying for a new generation.
create table if not exists deal_impact_briefs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts (id) on delete cascade,
  findings jsonb not null default '[]',
  coverage jsonb not null default '{}',
  input_hash text not null,
  generated_at timestamptz not null default now()
);

create index if not exists deal_impact_briefs_account_idx on deal_impact_briefs (account_id, generated_at desc);

alter table deal_impact_briefs enable row level security;

drop policy if exists "users can read impact briefs for their own account" on deal_impact_briefs;
create policy "users can read impact briefs for their own account"
  on deal_impact_briefs for select
  to authenticated
  using (account_id = auth_account_id());

