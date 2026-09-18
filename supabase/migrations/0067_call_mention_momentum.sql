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
