/**
 * Geração do AFD (Arquivo Fonte de Dados) para REP-P e do AEJ (Arquivo Eletrônico de Jornada),
 * conforme os leiautes publicados pelo MTE (AFD versão "004" e AEJ versão "002", Portaria MTP 671/2021).
 * Funções puras. Os arquivos saem SEM assinatura: o texto "ASSINATURA_DIGITAL_EM_ARQUIVO_P7S" ocupa o
 * lugar e o arquivo .p7s (ICP-Brasil, CAdES) precisa ser gerado fora do sistema.
 *
 * Convenções adotadas onde o leiaute não detalha (validar com o validador oficial do MTE):
 *  - campos numéricos (N) completados com zeros à esquerda; alfanuméricos (A) com espaços à direita;
 *  - hash em hexadecimal minúsculo; CRC-16/KERMIT em hexadecimal maiúsculo;
 *  - codificação ISO 8859-1; caracteres fora dela viram "?".
 */
import { calculateNight } from './rules.ts';
import type { RuleProfile } from './rules.ts';

const TZ = 'America/Sao_Paulo';
const CRLF = '\r\n';
export const SIGNATURE_PLACEHOLDER = 'ASSINATURA_DIGITAL_EM_ARQUIVO_P7S'.padEnd(100, ' ');

const padR = (value: string | null | undefined, size: number) => (value ?? '').slice(0, size).padEnd(size, ' ');
const padL = (value: string | number | null | undefined, size: number) => String(value ?? '').replace(/\D/g, '').slice(-size).padStart(size, '0');
export const digits = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

