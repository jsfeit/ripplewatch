-- Human ground-truth labels for scored signals, so the scoring prompt's
-- accuracy can be measured and regression-tested over time (see the AI
-- Pipeline Spec eval-set goal). One label per signal — re-labeling
-- overwrites rather than accumulating history, since only the current
-- verdict matters for computing accuracy against the model's relevance_level.
create table if not exists signal_eval_labels (
  signal_id uuid primary key references signals(id) on delete cascade,
  label text not null check (label in ('correct', 'incorrect')),
  note text,
  labeled_by text,
  created_at timestamptz not null default now()
);

alter table signal_eval_labels enable row level security;

-- Admin-only, same pattern as system_health / llm_usage — written and read
-- only through the service-role client.
