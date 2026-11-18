-- Feriados nacionais de 2026 e 2027 (revisar antes de rodar; é idempotente).
-- Fontes: Lei 10.607/2002 (que alterou a Lei 662/1949: 1/1, 21/4, 1/5, 7/9, 2/11, 15/11, 25/12),
-- Lei 6.802/1980 (12/10), Lei 14.759/2023 (20/11) e Lei 9.093/1995, art. 2º (Sexta-feira da Paixão).
-- NÃO inclui Carnaval e Corpus Christi (pontos facultativos, não feriados nacionais), nem feriados
-- estaduais (MG) ou municipais (São José da Lapa), que dependem de legislação própria.
insert into public.holidays (date, name, scope, source) values
  ('2026-01-01', 'Confraternização Universal', 'national', 'Lei 10.607/2002'),
  ('2026-04-03', 'Sexta-feira da Paixão',      'national', 'Lei 9.093/1995, art. 2º'),
  ('2026-04-21', 'Tiradentes',                 'national', 'Lei 10.607/2002'),
  ('2026-05-01', 'Dia do Trabalho',            'national', 'Lei 10.607/2002'),
  ('2026-09-07', 'Independência do Brasil',    'national', 'Lei 10.607/2002'),
  ('2026-10-12', 'Nossa Senhora Aparecida',    'national', 'Lei 6.802/1980'),
  ('2026-11-02', 'Finados',                    'national', 'Lei 10.607/2002'),
  ('2026-11-15', 'Proclamação da República',   'national', 'Lei 10.607/2002'),
  ('2026-11-20', 'Dia da Consciência Negra',   'national', 'Lei 14.759/2023'),
  ('2026-12-25', 'Natal',                      'national', 'Lei 10.607/2002'),
  ('2027-01-01', 'Confraternização Universal', 'national', 'Lei 10.607/2002'),
  ('2027-03-26', 'Sexta-feira da Paixão',      'national', 'Lei 9.093/1995, art. 2º'),
  ('2027-04-21', 'Tiradentes',                 'national', 'Lei 10.607/2002'),
  ('2027-05-01', 'Dia do Trabalho',            'national', 'Lei 10.607/2002'),
  ('2027-09-07', 'Independência do Brasil',    'national', 'Lei 10.607/2002'),
  ('2027-10-12', 'Nossa Senhora Aparecida',    'national', 'Lei 6.802/1980'),
  ('2027-11-02', 'Finados',                    'national', 'Lei 10.607/2002'),
  ('2027-11-15', 'Proclamação da República',   'national', 'Lei 10.607/2002'),
  ('2027-11-20', 'Dia da Consciência Negra',   'national', 'Lei 14.759/2023'),
  ('2027-12-25', 'Natal',                      'national', 'Lei 10.607/2002')
on conflict (date, name) do nothing;
