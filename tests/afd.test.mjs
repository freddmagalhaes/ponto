import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc16Kermit, afdTimestamp, afdLine, buildAfd, buildAej, afdFileName, isValidCpf, toLatin1, contractualMinutes, marksForRecord } from '../src/utils/afd.ts';
import { SHIFTS, LEGACY_PROFILE } from '../src/utils/rules.ts';

const employer = { kind: 1, id: '11222333000181', name: 'GLOBO PHARMA LTDA', location: 'Sao Jose da Lapa/MG' };
const settings = { inpiRegistration: '123456', developerKind: 1, developerId: '99888777000155', developerName: 'Dev', developerEmail: 'dev@x.com', ptrpName: 'Ponto', ptrpVersion: '1.0' };
const base = { responsible_cpf: '52998224725', employee_id: null, cpf: null, employee_name: null, op: null, punch_kind: null, punched_at: null,
  collector: null, offline: null, hash: null, employer_cnpj: null, employer_name: null, employer_location: null };
const rows = [
  { ...base, nsr: 1, rec_type: 2, recorded_at: '2026-11-01T12:00:00Z', employer_cnpj: '11222333000181', employer_name: 'GLOBO PHARMA LTDA', employer_location: 'Sao Jose da Lapa/MG' },
  { ...base, nsr: 2, rec_type: 5, recorded_at: '2026-11-01T12:01:00Z', op: 'I', cpf: '52998224725', employee_name: 'Ana Souza', employee_id: 'e1' },
  { ...base, nsr: 3, rec_type: 7, recorded_at: '2026-11-02T09:00:35Z', punched_at: '2026-11-02T09:00:35Z', cpf: '52998224725', collector: '02', offline: false,
    hash: 'a'.repeat(64), punch_kind: 'entrada', employee_id: 'e1' },
];

test('CRC-16/KERMIT bate com o vetor do leiaute ("123456789" => 2189)', () => {
  assert.equal(crc16Kermit('123456789'), '2189');
});

test('data e hora no formato do AFD, fuso de São Paulo, segundos "00"', () => {
  assert.equal(afdTimestamp('2026-11-17T17:20:35Z'), '2026-11-17T14:20:00-0300');
  assert.equal(afdTimestamp('2026-11-18T02:30:00Z'), '2026-11-17T23:30:00-0300');
});

test('tamanhos dos registros do AFD conferem com as posições do leiaute', () => {
  const [t2, t5, t7] = rows.map(afdLine);
  assert.equal(t2.length, 331);
  assert.equal(t5.length, 118);
  assert.equal(t7.length, 137);
  assert.equal(t7.slice(0, 10), '0000000037');
  assert.equal(t7.slice(10, 34), '2026-11-02T06:00:00-0300');
  assert.equal(t7.slice(34, 46), '052998224725'); // CPF em 12 posições
  assert.equal(t7.slice(70, 72), '02');
  assert.equal(t7.slice(72, 73), '0');
  assert.equal(t7.slice(73), 'a'.repeat(64));
  assert.equal(t5.slice(34, 35), 'I');
  assert.equal(t5.slice(114), crc16Kermit(t5.slice(0, 114)));
});

test('arquivo AFD: cabeçalho de 302, trailer de 64, assinatura de 100, CRLF, ordenado por NSR', () => {
  const text = buildAfd({ employer, settings, rows: [...rows].reverse(), from: '2026-11-01', to: '2026-11-30', generatedAt: new Date('2026-12-01T12:00:00Z') });
  const lines = text.split('\r\n');
  assert.equal(lines.pop(), ''); // termina com CRLF, sem linha em branco
  assert.equal(lines[0].length, 302);
  assert.equal(lines[0].slice(9, 11), '11');
  assert.equal(lines[0].slice(189, 206), '00000000000123456'); // INPI em 17 posições
  assert.equal(lines[0].slice(250, 253), '004');
  assert.deepEqual(lines.slice(1, 4).map(l => l.slice(0, 9)), ['000000001', '000000002', '000000003']);
  const trailer = lines[4];
  assert.equal(trailer.length, 64);
  assert.equal(trailer, '999999999' + '000000001' + '000000000' + '000000000' + '000000001' + '000000000' + '000000001' + '9');
  assert.equal(lines[5].length, 100);
  assert.ok(lines[5].startsWith('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S'));
  assert.equal(afdFileName('123456', '11.222.333/0001-81'), 'AFD0000000000012345611222333000181REP_P.txt');
});

