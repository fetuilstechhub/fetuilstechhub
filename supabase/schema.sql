-- Supabase schema for bookings
-- Run this in your Supabase SQL editor to create the table

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
  status text default 'pending', -- pending, paid, cancelled
  paystack_reference text,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_bookings_email on bookings (email);
