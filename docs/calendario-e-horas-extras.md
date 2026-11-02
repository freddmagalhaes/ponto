# Avaliação: calendário brasileiro e apuração de horas

## Situação atual

O histórico agora exibe o dia da semana e destaca sábados e domingos. Essa indicação é apenas de calendário: não muda a apuração. O cálculo atual desconta o almoço e considera extra o tempo diário acima de oito horas. Ele não considera a escala semanal, feriados, folgas compensatórias ou convenções coletivas.

Não há município, UF ou código IBGE no cadastro de empresas. Os horários de jornada do funcionário não definem seus dias de trabalho. Esses dados precisam ser definidos antes de calcular adicionais por calendário.

## Proposta

1. Cadastrar o local de trabalho (município/código IBGE, UF e fuso) por vínculo, com vigência. Usar o local onde o trabalho se aplica, sem presumir que é o endereço residencial do funcionário.
2. Manter calendário anual de feriados com data, nome, abrangência, localidade, fonte oficial, vigência e data da revisão. Tratar ponto facultativo separadamente; não o converter automaticamente em feriado da empresa.
3. Exibir simultaneamente dia da semana e feriado aplicável, com nome e abrangência. Uma data pode ser domingo e feriado; a identificação não deve duplicar a contagem de minutos.
4. Cadastrar a escala e as regras acordadas com o RH: carga por dia e semana, descanso semanal, folgas compensatórias, percentuais e vigência de acordo/convenção. Apurar os minutos trabalhados, as horas excedentes e os adicionais como conceitos separados.
5. Dividir jornadas na meia-noite do local de trabalho e excluir os intervalos antes de classificar os minutos. A data de entrada isolada não determina a classificação de toda uma jornada noturna.
6. Salvar a versão do calendário e da regra utilizada em cada apuração. Validar mudanças em simulação antes de reprocessar períodos fechados; manter os valores e regras anteriores para auditoria.

O calendário deve vir de legislação federal e dos diários oficiais estaduais/municipais, com revisão administrativa. Uma API pode auxiliar na carga, mas sua cobertura e suas classificações devem ser verificadas. Falta de dados de uma localidade deve aparecer como pendência, nunca como confirmação de dia útil.

## Como validar antes de ativar cálculos

- Comparar o calendário do ano e município com as fontes oficiais; conferir datas móveis, alterações legais e aniversários locais.
- Testar feriado nacional, estadual e municipal, incluindo uma mesma data em municípios diferentes.
- Testar sábado previsto na escala, sábado compensado, domingo com e sem folga compensatória e feriado coincidente com domingo.
- Testar ponto facultativo sem adesão da empresa, turno que atravessa meia-noite e almoço dentro de um feriado.
- Comparar uma competência completa com a apuração conferida pelo RH/contador. Os resultados esperados devem ser definidos antes de automatizar a regra.
- Confirmar que a classificação não duplica minutos entre hora extra diária, semanal e adicional por feriado.

## Informações pendentes

Município/UF do trabalho, dias e carga da jornada, regras de compensação, acordo/convenção aplicável e período a validar. Sem essas definições, a identificação de fins de semana pode ser exibida, mas não é suficiente para definir novos adicionais.

## Referências oficiais consultadas

- [Lei nº 9.093/1995 — texto atualizado da Câmara dos Deputados](https://www2.camara.leg.br/legin/fed/lei/1995/lei-9093-12-setembro-1995-348594-normaatualizada-pl.html): abrangência federal, estadual e municipal dos feriados.
- [Lei nº 605/1949](https://www.planalto.gov.br/ccivil_03/leis/l0605.htm): descanso semanal e disciplina do trabalho em feriados, inclusive compensação.
- [Ministério do Trabalho e Emprego — jornada de trabalho](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/perguntas-frequentes/jornada-de-trabalho/): jornada, horas extras e compensação.
- [Calendário federal de 2026](https://agenciagov.ebc.com.br/noticias/202512/confira-o-calendario-oficial-de-feriados-nacionais-e-pontos-facultativos-em-2026): referência para conferência, observando que o alcance administrativo de pontos facultativos não equivale a feriado geral.
