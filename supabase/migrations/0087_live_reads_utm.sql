-- Remember which campaign or post sent the visitor who ran a free live read.
-- Until now the UTM tags on the email links (utm_source / utm_medium / utm_campaign)
-- were only kept on leads, so a free read from an Instantly email could not be tied
-- back to the campaign that sent it. Nullable and additive: existing rows stay as they are.
alter table live_reads
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;
