-- Revisions are append-only for API users; only the private trigger can write them.
create schema if not exists ponto_private;
revoke all on schema ponto_private from public, anon, authenticated;

create table public.time_record_revisions (
  id uuid primary key default gen_random_uuid(),
  time_record_id uuid not null,
  employee_id uuid not null,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  before_record jsonb not null,
  after_record jsonb not null
);
create index time_record_revisions_record_date_idx
  on public.time_record_revisions (time_record_id, changed_at desc);
alter table public.time_record_revisions enable row level security;
revoke all on public.time_record_revisions from anon, authenticated;
grant select on public.time_record_revisions to authenticated;
create policy "Employees and admins can read revisions"
  on public.time_record_revisions for select to authenticated
  using (employee_id = (select auth.uid()) or public.is_admin());

create function ponto_private.audit_manual_time_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.source <> 'manual' then
    return new;
  end if;
  if row(new.date, new.check_in, new.lunch_out, new.lunch_in, new.check_out)
     is not distinct from row(old.date, old.check_in, old.lunch_out, old.lunch_in, old.check_out) then
    return new;
  end if;

  if auth.uid() is not null then
    if old.employee_id <> auth.uid() and not public.is_admin() then
      raise exception 'Você não pode corrigir o registro de outro funcionário.' using errcode = '42501';
    end if;
    if new.employee_id <> old.employee_id then
      raise exception 'Não é permitido transferir o registro para outro funcionário.' using errcode = '42501';
    end if;
  end if;
  if new.date > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Não é permitido registrar ponto em datas futuras.' using errcode = '23514';
  end if;
  if new.check_out is not null and new.check_out <= new.check_in then
    raise exception 'A saída deve ser posterior à entrada.' using errcode = '23514';
  end if;

  -- Move company attribution with the corrected date when company support exists.
  if new.date <> old.date
     and to_regprocedure('public.get_employee_company_at_date(uuid,date)') is not null then
    execute 'select public.get_employee_company_at_date($1, $2)'
      into new.company_id using new.employee_id, new.date;
  end if;

  insert into public.time_record_revisions
    (time_record_id, employee_id, changed_by, before_record, after_record)
  values (old.id, old.employee_id, auth.uid(), to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;
revoke all on function ponto_private.audit_manual_time_record() from public, anon, authenticated;
create trigger trg_manual_record_revision
  before update on public.time_records
  for each row execute function ponto_private.audit_manual_time_record();

-- Older installations using the bootstrap integrity trigger permit manual date corrections.
do $$
declare definition text;
begin
  if to_regprocedure('public.enforce_time_record_integrity()') is not null then
    select pg_get_functiondef('public.enforce_time_record_integrity()'::regprocedure) into definition;
    definition := replace(definition, 'new.date <> old.date then',
      '(new.date <> old.date and old.source <> ''manual'') then');
    execute definition;
  end if;
end;
$$;
