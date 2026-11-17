/**
 * Perfis de regra de jornada. Funções puras, sem dependências, testáveis isoladamente.
 *
 * O sistema é adaptativo: cada funcionário aponta para um perfil (`work_shifts`).
 * Sem perfil, vale o PADRÃO LEGADO (LEGACY_PROFILE): limite diário de 8h, noturno 22h–5h
 * em minutos de relógio, sem hora reduzida e sem prorrogação.
 *
 * Perfil "weekly" (ex.: turnos da Globo Pharma, São José da Lapa/MG):
 *  - extra = excedente da carga semanal nos dias escalados (50%);
 *  - dia não escalado trabalhado = extra (domingo e feriado a 100%, demais dias a 50%);
 *  - dia escalado (inclusive sábado) conta como hora normal;
 *  - noturno com hora reduzida (52min30s) e prorrogação após as 5h, conforme o perfil.
 *
 * Premissas a confirmar com RH/contador: a jornada que atravessa a meia-noite fica
 * atribuída ao dia da entrada; a semana vai de segunda a domingo.
 */

export type RuleMode = 'daily' | 'weekly';

export interface RuleProfile {
  id: string;
  name: string;
  mode: RuleMode;
  /** Usado no modo "daily": minutos acima disso são extra. */
  dailyLimitMinutes: number;
  /** Usado no modo "weekly". */
  weeklyLimitMinutes: number;
  /** Dias escalados (0 = domingo ... 6 = sábado). Usado no modo "weekly". */
  workDays: number[];
  nightReduced: boolean;
  nightProrogation: boolean;
  lunchMinutes: number;
  start?: string; // HH:mm (informativo)
  end?: string;
}

const WEEKLY_44H = 44 * 60;

export const LEGACY_PROFILE: RuleProfile = {
  id: 'legacy',
  name: 'Padrão (8h diárias)',
  mode: 'daily',
  dailyLimitMinutes: 8 * 60,
  weeklyLimitMinutes: WEEKLY_44H,
  workDays: [1, 2, 3, 4, 5, 6],
  nightReduced: false,
  nightProrogation: false,
  lunchMinutes: 0,
};

const shift = (id: string, name: string, start: string, end: string, workDays: number[]): RuleProfile => ({
  id, name, start, end, workDays, mode: 'weekly', dailyLimitMinutes: 8 * 60, weeklyLimitMinutes: WEEKLY_44H,
  nightReduced: true, nightProrogation: true, lunchMinutes: 30,
});

/** Turnos da Globo Pharma (mesmos valores do seed da migration). */
export const SHIFTS = {
  turno1: shift('turno1', '1º turno', '06:00', '14:20', [1, 2, 3, 4, 5, 6]),
  administrativo: shift('administrativo', 'Administrativo', '07:30', '17:02', [1, 2, 3, 4, 5]),
  turno2: shift('turno2', '2º turno', '14:20', '22:30', [1, 2, 3, 4, 5, 6]),
  turno3: shift('turno3', '3º turno', '22:30', '06:00', [1, 2, 3, 4, 5, 6]),
} as const;

/** Converte uma linha da tabela `work_shifts` em perfil. */
export interface WorkShiftRow {
  id: string;
  name: string;
  rule_mode: RuleMode;
  start_time: string | null;
  end_time: string | null;
  lunch_minutes: number;
  work_days: number[];
  daily_limit_minutes: number;
  weekly_limit_minutes: number;
  night_reduced: boolean;
  night_prorogation: boolean;
  is_active?: boolean;
}

export const profileFromRow = (row: WorkShiftRow): RuleProfile => ({
  id: row.id,
  name: row.name,
  mode: row.rule_mode,
  dailyLimitMinutes: row.daily_limit_minutes,
  weeklyLimitMinutes: row.weekly_limit_minutes,
  workDays: row.work_days,
  nightReduced: row.night_reduced,
  nightProrogation: row.night_prorogation,
  lunchMinutes: row.lunch_minutes,
  start: row.start_time?.slice(0, 5),
  end: row.end_time?.slice(0, 5),
});

/** Cada hora noturna vale 52min30s: 60 min de relógio = 8/7 de hora noturna paga. */
const NIGHT_REDUCTION = 8 / 7;

export interface NightBreakdown {
  /** Minutos de relógio em 22h–5h, mais a prorrogação após as 5h. */
  nightClockMinutes: number;
  /** Parte de nightClockMinutes vinda da prorrogação (Súmula 60, II, TST). */
  prorogationMinutes: number;
  /** nightClockMinutes convertidos pela hora reduzida. */
  nightPaidMinutes: number;
}

/**
 * `intervals` são os períodos efetivamente trabalhados (sem o almoço).
 * Se o empregado trabalhou o minuto 4:59–5:00, as horas seguintes da jornada também são noturnas.
 */
export const calculateNight = (intervals: [Date, Date][]): NightBreakdown => {
  let night = 0;
  let prorogation = 0;
  let extended = false;
  for (const [start, end] of intervals) {
    for (let t = start.getTime(); t < end.getTime(); t += 60000) {
      const d = new Date(t);
      const h = d.getHours();
      if (h >= 22 || h < 5) {
        night++;
        if (h === 4 && d.getMinutes() === 59) extended = true;
      } else if (extended && h < 22) {
        night++;
        prorogation++;
      }
    }
  }
  return { nightClockMinutes: night, prorogationMinutes: prorogation, nightPaidMinutes: Math.round(night * NIGHT_REDUCTION) };
};

