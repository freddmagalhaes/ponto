-- ============================================================
-- MIGRATION: Estrutura de Empresas
-- Objetivo: Substituir a lógica hardcoded de transição de empresa
--           por uma estrutura relacional no banco de dados.
-- ============================================================

-- 1. Tabela de Empresas
create table if not exists public.companies (
  id uuid default gen_random_uuid() primary key,
  name text not null unique,
  cnpj text,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table public.companies enable row level security;

-- Todos os usuários autenticados podem visualizar as empresas
create policy "Authenticated users can view companies"
  on public.companies for select
  using ( auth.uid() is not null );

-- Apenas admins podem gerenciar empresas
create policy "Admins have full access to companies"
  on public.companies for all
  using ( public.is_admin() );


-- 2. Tabela de vínculo Funcionário <-> Empresa (com período)
--    Permite rastrear histórico de trocas de empresa
create table if not exists public.employee_companies (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references public.employees(id) on delete cascade not null,
  company_id uuid references public.companies(id) on delete cascade not null,
  start_date date not null,
  end_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint unique_active_company unique (employee_id, end_date)
);

-- Habilitar RLS
alter table public.employee_companies enable row level security;

create policy "Users can view own company links"
  on public.employee_companies for select
  using ( employee_id = auth.uid() and public.is_active_user() );

create policy "Admins have full access to employee_companies"
  on public.employee_companies for all
  using ( public.is_admin() );


-- 3. Adicionar company_id em time_records
alter table public.time_records
  add column if not exists company_id uuid references public.companies(id);


-- 4. Função para descobrir a empresa ativa de um funcionário em uma data
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
-- SEED: Inserir as empresas e os vínculos do Frederico
-- ============================================================

insert into public.companies (id, name, cnpj, is_active) values
  ('a1b2c3d4-0001-0001-0001-000000000001', 'DVL', NULL, true),
  ('a1b2c3d4-0002-0002-0002-000000000002', 'Globo Pharma', NULL, true)
on conflict (name) do nothing;

do $$
declare
  v_employee_id uuid;
  v_dvl_id uuid := 'a1b2c3d4-0001-0001-0001-000000000001';
  v_globo_id uuid := 'a1b2c3d4-0002-0002-0002-000000000002';
begin
  select id into v_employee_id
  from public.employees
  where email ilike '%frederico%' or name ilike '%frederico%'
  limit 1;

  if v_employee_id is not null then
    insert into public.employee_companies (employee_id, company_id, start_date, end_date)
    values (v_employee_id, v_dvl_id, '2026-01-01', '2026-10-08')
    on conflict (employee_id, end_date) do nothing;

    insert into public.employee_companies (employee_id, company_id, start_date, end_date)
    values (v_employee_id, v_globo_id, '2026-10-13', null)
    on conflict (employee_id, end_date) do nothing;

    raise notice 'Vínculos criados para o funcionário: %', v_employee_id;
  else
    raise warning 'Funcionário "Frederico" não encontrado. Insira os vínculos manualmente.';
  end if;
end;
$$;

-- Atualizar company_id nos time_records existentes
update public.time_records tr
set company_id = public.get_employee_company_at_date(tr.employee_id, tr.date)
where tr.company_id is null;
