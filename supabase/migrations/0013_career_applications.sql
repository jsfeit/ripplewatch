-- Careers page applications: no roles table yet (there's a single generic
-- "create your own role" listing on /careers), so this just captures who
-- applied for what. Anonymous inserts go through the service-role admin
-- client in /api/careers/apply; the anon policy below mirrors
-- waitlist_signups in case a direct client-side insert is ever added.
create table if not exists career_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  job_title text not null,
  resume_file_name text not null,
  resume_storage_path text not null unique,
  created_at timestamptz not null default now()
);

alter table career_applications enable row level security;

create policy "anyone can submit a career application"
  on career_applications for insert
  to anon, authenticated
  with check (true);

insert into storage.buckets (id, name, public)
values ('career-resumes', 'career-resumes', false)
on conflict (id) do nothing;
