-- Postgres does not auto-index foreign keys (only PK/unique columns get an
-- index for free). These four columns are filtered on every dashboard load
-- and every RLS policy check on their tables, so without an explicit index
-- each of those is a sequential scan that gets slower as the table grows.
create index if not exists competitors_account_id_idx on competitors (account_id);
create index if not exists signals_competitor_id_idx on signals (competitor_id);
create index if not exists competitor_win_loss_competitor_id_idx on competitor_win_loss (competitor_id);
create index if not exists win_loss_trends_account_id_idx on win_loss_trends (account_id);
