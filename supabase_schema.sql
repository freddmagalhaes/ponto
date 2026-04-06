-- Enable pgcrypto for UUID generation if not already enabled
create extension if not exists "pgcrypto";

-- Custom Types for validation
create type user_role as enum ('admin', 'user');
create type checkin_source as enum ('manual', 'imported');

-- Employees Table (extends auth.users)
create table public.employees (
  id uuid references auth.users not null primary key,
  name text not null,
  email text not null,
  role user_role default 'user'::user_role not null,
  position text,
  journey_start time without time zone default '08:00',
  journey_end time without time zone default '18:00',
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Time Records Table
create table public.time_records (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references public.employees(id) not null,
  date date not null,
  check_in timestamp with time zone not null,
  check_out timestamp with time zone,
  worked_minutes integer default 0,
  overtime_minutes integer default 0,
  night_minutes integer default 0,
  source checkin_source default 'manual'::checkin_source not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent overlapping exact checkins per day manually if needed, or just standard unique constraints
  unique(employee_id, date) 
);

-- Turn on Row Level Security (RLS)
alter table public.employees enable row level security;
alter table public.time_records enable row level security;

-- Function to safely check if current user is admin (bypasses RLS to avoid infinite recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.employees 
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Setup Policies for Employees table
-- Admin can do everything
create policy "Admins have full access to employees"
  on public.employees for all 
  using ( public.is_admin() );

-- Users can only read their own profile
create policy "Users can view own profile"
  on public.employees for select 
  using ( auth.uid() = id );

-- Setup Policies for Time Records table
-- Admin can do everything
create policy "Admins have full access to time records"
  on public.time_records for all 
  using ( public.is_admin() );

-- Users can view and create their own records
create policy "Users can view own records"
  on public.time_records for select 
  using ( employee_id = auth.uid() );

create policy "Users can insert own records"
  on public.time_records for insert 
  with check ( employee_id = auth.uid() );

create policy "Users can update own records (checkout)"
  on public.time_records for update 
  using ( employee_id = auth.uid() );

-- Trigger for automatically creating an employee profile when a new user signs up 
-- (useful if the system will allow signups, or Admin invites them).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.employees (id, name, email, role)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    new.email, 
    'user'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
