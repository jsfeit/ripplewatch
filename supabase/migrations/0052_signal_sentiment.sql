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
alter table signals add constraint signals_sentiment_check check (sentiment in ('positive', 'negative', 'neutral'));
