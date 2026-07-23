-- Lets news/funding signals link back to the source article, and powers
-- the Articles tab's "view source" link.
alter table signals add column if not exists url text;
