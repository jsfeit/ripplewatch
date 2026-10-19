-- Every message sent through the /contact form, kept in addition to the email
-- to the operator, so a message can't be lost if the email fails or lands in spam.
-- Written only through the service role (visitors are anonymous).
create table if not exists contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  topic text not null,
  name text not null,
  email text not null,
  company text,
  message text,
  -- whether the alert email to the operator went out
  emailed boolean not null default false
);

create index if not exists contact_messages_created_idx on contact_messages (created_at desc);

-- No policies on purpose: with row level security on and nothing granted, only the
-- service role can touch it.
alter table contact_messages enable row level security;
