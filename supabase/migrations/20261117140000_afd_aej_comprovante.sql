-- Base para AFD/AEJ e comprovante de registro de ponto (Portaria MTP 671/2021, REP-P).
-- Requer a estrutura de empresas (supabase_companies.sql) e as migrations anteriores.
--
-- O que este script faz:
--  - CPF do empregado e local de prestação de serviços da empresa;
--  - rep_settings: dados do software (registro INPI, desenvolvedor, PTRP) e opção de exigir CPF/AFD;
--  - afd_records: registros imutáveis com NSR sequencial por empresa (tipos 2, 5 e 7 do AFD) e hash
--    SHA-256 encadeado nas marcações (tipo 7);
--  - register_punch passa a gravar a marcação no AFD.
-- Marcações lançadas manualmente ou importadas NÃO entram no AFD (só marcações originais do coletor);
-- elas aparecem no AEJ como "incluídas manualmente".

alter table public.employees add column cpf text check (cpf ~ '^\d{11}$');
create unique index employees_cpf_key on public.employees (cpf) where cpf is not null;
alter table public.companies add column service_location text;

create table public.rep_settings (
  id boolean primary key default true check (id),   -- linha única
  inpi_registration text check (inpi_registration ~ '^\d{1,17}$'),
  developer_kind smallint check (developer_kind in (1, 2)),   -- 1 = CNPJ, 2 = CPF
  developer_id text check (developer_id ~ '^\d{11}$|^\d{14}$'),
  developer_name text,
  developer_email text,
  ptrp_name text not null default 'Ponto',
  ptrp_version text not null default '1.0',
  -- true: bloqueia a batida se faltar CPF do empregado ou empresa; false: bate o ponto, mas sem registro no AFD.
  enforce_afd boolean not null default false
);
insert into public.rep_settings (id) values (true);
alter table public.rep_settings enable row level security;
create policy "Admins manage rep settings" on public.rep_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table ponto_private.afd_counters (
  company_id uuid primary key references public.companies(id),
  last_nsr bigint not null default 0
);
revoke all on ponto_private.afd_counters from public, anon, authenticated;

create table public.afd_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  nsr bigint not null,
  rec_type smallint not null check (rec_type in (2, 5, 6, 7)),
  recorded_at timestamptz not null default clock_timestamp(),
  responsible_cpf text,
  -- tipo 7 (marcação) e tipo 5 (empregado)
  employee_id uuid references public.employees(id),
  cpf text,
  employee_name text,
  op text check (op in ('I', 'A', 'E')),
  -- tipo 7
  time_record_id uuid,
  punch_kind text check (punch_kind in ('entrada', 'almoco_saida', 'almoco_retorno', 'saida')),
  punched_at timestamptz,
  collector text,
  offline boolean,
  hash text,
  inpi_registration text,
  -- tipo 2 (empregador)
  employer_cnpj text,
  employer_name text,
  employer_location text,
  -- tipo 6
  event_code text,
  unique (company_id, nsr)
);
create index afd_records_company_time_idx on public.afd_records (company_id, recorded_at);
create index afd_records_employee_idx on public.afd_records (employee_id, punched_at desc);
alter table public.afd_records enable row level security;
revoke all on public.afd_records from anon, authenticated;
grant select on public.afd_records to authenticated;
create policy "Admins read afd records" on public.afd_records
  for select to authenticated using (public.is_admin());
create policy "Employees read own punch records" on public.afd_records
  for select to authenticated using (rec_type = 7 and employee_id = (select auth.uid()));

create function ponto_private.block_afd_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Registros do AFD são imutáveis.' using errcode = '42501';
end;
$$;
create trigger trg_afd_records_immutable before update or delete on public.afd_records
  for each row execute function ponto_private.block_afd_changes();

-- Data e hora no formato do AFD: AAAA-MM-ddThh:mm:00±hhmm (segundos sempre 00), fuso de São Paulo.
create function ponto_private.afd_ts(ts timestamptz)
returns text language sql immutable set search_path = '' as $$
  select to_char(ts at time zone 'America/Sao_Paulo', 'YYYY-MM-DD"T"HH24:MI":00"')
    || case when o < 0 then '-' else '+' end
    || lpad((abs(o) / 60)::text, 2, '0') || lpad((abs(o) % 60)::text, 2, '0')
  from (select (extract(epoch from (ts at time zone 'America/Sao_Paulo') - (ts at time zone 'UTC')) / 60)::integer as o) x;
