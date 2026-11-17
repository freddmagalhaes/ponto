-- Testes da integridade no servidor (cálculo no banco, register_punch e restrições de usuário comum).
-- Rodar após aplicar supabase_schema.sql e as migrations, p.ex.:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/server-integrity.sql
-- Tudo roda em uma transação e termina em ROLLBACK.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'legacy@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'turno3@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'turno2@test.local');
update public.employees set shift_id = (select id from public.work_shifts where name = '3º turno')
 where id = '00000000-0000-0000-0000-0000000000a2';
update public.employees set shift_id = (select id from public.work_shifts where name = '2º turno')
 where id = '00000000-0000-0000-0000-0000000000a3';

-- 1) Cálculo no servidor: o cliente não define minutos (paridade com tests/time.test.mjs e rules.test.mjs).
insert into public.time_records (employee_id, date, check_in, lunch_out, lunch_in, check_out, worked_minutes, overtime_minutes, night_minutes) values
  ('00000000-0000-0000-0000-0000000000a1', '2026-11-02', '2026-11-02 08:00-03', '2026-11-02 12:00-03', '2026-11-02 13:00-03', '2026-11-02 18:00-03', 9999, 9999, 9999),
  ('00000000-0000-0000-0000-0000000000a1', '2026-11-03', '2026-11-03 22:30-03', '2026-11-04 02:00-03', '2026-11-04 02:30-03', '2026-11-04 06:00-03', 0, 0, 0),
  ('00000000-0000-0000-0000-0000000000a2', '2026-11-03', '2026-11-03 22:30-03', '2026-11-04 02:00-03', '2026-11-04 02:30-03', '2026-11-04 06:00-03', 0, 0, 0),
  ('00000000-0000-0000-0000-0000000000a3', '2026-11-03', '2026-11-03 14:20-03', '2026-11-03 18:00-03', '2026-11-03 18:30-03', '2026-11-03 22:30-03', 0, 0, 0);
do $$
declare r record;
begin
  select * into r from public.time_records where employee_id = '00000000-0000-0000-0000-0000000000a1' and date = '2026-11-02';
  if (r.worked_minutes, r.overtime_minutes, r.night_minutes) <> (540, 60, 0) then raise exception 'legado diurno: %', r; end if;
  select * into r from public.time_records where employee_id = '00000000-0000-0000-0000-0000000000a1' and date = '2026-11-03';
  if (r.worked_minutes, r.overtime_minutes, r.night_minutes) <> (420, 0, 360) then raise exception 'legado noturno (sem reduzida/prorrogação): %', r; end if;
  select * into r from public.time_records where employee_id = '00000000-0000-0000-0000-0000000000a2' and date = '2026-11-03';
  if (r.worked_minutes, r.overtime_minutes, r.night_minutes) <> (420, 0, 480) then raise exception '3º turno: %', r; end if;
  select * into r from public.time_records where employee_id = '00000000-0000-0000-0000-0000000000a3' and date = '2026-11-03';
  if (r.worked_minutes, r.night_minutes) <> (460, 34) then raise exception '2º turno: %', r; end if;
end $$;

-- 2) register_punch: relógio do servidor, estados válidos, localização e marca "ao vivo".
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true); -- versões antigas de auth.uid()
set local role authenticated;
do $$
declare r public.time_records;
begin
  r := public.register_punch('entrada', -19.9, -43.9);
  if not r.live_punch or abs(extract(epoch from (now() - r.check_in))) > 5 or r.latitude_in is null then raise exception 'entrada: %', r; end if;
  begin perform public.register_punch('entrada'); raise exception 'entrada duplicada aceita';
  exception when check_violation then null; end;
  begin perform public.register_punch('almoco_retorno'); raise exception 'retorno sem saída aceito';
  exception when check_violation then null; end;
  r := public.register_punch('almoco_saida');
  begin perform public.register_punch('saida'); raise exception 'saída durante o almoço aceita';
  exception when check_violation then null; end;
  r := public.register_punch('almoco_retorno');
  r := public.register_punch('saida', -19.9, -43.9);
  if r.check_out is null or r.worked_minutes is null or r.longitude_out is null then raise exception 'saída: %', r; end if;
  begin perform public.register_punch('saida'); raise exception 'saída sem jornada aberta aceita';
  exception when check_violation then null; end;
  begin perform public.register_punch('invalido'); raise exception 'tipo inválido aceito';
  exception when invalid_parameter_value then null; end;
end $$;

-- 3) Usuário comum: sem futuro, sem forjar "ao vivo"/localização, sem alterar localização gravada.
do $$
declare v_id uuid;
begin
  begin
    insert into public.time_records (employee_id, date, check_in) values ('00000000-0000-0000-0000-0000000000a1', current_date, now() + interval '3 hours');
    raise exception 'horário futuro aceito';
  exception when check_violation then null; end;

  insert into public.time_records (employee_id, date, check_in, check_out, live_punch, latitude_in, longitude_in)
  values ('00000000-0000-0000-0000-0000000000a1', '2026-10-01', '2026-10-01 08:00-03', '2026-10-01 17:00-03', true, -1, -1)
  returning id into v_id;
  if (select live_punch or latitude_in is not null from public.time_records where id = v_id) then raise exception 'live/localização forjados'; end if;

  update public.time_records set latitude_in = -2, live_punch = true, worked_minutes = 1 where id = v_id;
  if (select live_punch or latitude_in is not null or worked_minutes <> 540 from public.time_records where id = v_id) then
    raise exception 'update alterou localização, live_punch ou minutos';
  end if;
end $$;

-- 4) anon não executa register_punch.
reset role;
set local role anon;
do $$ begin
  begin perform public.register_punch('entrada'); raise exception 'anon executou register_punch';
  exception when insufficient_privilege then null; end;
end $$;

select 'PASS: cálculo no servidor, register_punch, restrições de usuário comum' as result;
rollback;
