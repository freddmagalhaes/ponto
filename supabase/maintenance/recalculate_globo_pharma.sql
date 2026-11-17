-- Recálculo dos registros ANTIGOS da empresa Globo Pharma com as regras novas.
-- NÃO é migration: rode manualmente, depois de atribuir a "Regra de jornada" aos funcionários
-- (Funcionários > editar). Quem não tem regra continua no padrão legado (8h diárias, noturno 22h-5h).
--
-- Como usar:
--   1) Rode a PARTE 1 (prévia) e confira as diferenças.
--   2) Rode a PARTE 2. Ela termina em ROLLBACK (nada é gravado). Confira o resumo; para gravar,
--      troque o último "rollback;" por "commit;" e rode de novo.
--
-- Escopo: registros fechados (com saída) cujo vínculo na data (employee_companies) é com 'Globo Pharma'.
-- Não toca em registros com extra ou noturno já liquidados (pago/banco): alterar minutos de um
-- período já pago mudaria valores fechados. Para incluí-los, ajuste o filtro "not settled" abaixo.
-- Para regras semanais o extra do dia fica 0 no banco (é calculado na semana, ao exibir).
-- Só os minutos mudam; batidas, status e trilha de auditoria não são alterados.

-- ================= PARTE 1: PRÉVIA (somente leitura) =================
with scope as (
  select r.*
    from public.time_records r
    join public.employee_companies ec
      on ec.employee_id = r.employee_id and ec.start_date <= r.date and (ec.end_date is null or ec.end_date >= r.date)
    join public.companies c on c.id = ec.company_id and c.name = 'Globo Pharma'
   where r.check_out is not null
     -- and r.date >= date '2026-01-01'   -- opcional: limitar o período
), calc as (
  select s.*, k.worked as n_worked, k.overtime as n_overtime, k.night as n_night,
         (s.overtime_status <> 'pending' or s.night_status <> 'pending') as settled
    from scope s
   cross join lateral ponto_private.calc_time_minutes(s.employee_id, s.check_in, s.check_out, s.lunch_out, s.lunch_in) k
)
select e.name, c.date, c.settled as "liquidado",
       c.worked_minutes as worked_old, c.n_worked as worked_new,
       c.overtime_minutes as ot_old, c.n_overtime as ot_new,
       c.night_minutes as night_old, c.n_night as night_new
  from calc c join public.employees e on e.id = c.employee_id
 where (c.worked_minutes, c.overtime_minutes, c.night_minutes) is distinct from (c.n_worked, c.n_overtime, c.n_night)
 order by e.name, c.date;

-- ================= PARTE 2: APLICAÇÃO (termina em rollback) =================
begin;

with scope as (
  select r.id, r.employee_id, r.check_in, r.check_out, r.lunch_out, r.lunch_in
    from public.time_records r
    join public.employee_companies ec
      on ec.employee_id = r.employee_id and ec.start_date <= r.date and (ec.end_date is null or ec.end_date >= r.date)
    join public.companies c on c.id = ec.company_id and c.name = 'Globo Pharma'
   where r.check_out is not null
     and r.overtime_status = 'pending' and r.night_status = 'pending'   -- not settled
     -- and r.date >= date '2026-01-01'
), calc as (
  select s.id, k.worked, k.overtime, k.night
    from scope s
   cross join lateral ponto_private.calc_time_minutes(s.employee_id, s.check_in, s.check_out, s.lunch_out, s.lunch_in) k
), changed as (
  update public.time_records r
     set worked_minutes = calc.worked, overtime_minutes = calc.overtime, night_minutes = calc.night
    from calc
   where r.id = calc.id
     and (r.worked_minutes, r.overtime_minutes, r.night_minutes) is distinct from (calc.worked, calc.overtime, calc.night)
  returning r.id
)
select count(*) as registros_recalculados from changed;

rollback;   -- troque por "commit;" para gravar
