-- Two more free, text-diffed page kinds alongside the existing homepage
-- check (checkProductMessagingDiff) — a competitor's changelog/release-notes
-- and blog page are exactly the same "hash it, diff on change, let the LLM
-- judge if it's meaningful" shape, just a different URL. Unlike
-- pricing/careers, not every competitor has one of these, so there's no
-- guessed-URL fallback: source_url stays null (and the row still gets
-- written, so the weekly gate applies) when nothing is found on the
-- homepage, and self-heals next week if a link shows up later.
alter table page_snapshots drop constraint if exists page_snapshots_kind_check;
alter table page_snapshots add constraint page_snapshots_kind_check
  check (kind in ('pricing', 'jobs', 'producthunt', 'websearch', 'homepage', 'changelog', 'blog'));

alter table page_snapshots add column if not exists source_url text;

-- Real visual diffing (screenshot + Claude vision comparison), gated to
-- Plus/Advanced (see VISUAL_DIFF_ALLOWED in tier-limits.ts) since unlike
-- everything else in scraping.ts this costs real money per call
-- (ScreenshotOne). Only the latest screenshot is kept per competitor — this
-- is a rolling comparison baseline, not a gallery, so there's no reason to
-- accumulate history here the way page_snapshots keeps raw_text.
create table if not exists competitor_screenshots (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null unique references competitors (id) on delete cascade,
  storage_path text not null,
  captured_at timestamptz not null default now()
);

alter table competitor_screenshots enable row level security;
-- Only ever read/written by the cron job via the service-role client, same
-- as page_snapshots (see 0002_integrations_and_scraping.sql) — no policies
-- needed for the account's own users to touch this table directly.

insert into storage.buckets (id, name, public)
values ('competitor-screenshots', 'competitor-screenshots', false)
on conflict (id) do nothing;
