-- Feriados municipais de São José da Lapa/MG (2026 e 2027). REVISAR ANTES DE RODAR.
-- ATENÇÃO: as datas vêm de sites de calendário, NÃO da lei municipal. Esses sites divergem entre si
-- (um deles informa que 19/03 depende de decreto e outro lista 0 feriados municipais em 2026).
-- Confirme na Prefeitura / Câmara Municipal (Lei Municipal nº 3/1993, citada por esses sites)
-- e em eventual decreto do ano antes de usar para pagamento. Ajuste ou apague as linhas que não valerem.
insert into public.holidays (date, name, scope, source) values
  ('2026-03-19', 'Dia de São José (padroeiro)',          'municipal', 'Lei Municipal nº 3/1993 (fonte: sites de calendário; confirmar)'),
  ('2026-04-27', 'Aniversário de São José da Lapa',      'municipal', 'Fonte: sites de calendário; confirmar na Prefeitura'),
  ('2027-03-19', 'Dia de São José (padroeiro)',          'municipal', 'Lei Municipal nº 3/1993 (fonte: sites de calendário; confirmar)'),
  ('2027-04-27', 'Aniversário de São José da Lapa',      'municipal', 'Fonte: sites de calendário; confirmar na Prefeitura')
on conflict (date, name) do nothing;
