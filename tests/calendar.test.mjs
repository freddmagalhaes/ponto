import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayTags, eachDate, buildHolidayMap } from '../src/utils/calendar.ts';

const holidays = buildHolidayMap([
  { date: '2026-11-02', name: 'Finados', scope: 'national' },
  { date: '2026-03-19', name: 'São José', scope: 'municipal' },
  { date: '2026-11-15', name: 'Proclamação da República', scope: 'national' }, // domingo
]);

test('domingo mostra "Final de semana" e "Domingo"; sábado, "Final de semana" e "Sábado"', () => {
  assert.deepEqual(dayTags('2026-11-01').map(t => t.label), ['Final de semana', 'Domingo']);
  assert.deepEqual(dayTags('2026-11-07').map(t => t.label), ['Final de semana', 'Sábado']);
  assert.deepEqual(dayTags('2026-11-04'), []);
});

test('feriado nacional e municipal aparecem com abrangência e nome', () => {
  assert.deepEqual(dayTags('2026-11-02', holidays).map(t => t.label), ['Feriado nacional · Finados']);
  assert.deepEqual(dayTags('2026-03-19', holidays).map(t => t.label), ['Feriado municipal · São José']);
});

test('feriado em fim de semana mostra as duas identificações', () => {
  assert.deepEqual(dayTags('2026-11-15', holidays).map(t => t.label),
    ['Final de semana', 'Domingo', 'Feriado nacional · Proclamação da República']);
});

test('eachDate cobre o intervalo inclusive, atravessando meses e anos', () => {
  assert.deepEqual(eachDate('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.equal(eachDate('2026-10-20', '2026-11-19').length, 31);
});
