import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateNight, classifyWeeks, weekStartOf, SHIFTS } from '../src/utils/rules.ts';
import { manualTimes } from '../src/utils/time.ts';

const intervals = (date, a, b, out = '', back = '') => {
  const p = manualTimes(date, a, b, out, back);
  const d = (s) => new Date(s);
  return out ? [[d(p.checkIn), d(p.lunchOut)], [d(p.lunchIn), d(p.checkOut)]] : [[d(p.checkIn), d(p.checkOut)]];
};

test('2º turno: 30 min noturnos viram 34 min pagos (hora reduzida)', () => {
  const n = calculateNight(intervals('2026-11-02', '14:20', '22:30', '18:00', '18:30'));
  assert.equal(n.nightClockMinutes, 30);
  assert.equal(n.nightPaidMinutes, 34);
  assert.equal(n.prorogationMinutes, 0);
});

test('3º turno 22:30–06:00 com almoço às 02:00: prorrogação das 5h às 6h entra como noturno', () => {
  const n = calculateNight(intervals('2026-11-02', '22:30', '06:00', '02:00', '02:30'));
  // 22:30–05:00 = 390 min, menos 30 de almoço = 360; + 60 de prorrogação
  assert.equal(n.nightClockMinutes, 420);
  assert.equal(n.prorogationMinutes, 60);
  assert.equal(n.nightPaidMinutes, 480);
});

test('jornada diurna que não chega às 5h não tem prorrogação', () => {
  assert.equal(calculateNight(intervals('2026-11-02', '06:00', '14:20', '10:00', '10:30')).nightClockMinutes, 0);
});

test('semana começa na segunda', () => {
  assert.equal(weekStartOf('2026-11-01'), '2026-10-26'); // domingo
  assert.equal(weekStartOf('2026-11-02'), '2026-11-02');
  assert.equal(weekStartOf('2026-11-07'), '2026-11-02'); // sábado
});

test('1º turno: 6 x 7h50 = 47h => 44h normais e 3h de extra 50%', () => {
  const days = ['02', '03', '04', '05', '06', '07'].map(d => ({ date: `2026-11-${d}`, workedMinutes: 470 }));
  const [w] = classifyWeeks(days, SHIFTS.turno1);
  assert.deepEqual([w.regularMinutes, w.overtime50Minutes, w.unscheduled50Minutes, w.overtime100Minutes], [2640, 180, 0, 0]);
});

test('sábado escalado é hora normal; não gera extra por si só', () => {
  const days = ['02', '03', '04', '05', '06', '07'].map(d => ({ date: `2026-11-${d}`, workedMinutes: 440 }));
  const [w] = classifyWeeks(days, SHIFTS.turno2);
  assert.equal(w.regularMinutes, 2640);
  assert.equal(w.overtime50Minutes, 0);
});

test('administrativo: sábado vira extra 50% e domingo 100%, fora das 44h', () => {
  const days = [
    { date: '2026-11-02', workedMinutes: 542 }, { date: '2026-11-03', workedMinutes: 542 },
    { date: '2026-11-04', workedMinutes: 542 }, { date: '2026-11-05', workedMinutes: 542 },
    { date: '2026-11-06', workedMinutes: 542 },
    { date: '2026-11-07', workedMinutes: 120 }, { date: '2026-11-08', workedMinutes: 60 },
  ];
  const [w] = classifyWeeks(days, SHIFTS.administrativo);
  assert.equal(w.regularMinutes, 2640);       // 5 x 9h02 = 45h10; 44h normais
  assert.equal(w.overtime50Minutes, 70);      // 1h10 acima das 44h
  assert.equal(w.unscheduled50Minutes, 120);  // sábado
  assert.equal(w.overtime100Minutes, 60);     // domingo
});

test('feriado trabalhado é 100% e não conta nas 44h', () => {
  const days = [{ date: '2026-11-02', workedMinutes: 440 }, { date: '2026-11-03', workedMinutes: 440 }];
  const [w] = classifyWeeks(days, SHIFTS.turno1, new Set(['2026-11-02']));
  assert.equal(w.overtime100Minutes, 440);
  assert.equal(w.regularMinutes, 440);
});

test('cada minuto cai em uma única categoria (sem dupla contagem)', () => {
  const days = ['02', '03', '04', '05', '06', '07', '08'].map(d => ({ date: `2026-11-${d}`, workedMinutes: 500 }));
  const [w] = classifyWeeks(days, SHIFTS.turno3);
  assert.equal(w.regularMinutes + w.overtime50Minutes + w.unscheduled50Minutes + w.overtime100Minutes, 3500);
});

import { calculateDailyTimes } from '../src/utils/time.ts';
import { LEGACY_PROFILE, withEffectiveOvertime, profileFromRow } from '../src/utils/rules.ts';

test('sem perfil o cálculo legado é idêntico (8h diárias, noturno em minutos de relógio)', () => {
  const p = manualTimes('2026-11-02', '08:00', '18:00', '12:00', '12:30');
  assert.deepEqual(calculateDailyTimes(p), calculateDailyTimes(p, LEGACY_PROFILE));
  assert.equal(calculateDailyTimes(p).overtimeMinutes, 90);
});

test('perfil semanal grava extra 0 no dia e noturno com reduzida + prorrogação (3º turno)', () => {
  const p = manualTimes('2026-11-02', '22:30', '06:00', '02:00', '02:30');
  const r = calculateDailyTimes(p, SHIFTS.turno3);
  assert.equal(r.workedMinutes, 420);
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.nightMinutes, 480); // 420 min de relógio noturno (inclui 5h–6h) x 8/7
  assert.equal(calculateDailyTimes(p).nightMinutes, 360); // legado: só 22h–5h, sem reduzida
});

test('perfil diário configurável (ex.: 7h20) usa o limite do perfil', () => {
  const profile = { ...LEGACY_PROFILE, id: 'x', dailyLimitMinutes: 440 };
  const p = manualTimes('2026-11-02', '06:00', '14:20', '10:00', '10:30');
  assert.equal(calculateDailyTimes(p, profile).overtimeMinutes, 30); // 7h50 - 7h20
});

test('withEffectiveOvertime: legado mantém o gravado; semanal recalcula e atribui aos últimos dias', () => {
  const rec = (n, date, worked, ot = 0, emp = 'a') => ({ id: `${emp}${n}`, employee_id: emp, date, worked_minutes: worked, overtime_minutes: ot });
  const records = [
    ...['02', '03', '04', '05', '06', '07'].map((d, i) => rec(i, `2026-11-${d}`, 470, 0, 'a')),
    rec(9, '2026-11-02', 540, 60, 'b'),
  ];
  const out = withEffectiveOvertime(records, id => (id === 'a' ? SHIFTS.turno1 : LEGACY_PROFILE));
  const a = out.filter(r => r.employee_id === 'a');
  assert.equal(a.reduce((s, r) => s + r.overtime_minutes, 0), 180);
  assert.equal(a[5].overtime_minutes, 180); // 3h concentradas no sábado
  assert.equal(out.find(r => r.employee_id === 'b').overtime_minutes, 60); // legado inalterado
});

test('profileFromRow converte a linha do banco', () => {
  const p = profileFromRow({ id: '1', name: 'X', rule_mode: 'weekly', start_time: '06:00:00', end_time: '14:20:00', lunch_minutes: 30,
    work_days: [1, 2], daily_limit_minutes: 480, weekly_limit_minutes: 2640, night_reduced: true, night_prorogation: false });
  assert.equal(p.start, '06:00');
  assert.equal(p.weeklyLimitMinutes, 2640);
});
