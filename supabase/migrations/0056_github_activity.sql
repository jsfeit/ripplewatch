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
