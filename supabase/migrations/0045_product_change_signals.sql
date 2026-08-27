-- New signal type 'product_change' — homepage copy diffed the same
-- hash-then-LLM-diff way as pricing (see checkPricingDiff), but watching
-- for positioning/feature shifts instead of price changes. Works for any
-- competitor size (crawls their own site, no dependence on news coverage
-- or review volume), and flows into the existing win/loss trend
-- correlation (identifyWinLossTrends) with no changes there — it already
-- pools every scored signal type from the last 90 days.
alter table signals drop constraint if exists signals_type_check;
alter table signals add constraint signals_type_check
  check (type in ('pricing', 'job_posting', 'review', 'news', 'funding', 'seo', 'product_change'));

alter table page_snapshots drop constraint if exists page_snapshots_kind_check;
alter table page_snapshots add constraint page_snapshots_kind_check
  check (kind in ('pricing', 'jobs', 'producthunt', 'websearch', 'homepage'));
