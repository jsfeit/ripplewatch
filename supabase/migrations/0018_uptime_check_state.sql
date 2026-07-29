-- Tracks the last known up/down state so /api/cron/uptime-check only sends
-- an alert on a status transition, not on every tick while an outage
-- persists.
create table if not exists system_health (
  id text primary key,
  last_status text not null check (last_status in ('up', 'down')),
  updated_at timestamptz not null default now()
);

alter table system_health enable row level security;

-- Admin-only in every sense that matters (written only by the cron route
-- via the service-role client); no policy needed since all access goes
-- through that client.
