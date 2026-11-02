import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDailyTimes, manualTimes, validateLunchTimes } from '../src/utils/time.ts';

const calc = (start, end, out = '', back = '') => calculateDailyTimes(manualTimes('2026-11-01', start, end, out, back));

test('one hour lunch is deducted before computing overtime', () => {
  assert.deepEqual(calc('08:00', '18:00', '12:00', '13:00'), {
    totalMinutes: 600, workedMinutes: 540, overtimeMinutes: 60, nightMinutes: 0,
  });
});
test('two hour lunch leaves eight hours and no overtime', () => {
  assert.equal(calc('08:00', '18:00', '12:00', '14:00').workedMinutes, 480);
  assert.equal(calc('08:00', '18:00', '12:00', '14:00').overtimeMinutes, 0);
});
test('short shift without lunch and legacy calculations retain their behavior', () => {
  assert.equal(calc('08:00', '12:00').workedMinutes, 240);
  assert.equal(calc('08:00', '18:00').overtimeMinutes, 120);
});
test('night lunch is excluded from night minutes across midnight', () => {
  assert.deepEqual(calc('22:00', '06:00', '01:00', '02:00'), {
    totalMinutes: 480, workedMinutes: 420, overtimeMinutes: 0, nightMinutes: 360,
  });
});
test('interval itself can cross midnight', () => {
  assert.equal(calc('20:00', '06:00', '23:30', '00:30').workedMinutes, 540);
  assert.equal(calc('20:00', '06:00', '23:30', '00:30').nightMinutes, 360);
});
test('deducts only the night portion of an interval crossing 22h', () => {
  assert.equal(calc('18:00', '03:00', '21:30', '22:30').nightMinutes, 270);
});
test('manual input rejects partial intervals and invalid dates or clocks', () => {
  for (const args of [
    ['2026-11-01', '08:00', '18:00', '12:00', ''],
    ['2026-11-01', '08:00', '18:00', '', '13:00'],
    ['2026-02-30', '08:00', '18:00'],
    ['2026-11-01', '25:00', '18:00'],
    ['2026-11-01', '08:00', '08:00'],
  ]) assert.throws(() => manualTimes(...args));
});
test('rejects lunch outside shift and reversed or equal punches', () => {
  for (const [out, back] of [['07:00','13:00'], ['12:00','19:00'], ['13:00','12:00'], ['12:00','12:00']]) {
    assert.throws(() => calc('08:00', '18:00', out, back));
  }
});
test('open lunch is valid but checkout without return fails', () => {
  const punches = { checkIn: '2026-11-01T08:00:00-03:00', lunchOut: '2026-11-01T12:00:00-03:00', checkOut: null };
  assert.doesNotThrow(() => validateLunchTimes(punches));
  assert.equal(calculateDailyTimes(punches).workedMinutes, 0);
  assert.throws(() => calculateDailyTimes({ ...punches, checkOut: '2026-11-01T18:00:00-03:00' }));
});
test('import preserves a lunch and rejects incompatible new shift boundaries', () => {
  const punches = manualTimes('2026-11-01', '08:00', '18:00', '12:00', '13:00');
  assert.equal(calculateDailyTimes({ ...punches, checkOut: '2026-11-01T17:00:00-03:00' }).workedMinutes, 480);
  assert.throws(() => calculateDailyTimes({ ...punches, checkOut: '2026-11-01T12:30:00-03:00' }));
});

test('rounds the combined work duration once, preserving partial minutes across lunch', () => {
  assert.equal(calculateDailyTimes({
    checkIn: '2026-11-01T08:00:30-03:00', lunchOut: '2026-11-01T12:00:00-03:00',
    lunchIn: '2026-11-01T13:00:30-03:00', checkOut: '2026-11-01T18:00:00-03:00',
  }).workedMinutes, 539);
});

test('history can correct an open shift without inventing an exit', () => {
  const punches = manualTimes('2026-10-30', '08:00', '', '', '', true);
  assert.equal(punches.checkOut, null);
  assert.equal(calculateDailyTimes(punches).workedMinutes, 0);
  assert.throws(() => manualTimes('2026-10-30', '08:00', ''));
});
test('history can correct an open lunch but cannot save return without departure', () => {
  assert.doesNotThrow(() => manualTimes('2026-10-30', '08:00', '', '12:00', '', true));
  assert.throws(() => manualTimes('2026-10-30', '08:00', '', '', '13:00', true));
  assert.throws(() => manualTimes('2026-10-30', '08:00', '18:00', '12:00', '', true));
});
test('changing the record date moves all punches together, preserving an overnight shift', () => {
  const punches = manualTimes('2026-10-30', '22:00', '06:00', '01:00', '02:00', true);
  assert.equal(new Date(punches.checkIn).getDate(), 30);
  assert.equal(new Date(punches.checkOut).getDate(), 31);
  assert.equal(new Date(punches.lunchOut).getDate(), 31);
  assert.equal(calculateDailyTimes(punches).workedMinutes, 420);
});
