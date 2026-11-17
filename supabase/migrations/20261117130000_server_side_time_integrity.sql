-- Integridade no servidor:
--  1) os minutos (trabalhado, extra diário, noturno) são SEMPRE recalculados pelo banco a partir das
--     batidas e do perfil do funcionário; valores enviados pelo cliente são ignorados;
--  2) register_punch() grava a batida em tempo real com o relógio do servidor (now());
--  3) usuário comum não escreve batidas no futuro, não marca registro como "ao vivo" e não
--     altera a localização gravada.
-- Referência de cálculo: src/utils/time.ts e src/utils/rules.ts (mesmos resultados, testados em
-- tests/server-integrity.sql). Fuso fixo: America/Sao_Paulo.

alter table public.time_records add column live_punch boolean not null default false;

create or replace function ponto_private.calc_time_minutes(
  p_employee uuid, p_in timestamptz, p_out timestamptz, p_lunch_out timestamptz, p_lunch_in timestamptz)
returns table (worked integer, overtime integer, night integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_mode text;
  v_daily integer;
  v_reduced boolean;
  v_prorog boolean;
  v_both_lunch boolean := p_lunch_out is not null and p_lunch_in is not null;
  v_worked integer;
  v_base integer;
  v_extra integer;
  v_clock integer;
begin
  if p_out is null or p_out <= p_in then
    return query select 0, 0, 0;
    return;
  end if;

  -- Sem perfil: padrão legado (8h diárias, noturno 22h-5h em minutos de relógio).
  select s.rule_mode, s.daily_limit_minutes, s.night_reduced, s.night_prorogation
    into v_mode, v_daily, v_reduced, v_prorog
    from public.employees e join public.work_shifts s on s.id = e.shift_id
   where e.id = p_employee;
  v_mode := coalesce(v_mode, 'daily');
  v_daily := coalesce(v_daily, 480);
  v_reduced := coalesce(v_reduced, false);
  v_prorog := coalesce(v_prorog, false);

  if v_both_lunch then
    v_worked := floor(extract(epoch from ((p_lunch_out - p_in) + (p_out - p_lunch_in))) / 60);
  else
    v_worked := floor(extract(epoch from (p_out - p_in)) / 60);
  end if;

  with spans(a, b) as (
    select p_in, case when v_both_lunch then p_lunch_out else p_out end
    union all
    select p_lunch_in, p_out where v_both_lunch
  ), mins as (
    select t,
           extract(hour from t at time zone 'America/Sao_Paulo')::integer as h,
           extract(minute from t at time zone 'America/Sao_Paulo')::integer as mi
      from spans, generate_series(a, b - interval '1 microsecond', interval '1 minute') as t
  ), flagged as (
    select h, bool_or(h = 4 and mi = 59) over (order by t rows between unbounded preceding and current row) as extended
      from mins
  )
  select count(*) filter (where h >= 22 or h < 5),
         count(*) filter (where extended and h >= 5 and h < 22)
    into v_base, v_extra
    from flagged;

  -- Prorrogação do noturno após as 5h (Súmula 60, II, TST) e hora reduzida de 52min30s, se o perfil usar.
  v_clock := v_base + case when v_prorog then v_extra else 0 end;
  return query select v_worked,
                      case when v_mode = 'daily' then greatest(0, v_worked - v_daily) else 0 end,
                      case when v_reduced then round(v_clock * 8.0 / 7)::integer else v_clock end;
end;
$$;
revoke all on function ponto_private.calc_time_minutes(uuid, timestamptz, timestamptz, timestamptz, timestamptz)
  from public, anon, authenticated;

create or replace function ponto_private.compute_time_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_live boolean := coalesce(current_setting('ponto.live', true), '') = '1';
  v_restricted boolean := auth.uid() is not null and not public.is_admin();
  r record;
begin
  if v_restricted then
    if greatest(new.check_in, new.check_out, new.lunch_out, new.lunch_in) > now() + interval '2 minutes' then
      raise exception 'Não é permitido registrar horários no futuro.' using errcode = '23514';
    end if;
    if tg_op = 'INSERT' then
      new.live_punch := v_live;
      if not v_live then
        new.latitude_in := null; new.longitude_in := null; new.latitude_out := null; new.longitude_out := null;
      end if;
    else
      new.live_punch := old.live_punch;
      if not v_live then
        new.latitude_in := old.latitude_in; new.longitude_in := old.longitude_in;
        new.latitude_out := old.latitude_out; new.longitude_out := old.longitude_out;
      end if;
    end if;
  end if;

  select * into r from ponto_private.calc_time_minutes(new.employee_id, new.check_in, new.check_out, new.lunch_out, new.lunch_in);
  new.worked_minutes := r.worked;
  new.overtime_minutes := r.overtime;
  new.night_minutes := r.night;
  return new;
end;
$$;
revoke all on function ponto_private.compute_time_record() from public, anon, authenticated;

-- Nome com prefixo numérico: dispara antes das demais triggers (que são ordenadas por nome),
-- de modo que a auditoria registre os minutos já recalculados.
create trigger trg_01_compute_time_record
  before insert or update on public.time_records
  for each row execute function ponto_private.compute_time_record();

create or replace function public.register_punch(
  p_kind text, p_lat double precision default null, p_lng double precision default null)
returns public.time_records
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- clock_timestamp(): relógio real do servidor (now() ficaria congelado dentro de uma transação).
  v_uid uuid := auth.uid();
  v_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
  r public.time_records;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Não autorizado.' using errcode = '42501';
  end if;
  if p_kind not in ('entrada', 'almoco_saida', 'almoco_retorno', 'saida') then
    raise exception 'Tipo de batida inválido.' using errcode = '22023';
  end if;
  if (p_lat is not null and p_lat not between -90 and 90) or (p_lng is not null and p_lng not between -180 and 180)
     or ((p_lat is null) <> (p_lng is null)) then
    p_lat := null; p_lng := null;  -- localização inválida é descartada; a batida continua válida
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
    values (v_uid, v_today, clock_timestamp(), 'manual', true, p_lat, p_lng) returning * into r;
  else
    if not found then raise exception 'Nenhuma jornada em aberto. Registre a entrada primeiro.' using errcode = '23514'; end if;
    if p_kind = 'almoco_saida' then
      if r.lunch_out is not null then raise exception 'Saída para almoço já registrada.' using errcode = '23514'; end if;
      update public.time_records set lunch_out = clock_timestamp() where id = r.id returning * into r;
    elsif p_kind = 'almoco_retorno' then
      if r.lunch_out is null or r.lunch_in is not null then
        raise exception 'Não há almoço em aberto para registrar o retorno.' using errcode = '23514';
      end if;
      update public.time_records set lunch_in = clock_timestamp() where id = r.id returning * into r;
    else
      if r.lunch_out is not null and r.lunch_in is null then
        raise exception 'Registre o retorno do almoço antes da saída.' using errcode = '23514';
      end if;
      update public.time_records set check_out = clock_timestamp(), latitude_out = p_lat, longitude_out = p_lng
       where id = r.id returning * into r;
    end if;
  end if;

  perform set_config('ponto.live', '', true);
  return r;
end;
$$;
revoke all on function public.register_punch(text, double precision, double precision) from public, anon;
grant execute on function public.register_punch(text, double precision, double precision) to authenticated;
