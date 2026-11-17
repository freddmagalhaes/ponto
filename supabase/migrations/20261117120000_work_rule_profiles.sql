-- Perfis de regra de jornada (adaptativo): cada funcionário aponta para um perfil.
-- Sem perfil (shift_id nulo) vale o padrão legado: 8h diárias, noturno 22h-5h.

-- Funções auxiliares das políticas. Mesmas definições de supabase_schema.sql; criadas aqui
-- porque bancos instalados antes delas existirem não as têm (create or replace é inofensivo se já existirem).
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

create table public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  rule_mode text not null default 'weekly' check (rule_mode in ('daily', 'weekly')),
  start_time time,
  end_time time,
  lunch_minutes integer not null default 60 check (lunch_minutes >= 0),
  work_days smallint[] not null default '{1,2,3,4,5}',
  daily_limit_minutes integer not null default 480 check (daily_limit_minutes > 0),
  weekly_limit_minutes integer not null default 2640 check (weekly_limit_minutes > 0),
  night_reduced boolean not null default false,
  night_prorogation boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint work_shifts_days_valid check (work_days <@ array[0,1,2,3,4,5,6]::smallint[])
);

-- Feriados aplicáveis à unidade (cadastrar a partir de fonte oficial; não há seed).
create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  name text not null,
  scope text not null default 'national' check (scope in ('national', 'state', 'municipal')),
  source text,
  created_at timestamptz not null default now(),
  unique (date, name)
);

alter table public.employees add column shift_id uuid references public.work_shifts(id) on delete set null;

alter table public.work_shifts enable row level security;
alter table public.holidays enable row level security;

create policy "Active users read work shifts" on public.work_shifts
  for select to authenticated using (public.is_active_user());
create policy "Admins manage work shifts" on public.work_shifts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Active users read holidays" on public.holidays
  for select to authenticated using (public.is_active_user());
create policy "Admins manage holidays" on public.holidays
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Turnos da Globo Pharma (São José da Lapa/MG): 30 min de almoço, 44h/semana,
-- noturno com hora reduzida e prorrogação. Dias: 0 = domingo ... 6 = sábado.
insert into public.work_shifts
  (name, rule_mode, start_time, end_time, lunch_minutes, work_days, weekly_limit_minutes, night_reduced, night_prorogation)
values
  ('1º turno',       'weekly', '06:00', '14:20', 30, '{1,2,3,4,5,6}', 2640, true, true),
  ('Administrativo', 'weekly', '07:30', '17:02', 30, '{1,2,3,4,5}',   2640, true, true),
  ('2º turno',       'weekly', '14:20', '22:30', 30, '{1,2,3,4,5,6}', 2640, true, true),
  ('3º turno',       'weekly', '22:30', '06:00', 30, '{1,2,3,4,5,6}', 2640, true, true)
on conflict (name) do nothing;

-- A trigger de integridade comparava com current_date (UTC); usar a data de São Paulo.
do $$
declare definition text;
begin
  if to_regprocedure('public.enforce_time_record_integrity()') is not null then
    select pg_get_functiondef('public.enforce_time_record_integrity()'::regprocedure) into definition;
    definition := replace(definition, 'new.date > current_date',
      'new.date > (now() at time zone ''America/Sao_Paulo'')::date');
    execute definition;
  end if;
end;
$$;