/** CRC-16/KERMIT (poly 0x1021 refletido, init 0). "123456789" => 2189. */
export const crc16Kermit = (text: string): string => {
  let crc = 0;
  for (let i = 0; i < text.length; i++) {
    crc ^= text.charCodeAt(i) & 0xff;
    for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >> 1) ^ 0x8408 : crc >> 1;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

const zoneParts = (d: Date) => {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return Object.fromEntries(f.formatToParts(d).map(p => [p.type, p.value])) as Record<string, string>;
};

/** AAAA-MM-ddThh:mm:00±hhmm no fuso de São Paulo (segundos sempre "00"). */
export const afdTimestamp = (value: string | Date): string => {
  const d = new Date(value);
  const p = zoneParts(d);
  const offsetMin = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - d.getTime()) / 60000);
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`;
};
export const afdDate = (value: string | Date): string => afdTimestamp(value).slice(0, 10);
export const afdHourMinute = (value: string | Date): string => afdTimestamp(value).slice(11, 16).replace(':', '');

/** ISO 8859-1; o que não couber vira "?". */
export const toLatin1 = (text: string): Uint8Array => Uint8Array.from(text, ch => (ch.charCodeAt(0) < 256 ? ch.charCodeAt(0) : 63));

export interface Employer {
  kind: 1 | 2; // 1 = CNPJ, 2 = CPF
  id: string;
  name: string;
  location: string;
}

export interface RepSettings {
  inpiRegistration: string;
  developerKind: 1 | 2;
  developerId: string;
  developerName: string;
  developerEmail: string;
  ptrpName: string;
  ptrpVersion: string;
}

export interface AfdRow {
  nsr: number;
  rec_type: 2 | 5 | 6 | 7;
  recorded_at: string;
  responsible_cpf: string | null;
  employee_id: string | null;
  cpf: string | null;
  employee_name: string | null;
  op: 'I' | 'A' | 'E' | null;
  punch_kind: 'entrada' | 'almoco_saida' | 'almoco_retorno' | 'saida' | null;
  punched_at: string | null;
  collector: string | null;
  offline: boolean | null;
  hash: string | null;
  employer_cnpj: string | null;
  employer_name: string | null;
  employer_location: string | null;
}

const withCrc = (body: string) => body + crc16Kermit(body);

export const afdLine = (row: AfdRow): string => {
  const nsr = padL(row.nsr, 9);
  if (row.rec_type === 2) {
    return withCrc(`${nsr}2${afdTimestamp(row.recorded_at)}${padL(row.responsible_cpf, 14)}1${padR(digits(row.employer_cnpj), 14)}${padL('', 14)}`
      + `${padR(row.employer_name, 150)}${padR(row.employer_location, 100)}`);
  }
  if (row.rec_type === 5) {
    return withCrc(`${nsr}5${afdTimestamp(row.recorded_at)}${row.op ?? 'I'}${padL(row.cpf, 12)}${padR(row.employee_name, 52)}${padR('', 4)}${padL(row.responsible_cpf, 11)}`);
  }
  if (row.rec_type === 7) {
    return `${nsr}7${afdTimestamp(row.punched_at ?? row.recorded_at)}${padL(row.cpf, 12)}${afdTimestamp(row.recorded_at)}`
      + `${padL(row.collector ?? '02', 2)}${row.offline ? '1' : '0'}${padR(row.hash, 64)}`;
  }
  throw new Error(`Tipo de registro AFD não suportado: ${row.rec_type}`);
};

export interface AfdInput {
  employer: Employer;
  settings: RepSettings;
  rows: AfdRow[];
  from: string; // yyyy-MM-dd
  to: string;
  generatedAt: Date;
}

export const buildAfd = ({ employer, settings, rows, from, to, generatedAt }: AfdInput): string => {
  const header = withCrc(`${padL(0, 9)}1${employer.kind}${padR(digits(employer.id), 14)}${padL('', 14)}${padR(employer.name, 150)}`
    + `${padL(settings.inpiRegistration, 17)}${from}${to}${afdTimestamp(generatedAt)}004${settings.developerKind}${padR(digits(settings.developerId), 14)}${padR('', 30)}`);
  const sorted = [...rows].filter(r => r.rec_type !== 6).sort((a, b) => a.nsr - b.nsr);
  const count = (t: number) => sorted.filter(r => r.rec_type === t).length;
  const trailer = `999999999${[2, 3, 4, 5, 6, 7].map(t => padL(count(t), 9)).join('')}9`;
  return [header, ...sorted.map(afdLine), trailer, SIGNATURE_PLACEHOLDER].join(CRLF) + CRLF;
};

export const afdFileName = (inpi: string, employerId: string) => `AFD${padL(inpi, 17)}${padR(digits(employerId), 14).trim()}REP_P.txt`;

// ---------------------------------------------------------------- AEJ

export interface AejEmployee {
  id: string;
  cpf: string;
  name: string;
  profile: RuleProfile;
  /** Horário contratual (HH:mm), do cadastro do funcionário ou da regra de jornada. */
  start: string;
  end: string;
}

export interface AejPunchRecord {
  employee_id: string;
  check_in: string;
  lunch_out: string | null;
  lunch_in: string | null;
  check_out: string | null;
  source: 'manual' | 'imported';
}

export interface AejInput {
  employer: Employer;
  settings: RepSettings;
  employees: AejEmployee[];
  records: AejPunchRecord[];
  /** Registros do AFD (tipo 7) do período: marcações originais do coletor. */
  afdPunches: AfdRow[];
  from: string;
  to: string;
  generatedAt: Date;
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase().slice(0, 30);
const hhmm = (clock: string) => clock.replace(':', '').slice(0, 4);

/**
 * Duração contratual em minutos: (fim - início) - almoço; em jornada noturna com hora reduzida,
 * inclui o acréscimo da redução. Aproximação: o almoço é descontado do total, sem posicionamento no dia.
 */
export const contractualMinutes = ({ profile, start, end }: Pick<AejEmployee, 'profile' | 'start' | 'end'>): number => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const a = new Date(2026, 0, 5, sh, sm);
  const b = new Date(2026, 0, 5, eh, em);
  if (b <= a) b.setDate(b.getDate() + 1);
  const total = Math.round((b.getTime() - a.getTime()) / 60000);
  const night = calculateNight([[a, b]]);
  const clock = profile.nightProrogation ? night.nightClockMinutes : night.nightClockMinutes - night.prorogationMinutes;
  const reduction = profile.nightReduced ? Math.round(clock * 8 / 7) - clock : 0;
  return total - profile.lunchMinutes + reduction;
};

type Mark = { at: string; type: 'E' | 'S' | 'D'; seq: number; source: 'O' | 'I'; reason: string };

/** Marcações de um registro: pares entrada/saída (almoço divide em dois pares). */
export const marksForRecord = (r: AejPunchRecord, live: ReadonlySet<number>): Mark[] => {
  const both = !!(r.lunch_out && r.lunch_in);
  const slots: [string | null, 'E' | 'S', number][] = both
    ? [[r.check_in, 'E', 1], [r.lunch_out, 'S', 1], [r.lunch_in, 'E', 2], [r.check_out, 'S', 2]]
    : r.lunch_out
      ? [[r.check_in, 'E', 1], [r.lunch_out, 'S', 1]]
      : [[r.check_in, 'E', 1], [r.check_out, 'S', 1]];
  const reason = r.source === 'imported' ? 'Importação de arquivo' : 'Marcação lançada manualmente';
  return slots.filter((s): s is [string, 'E' | 'S', number] => !!s[0])
    .map(([at, type, seq]) => ({ at, type, seq, source: live.has(new Date(at).getTime()) ? 'O' : 'I', reason }));
};

export const buildAej = ({ employer, settings, employees, records, afdPunches, from, to, generatedAt }: AejInput): string => {
  const line = (...fields: (string | number)[]) => fields.join('|');
  const lines: string[] = [];
  const counts = new Array(8).fill(0) as number[];
  const add = (type: number, ...fields: (string | number)[]) => {
    lines.push(line(String(type).padStart(2, '0'), ...fields));
    counts[type - 1]++;
  };

  add(1, employer.kind, digits(employer.id), '', '', employer.name.slice(0, 150), from, to, afdTimestamp(generatedAt), '002');
  add(2, 1, 3, padL(settings.inpiRegistration, 17));

  const vinculo = new Map(employees.map((e, i) => [e.id, i + 1]));
  employees.forEach((e, i) => add(3, i + 1, digits(e.cpf), e.name.slice(0, 150)));

  const contracts = new Map<string, { code: string; e: AejEmployee }>();
  const codes = new Map<string, AejEmployee>();
  for (const e of employees) {
    const code = e.profile.id === 'legacy' ? `PADRAO_${hhmm(e.start)}_${hhmm(e.end)}` : slug(e.profile.name) || 'JORNADA';
    const unique = `${code}_${hhmm(e.start)}${hhmm(e.end)}`.slice(0, 30);
    contracts.set(e.id, { code: unique, e });
    codes.set(unique, e);
  }
  for (const [code, e] of codes) add(4, code, contractualMinutes(e), hhmm(e.start), hhmm(e.end), '', '');

  for (const e of employees) {
    const id = vinculo.get(e.id)!;
    const code = contracts.get(e.id)!.code;
    const liveTimes = new Set(afdPunches.filter(p => p.employee_id === e.id && p.punched_at).map(p => new Date(p.punched_at!).getTime()));
    const mine = records.filter(r => r.employee_id === e.id).sort((a, b) => a.check_in.localeCompare(b.check_in));
    const current = new Set<number>();
    for (const r of mine) {
      for (const m of marksForRecord(r, liveTimes)) {
        current.add(new Date(m.at).getTime());
        add(5, id, afdTimestamp(m.at), m.source === 'O' ? 1 : '', m.type, padL(m.seq, 3), m.source,
          m.type === 'E' && m.seq === 1 ? code : '', m.source === 'I' ? m.reason : '');
      }
    }
    // Marcação original (AFD) que foi substituída/removida por correção: entra como desconsiderada.
    for (const p of afdPunches.filter(p => p.employee_id === e.id && p.punched_at && !current.has(new Date(p.punched_at).getTime()))) {
      const seq = p.punch_kind === 'almoco_retorno' ? 2 : 1;
      add(5, id, afdTimestamp(p.punched_at!), 1, 'D', padL(seq, 3), 'O', '', 'Marcação original substituída por correção');
    }
  }

  add(8, settings.ptrpName.slice(0, 150), settings.ptrpVersion.slice(0, 8), settings.developerKind, digits(settings.developerId),
    settings.developerName.slice(0, 150), settings.developerEmail.slice(0, 50));
  lines.push(line('99', ...counts));
  return [...lines, SIGNATURE_PLACEHOLDER].join(CRLF) + CRLF;
};

export const aejFileName = (employerId: string, from: string, to: string) => `AEJ_${digits(employerId)}_${from}_${to}.txt`;

/** Valida o dígito verificador de um CPF (11 dígitos). */
export const isValidCpf = (value: string): boolean => {
  const d = digits(value);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    return ((sum * 10) % 11) % 10;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
};
