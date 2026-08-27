-- Tracks whether a user has seen the guided post-signup product tour, so
-- it fires automatically exactly once on their first dashboard visit and
-- never again (Settings > Appearance offers a manual replay regardless of
-- this flag). Per-user, not per-account: each teammate who joins later
-- should get their own first-visit tour.
alter table profiles add column if not exists has_seen_product_tour boolean not null default false;
