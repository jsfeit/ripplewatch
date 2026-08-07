-- Two new page_snapshots kinds, both reusing the existing
-- hash-diff-then-signal pattern (see checkJobPostingsDiff) rather than new
-- tables:
--   'producthunt' — stubbed Product Hunt launch tracking (see
--     src/lib/producthunt-data.ts), diffed the same way as job listings.
--   'websearch' — not a real snapshot, just a cadence marker so
--     checkSearchNews (Claude web-search-grounded news, gated off by
--     ENABLE_WEB_SEARCH_NEWS) runs at most weekly per competitor once
--     enabled, instead of every crawl.
alter table page_snapshots drop constraint if exists page_snapshots_kind_check;
alter table page_snapshots add constraint page_snapshots_kind_check
  check (kind in ('pricing', 'jobs', 'producthunt', 'websearch'));
