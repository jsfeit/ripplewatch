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
create policy "users can read review data for their account's competitors"
  on competitor_reviews for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );

create policy "users can read ad data for their account's competitors"
  on competitor_ads for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );

create policy "users can read buzz data for their account's competitors"
  on competitor_buzz for select
  to authenticated
  using (
    competitor_id in (select id from competitors where account_id = auth_account_id())
  );
