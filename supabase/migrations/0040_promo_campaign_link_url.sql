alter table promo_campaigns
  add column if not exists link_url text not null default '/pricing';
