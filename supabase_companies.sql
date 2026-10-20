-- ============================================================
-- MIGRATION: Estrutura de Empresas
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Tabela de Empresas
create table if not exists public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  cnpj text,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.companies enable row level security;

create policy "Authenticated users can view companies"
  on public.companies for select
  using ( auth.uid() is not null );

create policy "Admins have full access to companies"
  on public.companies for all
  using ( public.is_admin() );


-- 2. Histórico de vínculos Funcionário <-> Empresa
create table if not exists public.employee_companies (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references public.employees(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  start_date date not null,
  end_date date,   -- NULL = empresa atual (vínculo aberto)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_active_company unique (employee_id, end_date)
);

alter table public.employee_companies enable row level security;

create policy "Users can view own company links"
  on public.employee_companies for select
  using (
    employee_id = auth.uid()
    and exists (
      select 1 from public.employees
      where id = auth.uid() and is_active = true
    )
  );


create policy "Admins have full access to employee_companies"
  on public.employee_companies for all
  using ( public.is_admin() );


-- 3. Coluna company_id em time_records
alter table public.time_records
  add column if not exists company_id uuid references public.companies(id);


-- 4. Função auxiliar para buscar a empresa de um funcionário numa data
create or replace function public.get_employee_company_at_date(
  p_employee_id uuid,
  p_date date
)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select company_id
  from public.employee_companies
  where employee_id = p_employee_id
    and start_date <= p_date
    and (end_date is null or end_date >= p_date)
  order by start_date desc
  limit 1;
$$;


-- ============================================================
-- DADOS: Inserir as duas empresas
-- ============================================================

insert into public.companies (id, name, is_active) values
  ('a1b2c3d4-0001-0001-0001-000000000001', 'DVL',          true),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Globo Pharma', true)
on conflict (name) do nothing;


-- ============================================================
-- ATUALIZAÇÃO: Todos os time_records existentes são da DVL
-- Novos registros (check-in a partir de hoje) serão da Globo Pharma
-- ============================================================

update public.time_records
set company_id = 'a1b2c3d4-0001-0001-0001-000000000001'  -- DVL
where company_id is null;


-- ============================================================
-- VÍNCULO FUNCIONÁRIO: Insira manualmente após rodar o script
-- Substitua <SEU-UUID> pelo ID do funcionário:
--   SELECT id FROM public.employees WHERE email = 'seu@email.com';
--
-- INSERT INTO public.employee_companies (employee_id, company_id, start_date, end_date) VALUES
--   ('<SEU-UUID>', 'a1b2c3d4-0001-0001-0001-000000000001', '2026-01-01', '2026-10-08'),
--   ('<SEU-UUID>', 'a1b2c3d4-0002-0002-0002-000000000002', '2026-10-13', NULL);
-- ============================================================
