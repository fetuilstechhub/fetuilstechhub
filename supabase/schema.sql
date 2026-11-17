-- Bookings table for the FETUILS TechHub site.
-- Safe to run more than once in the Supabase SQL editor.

create table if not exists bookings (
  id uuid default gen_random_uuid() primary key,
  full_name text not null,
  email text not null,
  plan_id text,
  plan_title text,
  amount integer not null,
  currency text default 'NGN',
  workspace_id text,
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer,
  status text default 'pending', -- pending, paid, failed
  paystack_reference text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_bookings_email on bookings (email);
create unique index if not exists idx_bookings_reference on bookings (paystack_reference);

-- Customer data must never be readable with the public key.
-- With no policies, only the server's service role key can access this table.
alter table bookings enable row level security;

-- Door scanner: one row per entry. The unique index stops two phones
-- from both getting a green result for the same entry.
create table if not exists check_ins (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null references bookings (id) on delete cascade,
  check_in_date date not null,
  slot smallint not null default 1,
  created_at timestamptz default now()
);

create unique index if not exists idx_check_ins_entry on check_ins (booking_id, check_in_date, slot);
create index if not exists idx_check_ins_date on check_ins (check_in_date);
alter table check_ins enable row level security;

-- Door scanner: holder photos for weekly and monthly passes.
-- The server deletes each photo once its pass has ended.
create table if not exists pass_photos (
  booking_id uuid primary key references bookings (id) on delete cascade,
  image text not null,
  expires_on date not null,
  created_at timestamptz default now()
);

alter table pass_photos enable row level security;

-- Event pages: one per paid Event Hall booking. Guests register with name and email.
create table if not exists events (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid not null unique references bookings (id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text not null default '',
  starts_at timestamptz not null,
  organiser_name text not null,
  organiser_email text not null,
  created_at timestamptz default now()
);

alter table events enable row level security;

create table if not exists event_registrations (
  id uuid default gen_random_uuid() primary key,
  event_id uuid not null references events (id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz default now()
);

create unique index if not exists idx_event_registrations_email on event_registrations (event_id, email);
alter table event_registrations enable row level security;
