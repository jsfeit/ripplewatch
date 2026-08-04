-- New signals.source value for a competitor's first-ever news/funding crawl,
-- which deliberately looks back further than ongoing crawls to seed initial
-- competitive context for a brand-new account ("here's the landscape") —
-- distinct from "pipeline", which now means "genuinely new, discovered by an
-- ongoing crawl within the freshness window". Lets Slack/digest delivery and
-- the dashboard treat backfilled history differently from fresh news.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'signals'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%source%';
  if con_name is not null then
    execute format('alter table signals drop constraint %I', con_name);
  end if;
end $$;

alter table signals add constraint signals_source_check check (source in ('manual', 'pipeline', 'backfill'));