/** Minutos noturnos a gravar para o perfil (aplica prorrogação e hora reduzida se habilitadas). */
export const nightMinutesForProfile = (intervals: [Date, Date][], profile: RuleProfile): number => {
  const n = calculateNight(intervals);
  const clock = profile.nightProrogation ? n.nightClockMinutes : n.nightClockMinutes - n.prorogationMinutes;
  return profile.nightReduced ? Math.round(clock * NIGHT_REDUCTION) : clock;
};

export interface WorkedDay {
  date: string; // yyyy-MM-dd (data de entrada)
  workedMinutes: number;
}

export interface DayAllocation {
  date: string;
  regularMinutes: number;
  /** Excedente da carga semanal (50%). */
  weeklyExcess50Minutes: number;
  /** Dia não escalado que não é domingo/feriado (50%). */
  unscheduled50Minutes: number;
  /** Domingo não escalado ou feriado (100%). */
  overtime100Minutes: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (date: string) => new Date(`${date}T12:00:00`);

export const weekStartOf = (date: string): string => {
  const d = parse(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toStr(d);
};

export const weekEndOf = (date: string): string => {
  const d = parse(weekStartOf(date));
  d.setDate(d.getDate() + 6);
  return toStr(d);
};

/** Estende um período até semanas inteiras, para apurar o limite semanal nas pontas do ciclo. */
export const wholeWeeks = (from: string, to: string) => ({ from: weekStartOf(from), to: weekEndOf(to) });

/**
 * Distribui os minutos de cada dia em categorias (modo "weekly"), sem dupla contagem.
 * O excedente semanal é atribuído aos últimos dias escalados da semana.
 */
export const allocateDays = (days: WorkedDay[], profile: RuleProfile, holidays: ReadonlySet<string> = new Set()): DayAllocation[] => {
  const result: DayAllocation[] = [];
  const scheduled = new Map<string, DayAllocation[]>();

  for (const { date, workedMinutes } of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    if (workedMinutes <= 0) continue;
    const dow = parse(date).getDay();
    const alloc: DayAllocation = { date, regularMinutes: 0, weeklyExcess50Minutes: 0, unscheduled50Minutes: 0, overtime100Minutes: 0 };
    const isScheduled = profile.workDays.includes(dow);
    if (holidays.has(date) || (dow === 0 && !isScheduled)) alloc.overtime100Minutes = workedMinutes;
    else if (!isScheduled) alloc.unscheduled50Minutes = workedMinutes;
    else {
      alloc.regularMinutes = workedMinutes;
      const key = weekStartOf(date);
      scheduled.set(key, [...(scheduled.get(key) ?? []), alloc]);
    }
    result.push(alloc);
  }

  for (const list of scheduled.values()) {
    let excess = Math.max(0, list.reduce((s, a) => s + a.regularMinutes, 0) - profile.weeklyLimitMinutes);
    for (const alloc of [...list].reverse()) {
      const take = Math.min(excess, alloc.regularMinutes);
      alloc.regularMinutes -= take;
      alloc.weeklyExcess50Minutes = take;
      excess -= take;
    }
  }
  return result;
};

export interface WeekSummary {
  weekStart: string;
  regularMinutes: number;
  overtime50Minutes: number;
  unscheduled50Minutes: number;
  overtime100Minutes: number;
}

export const classifyWeeks = (days: WorkedDay[], profile: RuleProfile, holidays: ReadonlySet<string> = new Set()): WeekSummary[] => {
  const weeks = new Map<string, WeekSummary>();
  for (const a of allocateDays(days, profile, holidays)) {
    const key = weekStartOf(a.date);
    const w = weeks.get(key) ?? { weekStart: key, regularMinutes: 0, overtime50Minutes: 0, unscheduled50Minutes: 0, overtime100Minutes: 0 };
    w.regularMinutes += a.regularMinutes;
    w.overtime50Minutes += a.weeklyExcess50Minutes;
    w.unscheduled50Minutes += a.unscheduled50Minutes;
    w.overtime100Minutes += a.overtime100Minutes;
    weeks.set(key, w);
  }
  return [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
};

export interface OvertimeInput {
  id: string;
  employee_id: string;
  date: string;
  worked_minutes: number;
  overtime_minutes: number;
}

/**
 * Aplica o perfil de cada funcionário aos registros lidos do banco:
 *  - modo "daily": mantém o extra já gravado (comportamento legado, inalterado);
 *  - modo "weekly": recalcula o extra pela semana; `overtime100_minutes` é a parte a 100%.
 * Passe semanas inteiras (ver `wholeWeeks`) e filtre o período depois.
 */
export const withEffectiveOvertime = <T extends OvertimeInput>(
  records: T[],
  profileOf: (employeeId: string) => RuleProfile,
  holidays: ReadonlySet<string> = new Set(),
): (T & { overtime100_minutes: number })[] => {
  const byEmployee = new Map<string, T[]>();
  for (const r of records) byEmployee.set(r.employee_id, [...(byEmployee.get(r.employee_id) ?? []), r]);

  const out = new Map<string, T & { overtime100_minutes: number }>();
  for (const [employeeId, list] of byEmployee) {
    const profile = profileOf(employeeId);
    if (profile.mode === 'daily') {
      for (const r of list) out.set(r.id, { ...r, overtime100_minutes: 0 });
      continue;
    }
    const alloc = new Map(allocateDays(list.map(r => ({ date: r.date, workedMinutes: r.worked_minutes })), profile, holidays)
      .map(a => [a.date, a]));
    for (const r of list) {
      const a = alloc.get(r.date);
      out.set(r.id, {
        ...r,
        overtime_minutes: a ? a.weeklyExcess50Minutes + a.unscheduled50Minutes + a.overtime100Minutes : 0,
        overtime100_minutes: a?.overtime100Minutes ?? 0,
      });
    }
  }
  return records.map(r => out.get(r.id)!);
};
