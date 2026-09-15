-- The quiz and competitor-snapshot capture points already collect real
-- context (quiz score/tier/weakest area, the domain someone checked and
-- what pricing we found) but throw it away — only the email lands on the
-- lead row. That context is exactly what makes a lead worth prioritizing
-- over a bare email address, so it's worth keeping. One generic jsonb
-- column rather than a growing set of single-purpose ones, since each
-- capture point's context shape is different and more capture points are
-- likely to show up over time (see leads.capture_point's own comment
-- history).
alter table leads add column if not exists metadata jsonb;
