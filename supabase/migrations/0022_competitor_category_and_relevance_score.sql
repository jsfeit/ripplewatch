-- Short business-category/description per competitor (e.g. "Accounting/ERP
-- software for SMBs"), AI-suggested when a competitor is added and editable
-- afterward. Gives the news-relevance pre-filter real context to tell a
-- competitor apart from an unrelated company/entity that happens to share
-- its name (e.g. "Sage" the ERP vendor vs. "Sage" the senior-care company).
alter table competitors add column if not exists category text;

-- Raw numeric relevance score (0-100) behind relevance_level, so bucket
-- thresholds can be tuned later against signal_eval_labels without
-- re-running the scoring model, and so score distribution can actually be
-- inspected instead of only seeing which of 3 buckets each signal landed in.
alter table signals add column if not exists relevance_score integer;
