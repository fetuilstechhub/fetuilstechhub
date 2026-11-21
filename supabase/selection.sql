-- Core team selection (temporary). Run once in the Supabase SQL editor.
-- When selection is over, run supabase/selection-remove.sql to delete all of it.
-- Row level security is on with no policies: only the server (service key) can read these.

create table if not exists sel_logins (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  label text not null default '',
  role text not null default 'lead' check (role in ('admin', 'lead')),
  teams text[] not null default '{}',
  password_hash text not null,
  pw_version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz default now()
);
alter table sel_logins enable row level security;

create table if not exists sel_applications (
  id uuid default gen_random_uuid() primary key,
  source_key text not null unique,
  team text not null default 'unassigned',
  team_locked boolean not null default false,
  applicant_name text not null default '',
  applicant_email text not null default '',
  applicant_email_alt text not null default '',
  phone text not null default '',
  phone_wa text not null default '',
  role_raw text not null default '',
  submitted_at timestamptz,
  is_unilorin boolean,
  faculty_dept text not null default '',
  matric_number text not null default '',
  hours_per_week text not null default '',
  hours_bucket text not null default 'unknown',
  available_on_site text not null default '',
  on_site_bucket text not null default 'unknown',
  skills text not null default '',
  portfolio_links jsonb not null default '[]',
  returning boolean not null default false,
  answers jsonb not null default '[]',
  problems jsonb not null default '[]',
  import_batch uuid,
  imported_at timestamptz,
  status text not null default 'new' check (status in ('new', 'shortlisted', 'interview', 'accepted', 'rejected', 'withdrawn')),
  rubric jsonb not null default '{}',
  score integer,
  track text not null default '',
  contacted boolean not null default false,
  last_contacted_at timestamptz,
  updated_at timestamptz,
  updated_by text not null default '',
  created_at timestamptz default now()
);
create index if not exists idx_sel_applications_team on sel_applications (team);
alter table sel_applications enable row level security;

create table if not exists sel_activity (
  id uuid default gen_random_uuid() primary key,
  application_id uuid not null references sel_applications (id) on delete cascade,
  kind text not null,
  from_value text,
  to_value text,
  text text,
  channel text,
  template_id text,
  by_login text not null default '',
  by_name text not null default '',
  undone boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists idx_sel_activity_application on sel_activity (application_id, created_at);
alter table sel_activity enable row level security;

create table if not exists sel_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz default now()
);
alter table sel_settings enable row level security;

create table if not exists sel_imports (
  id uuid default gen_random_uuid() primary key,
  file_name text not null default '',
  by_name text not null default '',
  row_count integer not null default 0,
  created integer not null default 0,
  updated integer not null default 0,
  skipped integer not null default 0,
  problems jsonb not null default '[]',
  created_at timestamptz default now()
);
alter table sel_imports enable row level security;