test('ISO 8859-1: acentos preservados, outros caracteres viram "?"', () => {
  assert.deepEqual([...toLatin1('João €')], [74, 111, 227, 111, 32, 63]);
});

test('CPF: valida dígitos verificadores', () => {
  assert.equal(isValidCpf('529.982.247-25'), true);
  assert.equal(isValidCpf('52998224726'), false);
  assert.equal(isValidCpf('11111111111'), false);
});

test('duração contratual: turnos com 30 min de almoço e hora noturna reduzida', () => {
  assert.equal(contractualMinutes({ profile: SHIFTS.turno1, start: '06:00', end: '14:20' }), 470);
  assert.equal(contractualMinutes({ profile: SHIFTS.administrativo, start: '07:30', end: '17:02' }), 542);
  assert.equal(contractualMinutes({ profile: LEGACY_PROFILE, start: '08:00', end: '18:00' }), 600);
  // 3º turno: 450 - 30 + redução de (22:30-05:00 + prorrogação 5-6h = 450 min noturnos) -> 450*8/7 - 450 = 64
  assert.equal(contractualMinutes({ profile: SHIFTS.turno3, start: '22:30', end: '06:00' }), 450 - 30 + 64);
});

test('marcações: par entrada/saída, almoço divide em dois pares, origem O/I', () => {
  const rec = { employee_id: 'e1', check_in: '2026-11-02T09:00:00Z', lunch_out: '2026-11-02T13:00:00Z', lunch_in: '2026-11-02T13:30:00Z', check_out: '2026-11-02T17:00:00Z', source: 'manual' };
  const marks = marksForRecord(rec, new Set([new Date(rec.check_in).getTime()]));
  assert.deepEqual(marks.map(m => [m.type, m.seq, m.source]), [['E', 1, 'O'], ['S', 1, 'I'], ['E', 2, 'I'], ['S', 2, 'I']]);
});

test('arquivo AEJ: registros 01-05, 08 e 99, motivo obrigatório nas marcações manuais, D para original substituída', () => {
  const employees = [{ id: 'e1', cpf: '52998224725', name: 'Ana Souza', profile: SHIFTS.turno1, start: '06:00', end: '14:20' }];
  const records = [{ employee_id: 'e1', check_in: '2026-11-02T09:00:35Z', lunch_out: null, lunch_in: null, check_out: '2026-11-02T17:20:00Z', source: 'manual' }];
  const afdPunches = [
    rows[2],
    { ...rows[2], nsr: 4, punched_at: '2026-11-02T09:30:00Z', recorded_at: '2026-11-02T09:30:00Z', punch_kind: 'entrada' },
  ];
  const text = buildAej({ employer, settings, employees, records, afdPunches, from: '2026-11-01', to: '2026-11-30', generatedAt: new Date('2026-12-01T12:00:00Z') });
  const lines = text.split('\r\n').slice(0, -1);
  assert.equal(lines[0], '01|1|11222333000181|||GLOBO PHARMA LTDA|2026-11-01|2026-11-30|2026-12-01T09:00:00-0300|002');
  assert.equal(lines[1], '02|1|3|00000000000123456');
  assert.equal(lines[2], '03|1|52998224725|Ana Souza');
  assert.equal(lines[3], '04|1_TURNO_06001420|470|0600|1420||');
  const marks = lines.filter(l => l.startsWith('05|'));
  assert.equal(marks[0], '05|1|2026-11-02T06:00:00-0300|1|E|001|O|1_TURNO_06001420|');
  assert.ok(marks[1].includes('|S|001|I||Marcação lançada manualmente'));
  assert.ok(marks[2].includes('|D|001|O||Marcação original substituída por correção'));
  assert.equal(lines.find(l => l.startsWith('08|')), '08|Ponto|1.0|1|99888777000155|Dev|dev@x.com');
  assert.equal(lines.find(l => l.startsWith('99|')), '99|1|1|1|1|3|0|0|1');
  assert.ok(lines.at(-1).startsWith('ASSINATURA_DIGITAL_EM_ARQUIVO_P7S'));
});