$$;

create function ponto_private.next_nsr(p_company uuid)
returns bigint language sql set search_path = '' as $$
  insert into ponto_private.afd_counters (company_id, last_nsr) values (p_company, 1)
  on conflict (company_id) do update set last_nsr = ponto_private.afd_counters.last_nsr + 1
  returning last_nsr;
$$;

create function ponto_private.responsible_cpf()
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select cpf from public.employees where id = auth.uid()), '00000000000');
$$;

-- Tipo 2: inclusão/alteração da identificação do empregador.
create function ponto_private.afd_company_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cnpj is not null and new.cnpj ~ '^\d{14}$'
     and (tg_op = 'INSERT' or (new.cnpj, new.name, new.service_location) is distinct from (old.cnpj, old.name, old.service_location)) then
    insert into public.afd_records (company_id, nsr, rec_type, responsible_cpf, employer_cnpj, employer_name, employer_location)
    values (new.id, ponto_private.next_nsr(new.id), 2, ponto_private.responsible_cpf(), new.cnpj, new.name, coalesce(new.service_location, ''));
  end if;
  return new;
end;
$$;
create trigger trg_afd_company after insert or update on public.companies
  for each row execute function ponto_private.afd_company_changed();

-- Tipo 5: inclusão/alteração/exclusão de empregado (na empresa atual do vínculo).
create function ponto_private.afd_employee_record(p_employee uuid, p_op text)
returns void language plpgsql security definer set search_path = '' as $$
declare e record; v_company uuid;
begin
  select * into e from public.employees where id = p_employee;
  select company_id into v_company from public.employee_companies where employee_id = p_employee and end_date is null limit 1;
  if e.cpf is null or v_company is null then return; end if;
  insert into public.afd_records (company_id, nsr, rec_type, employee_id, cpf, employee_name, op, responsible_cpf)
  values (v_company, ponto_private.next_nsr(v_company), 5, e.id, e.cpf, e.name, p_op, ponto_private.responsible_cpf());
end;
$$;

create function ponto_private.afd_employee_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cpf is null then return new; end if;
  if tg_op = 'INSERT' or old.cpf is null then
    perform ponto_private.afd_employee_record(new.id, 'I');
  elsif new.is_active = false and old.is_active = true then
    perform ponto_private.afd_employee_record(new.id, 'E');
  elsif (new.cpf, new.name) is distinct from (old.cpf, old.name) then
    perform ponto_private.afd_employee_record(new.id, 'A');
  end if;
  return new;
end;
$$;
create trigger trg_afd_employee after insert or update on public.employees
  for each row execute function ponto_private.afd_employee_changed();

create function ponto_private.afd_link_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.end_date is null then perform ponto_private.afd_employee_record(new.employee_id, 'I'); end if;
  return new;
end;
$$;
create trigger trg_afd_link after insert on public.employee_companies
  for each row execute function ponto_private.afd_link_changed();

