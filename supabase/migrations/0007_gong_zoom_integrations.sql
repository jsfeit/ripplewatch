-- Gong and Zoom are optional call-intelligence sources that supplement
-- HubSpot deal context with competitor mentions pulled from sales call
-- transcripts. Additive only — 0001-0006 have already been applied.

alter table integrations drop constraint if exists integrations_provider_check;
alter table integrations add constraint integrations_provider_check
  check (provider in ('slack', 'email', 'hubspot', 'salesforce', 'intercom', 'gong', 'zoom'));
