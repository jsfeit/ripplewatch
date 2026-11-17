-- Churn insight and consumer review sources. Everything here is filled in behind the scenes:
-- nothing in setup asks the customer for it.
--
-- industry_benchmark: the typical monthly churn range for the account's kind of product, with the
-- source it came from, researched on demand (never invented) and refreshed when it is stale.
-- It is null until researched, and a null range inside it means no credible source was found.
--
-- competitors.sells_to: which side a competitor competes on, for an account that sells to both
-- businesses and consumers. Read from the competitor's own website and correctable by the customer.
-- Null means not known yet, which counts as both.
--
-- appstore_id / trustpilot_url and the matching rating columns: consumer products are rated on the
-- App Store and Trustpilot, not G2 and Capterra. They feed the same review-rating momentum input.

alter table accounts add column if not exists industry_benchmark jsonb;
alter table accounts add column if not exists industry_benchmark_updated_at timestamptz;

alter table competitors add column if not exists sells_to text;
alter table competitors drop constraint if exists competitors_sells_to_check;
alter table competitors add constraint competitors_sells_to_check
  check (sells_to is null or sells_to in ('business', 'consumer', 'both'));
alter table competitors add column if not exists appstore_id text;
alter table competitors add column if not exists trustpilot_url text;

alter table competitor_reviews add column if not exists appstore_rating numeric;
alter table competitor_reviews add column if not exists appstore_review_count integer;
alter table competitor_reviews add column if not exists trustpilot_rating numeric;
alter table competitor_reviews add column if not exists trustpilot_review_count integer;