-- Tipo 7: marcação do REP-P, com hash SHA-256 encadeado (hash do registro anterior, se existir).
-- Campos do hash, concatenados como aparecem no arquivo: NSR(9) + "7" + data/hora da marcação +
-- CPF(12) + data/hora da gravação + coletor + "0"/"1" (on/off-line) + hash anterior.
create function ponto_private.append_punch_afd(
  p_employee uuid, p_record uuid, p_kind text, p_at timestamptz, p_collector text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cpf text; v_date date; v_company uuid; v_nsr bigint; v_prev text; v_inpi text; v_hash text; v_enforce boolean;
begin
  select cpf into v_cpf from public.employees where id = p_employee;
  select inpi_registration, enforce_afd into v_inpi, v_enforce from public.rep_settings;
  v_date := (p_at at time zone 'America/Sao_Paulo')::date;
  v_company := public.get_employee_company_at_date(p_employee, v_date);
  if v_cpf is null or v_company is null then
    if coalesce(v_enforce, false) then
      raise exception 'Cadastro incompleto: CPF do funcionário ou vínculo com a empresa ausente. Procure o RH.' using errcode = '23514';
    end if;
    return;
  end if;
  v_nsr := ponto_private.next_nsr(v_company);   -- bloqueia a linha do contador: serializa a cadeia de hash
  select hash into v_prev from public.afd_records where company_id = v_company and rec_type = 7 order by nsr desc limit 1;
  v_hash := encode(sha256(convert_to(
    lpad(v_nsr::text, 9, '0') || '7' || ponto_private.afd_ts(p_at) || lpad(v_cpf, 12, '0')
    || ponto_private.afd_ts(p_at) || p_collector || '0' || coalesce(v_prev, ''), 'UTF8')), 'hex');
  insert into public.afd_records (company_id, nsr, rec_type, recorded_at, employee_id, cpf, time_record_id, punch_kind,
                                  punched_at, collector, offline, hash, inpi_registration)
  values (v_company, v_nsr, 7, p_at, p_employee, v_cpf, p_record, p_kind, p_at, p_collector, false, v_hash, v_inpi);
end;
$$;
revoke all on function ponto_private.append_punch_afd(uuid, uuid, text, timestamptz, text) from public, anon, authenticated;

drop function public.register_punch(text, double precision, double precision);
create function public.register_punch(
  p_kind text, p_lat double precision default null, p_lng double precision default null,
  p_collector text default '02')   -- 01 app mobile, 02 navegador, 03 app desktop
returns public.time_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := clock_timestamp();   -- relógio real do servidor (now() fica congelado na transação)
  v_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  r public.time_records;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;
  if p_kind not in ('entrada', 'almoco_saida', 'almoco_retorno', 'saida') then
    raise exception 'Tipo de batida inválido.' using errcode = '22023';
  end if;
  if p_collector not in ('01', '02', '03') then p_collector := '02'; end if;
  if (p_lat is not null and p_lat not between -90 and 90) or (p_lng is not null and p_lng not between -180 and 180)
     or ((p_lat is null) <> (p_lng is null)) then
    p_lat := null; p_lng := null;
  end if;

  perform set_config('ponto.live', '1', true);
  select * into r from public.time_records
   where employee_id = v_uid and check_out is null order by date desc limit 1 for update;

  if p_kind = 'entrada' then
    if found then raise exception 'Já existe uma jornada em aberto. Registre a saída antes.' using errcode = '23514'; end if;
    if exists (select 1 from public.time_records where employee_id = v_uid and date = v_today) then
      raise exception 'Já existe registro de ponto para hoje.' using errcode = '23505';
    end if;
    insert into public.time_records (employee_id, date, check_in, source, live_punch, latitude_in, longitude_in)
    values (v_uid, v_today, v_now, 'manual', true, p_lat, p_lng) returning * into r;
  else
    if not found then raise exception 'Nenhuma jornada em aberto. Registre a entrada primeiro.' using errcode = '23514'; end if;
    if p_kind = 'almoco_saida' then
      if r.lunch_out is not null then raise exception 'Saída para almoço já registrada.' using errcode = '23514'; end if;
      update public.time_records set lunch_out = v_now where id = r.id returning * into r;
    elsif p_kind = 'almoco_retorno' then
      if r.lunch_out is null or r.lunch_in is not null then
        raise exception 'Não há almoço em aberto para registrar o retorno.' using errcode = '23514';
      end if;
      update public.time_records set lunch_in = v_now where id = r.id returning * into r;
    else
      if r.lunch_out is not null and r.lunch_in is null then
        raise exception 'Registre o retorno do almoço antes da saída.' using errcode = '23514';
      end if;
      update public.time_records set check_out = v_now, latitude_out = p_lat, longitude_out = p_lng
       where id = r.id returning * into r;
    end if;
  end if;

  perform ponto_private.append_punch_afd(v_uid, r.id, p_kind, v_now, p_collector);
  perform set_config('ponto.live', '', true);
  return r;
end;
$$;
revoke all on function public.register_punch(text, double precision, double precision, text) from public, anon;
grant execute on function public.register_punch(text, double precision, double precision, text) to authenticated;
