-- Cached web-search-grounded research on the account's OWN company (not a
-- competitor) — a short summary of real public market position, products,
-- and differentiators, used to ground scoreSignal's "why it matters"
-- reasoning when onboarding's positioning/ICP text is thin or generic.
-- Computed once (at onboarding completion, or lazily backfilled for
-- existing accounts during a crawl — see ensureCompanyResearch in
-- crawl.ts) and reused on every scoring call afterward, not researched
-- per-signal, to keep this a one-time cost rather than a recurring one.
alter table accounts add column if not exists company_research text;
alter table accounts add column if not exists company_research_updated_at timestamptz;
