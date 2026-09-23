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
  latitude_in double precision,
  longitude_in double precision,
  latitude_out double precision,
  longitude_out double precision,
  overtime_status text default 'pending'::text not null,
  night_status text default 'pending'::text not null,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Prevent overlapping exact checkins per day manually if needed, or just standard unique constraints
  unique(employee_id, date),
  constraint check_overtime_status check (overtime_status in ('pending', 'paid', 'compensated')),
  constraint check_night_status check (night_status in ('pending', 'paid'))
);

-- Turn on Row Level Security (RLS)
alter table public.employees enable row level security;
alter table public.time_records enable row level security;

-- Function to safely check if current user is admin (bypasses RLS to avoid infinite recursion)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.employees 
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

-- Function to check if current user is active
create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.employees 
    where id = auth.uid() and is_active = true
  );
$$;

-- Setup Policies for Employees table
-- Admin can do everything
create policy "Admins have full access to employees"
  on public.employees for all 
  using ( public.is_admin() );

-- Users can only read their own profile if active
create policy "Users can view own profile"
  on public.employees for select 
  using ( auth.uid() = id and is_active = true );

-- Setup Policies for Time Records table
-- Admin can do everything
create policy "Admins have full access to time records"
  on public.time_records for all 
  using ( public.is_admin() );

-- Users can view and create their own records only if active
create policy "Users can view own records"
  on public.time_records for select 
  using ( employee_id = auth.uid() and public.is_active_user() );

create policy "Users can insert own records"
  on public.time_records for insert 
  with check ( employee_id = auth.uid() and public.is_active_user() );

create policy "Users can update own records (checkout)"
  on public.time_records for update 
  using ( employee_id = auth.uid() and public.is_active_user() );

-- Trigger to enforce time record integrity and protect payroll status from non-admins
create or replace function public.enforce_time_record_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_admin boolean;
begin
  v_is_admin := public.is_admin();

  -- Se não for admin, não permite manipular status de pagamento ou fonte de importação
  if not v_is_admin then
    if tg_op = 'INSERT' then
      new.overtime_status := 'pending';
      new.night_status := 'pending';
      new.resolved_at := null;
      new.source := 'manual';
    elsif tg_op = 'UPDATE' then
      -- Usuário comum só pode preencher check_out e campos de localização/cálculo,
      -- nunca alterar overtime_status, night_status ou resolved_at diretamente
      if new.overtime_status <> old.overtime_status or
         new.night_status <> old.night_status or
         new.resolved_at is distinct from old.resolved_at or
         new.source <> old.source or
         new.employee_id <> old.employee_id or
         new.date <> old.date then
        raise exception 'Operação não autorizada em campos protegidos de ponto.';
      end if;
    end if;

    -- Não permitir registros com data futura
    if new.date > current_date then
      raise exception 'Não é permitido registrar ponto em datas futuras.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_time_record_integrity on public.time_records;
create trigger trg_enforce_time_record_integrity
  before insert or update on public.time_records
  for each row execute procedure public.enforce_time_record_integrity();

-- Trigger for automatically creating an employee profile when a new user signs up 
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer 
set search_path = public, pg_temp
as $$
begin
  insert into public.employees (id, name, email, role, is_active)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    new.email, 
    'user',
    true
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
