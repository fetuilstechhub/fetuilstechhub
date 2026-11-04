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
