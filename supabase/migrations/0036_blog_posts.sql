create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  published_at date not null default current_date,
  body jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table blog_posts enable row level security;

-- Genuinely public content — anyone (including the anon/unauthenticated
-- client the marketing pages render with) can read every post. Writes have
-- no policy at all, so only the service-role client the admin API routes
-- use can create/edit/delete.
create policy "anyone can read blog posts"
  on blog_posts for select
  using (true);

create index if not exists blog_posts_published_at_idx on blog_posts (published_at desc);
