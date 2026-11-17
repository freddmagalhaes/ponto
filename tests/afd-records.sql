-- Testes do AFD/NSR/hash (migration 20261117140000). Roda em transação e termina em ROLLBACK.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'ana@test.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'bia@test.local');
update public.employees set cpf = '52998224725', name = 'Ana Souza' where id = '00000000-0000-0000-0000-0000000000b1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);

do $$
declare gp uuid := 'a1b2c3d4-0002-0002-0002-000000000002'; n int;
begin
  -- tipo 2: ao informar o CNPJ da empresa
  update public.companies set cnpj = '11222333000181', service_location = 'São José da Lapa/MG' where id = gp;
  if (select count(*) from public.afd_records where company_id = gp and rec_type = 2 and nsr = 1) <> 1 then raise exception 'tipo 2 ausente'; end if;

  -- sem vínculo: tipo 5 não é gerado; com vínculo aberto: gera "I"
  if exists (select 1 from public.afd_records where rec_type = 5) then raise exception 'tipo 5 sem vínculo'; end if;
  insert into public.employee_companies (employee_id, company_id, start_date) values ('00000000-0000-0000-0000-0000000000b1', gp, '2026-01-01');
  if (select count(*) from public.afd_records where rec_type = 5 and op = 'I' and cpf = '52998224725' and nsr = 2) <> 1 then raise exception 'tipo 5 I ausente'; end if;
  update public.employees set name = 'Ana S. Souza' where id = '00000000-0000-0000-0000-0000000000b1';
  if (select count(*) from public.afd_records where rec_type = 5 and op = 'A' and nsr = 3) <> 1 then raise exception 'tipo 5 A ausente'; end if;
end $$;

set local role authenticated;
do $$
begin
  perform public.register_punch('entrada');
  perform public.register_punch('almoco_saida');
  -- usuário vê só as próprias marcações (tipo 7), não os tipos 2/5
  if (select count(*) from public.afd_records) <> 2 then raise exception 'RLS: usuário vê % registros', (select count(*) from public.afd_records); end if;
  begin update public.afd_records set cpf = '00000000000'; raise exception 'update aceito';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$
declare a record; b record; expect text;
begin
  select * into a from public.afd_records where rec_type = 7 and punch_kind = 'entrada';
  select * into b from public.afd_records where rec_type = 7 and punch_kind = 'almoco_saida';
  if a.nsr <> 4 or b.nsr <> 5 then raise exception 'NSR não sequencial: % %', a.nsr, b.nsr; end if;
  if length(a.hash) <> 64 or a.collector <> '02' or a.offline then raise exception 'registro 7 inválido: %', a; end if;
  expect := encode(sha256(convert_to(
    lpad(b.nsr::text, 9, '0') || '7' || ponto_private.afd_ts(b.punched_at) || lpad(b.cpf, 12, '0')
    || ponto_private.afd_ts(b.punched_at) || '02' || '0' || a.hash, 'UTF8')), 'hex');
  if b.hash <> expect then raise exception 'hash não encadeado'; end if;
  if ponto_private.afd_ts('2026-11-17 14:20:35-03') <> '2026-11-17T14:20:00-0300' then raise exception 'afd_ts: %', ponto_private.afd_ts('2026-11-17 14:20:35-03'); end if;
end $$;

do $$
begin
  begin update public.afd_records set cpf = '1' where nsr = 4; raise exception 'admin/superuser alterou AFD';
  exception when insufficient_privilege then null; end;
  begin delete from public.afd_records; raise exception 'delete aceito';
  exception when insufficient_privilege then null; end;
end $$;

-- sem CPF: por padrão bate o ponto sem AFD; com enforce_afd, bloqueia.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
insert into public.employee_companies (employee_id, company_id, start_date) values ('00000000-0000-0000-0000-0000000000b2', 'a1b2c3d4-0002-0002-0002-000000000002', '2026-01-01');
set local role authenticated;
do $$
begin
  perform public.register_punch('entrada');   -- sem CPF: sem erro, sem tipo 7
end $$;
reset role;
do $$
begin
  if exists (select 1 from public.afd_records where employee_id = '00000000-0000-0000-0000-0000000000b2' and rec_type = 7) then raise exception 'AFD sem CPF'; end if;
  delete from public.time_records where employee_id = '00000000-0000-0000-0000-0000000000b2';
  update public.rep_settings set enforce_afd = true;
end $$;
set local role authenticated;
do $$
begin
  begin perform public.register_punch('entrada'); raise exception 'enforce_afd não bloqueou';
  exception when check_violation then null; end;
end $$;

select 'PASS: NSR por empresa, tipos 2/5/7, hash encadeado, imutabilidade, RLS, enforce_afd' as result;
rollback;
