import { differenceInMinutes, parseISO, isValid, format, isAfter } from 'date-fns';
import { LEGACY_PROFILE, nightMinutesForProfile } from './rules.ts';
import type { RuleProfile } from './rules.ts';

export interface TimeCalculationOptions {
  checkIn: string | Date | null;
  checkOut: string | Date | null;
  lunchOut?: string | Date | null;
  lunchIn?: string | Date | null;
}

export interface DailyCalculationResult {
  totalMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
}

/**
 * Normaliza um objeto, transformando string em Data válida se necessário.
 */
const toDate = (date: string | Date | null | undefined): Date | null => {
  if (!date) return null;
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsed) ? parsed : null;
};

/** Allows an open lunch only while the workday is still open. */
export const validateLunchTimes = ({ checkIn, checkOut, lunchOut, lunchIn }: TimeCalculationOptions): void => {
  if (!lunchOut && !lunchIn) return;
  const start = toDate(checkIn);
  const end = toDate(checkOut);
  const out = toDate(lunchOut);
  const back = toDate(lunchIn);
  if (!start || !out || out <= start || (lunchIn && !back) ||
      (back && back <= out) || (checkOut && (!end || !back || back >= end))) {
    throw new Error('Horários de almoço inválidos. Use entrada < saída para almoço < retorno < saída final.');
  }
};

/** Resolve clock times within a shift, including a single midnight crossing. */
export const manualTimes = (date: string, checkIn: string, checkOut: string, lunchOut = '', lunchIn = '', allowOpen = false): TimeCalculationOptions => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      [checkIn, ...(checkOut || !allowOpen ? [checkOut] : []), ...([lunchOut, lunchIn].filter(Boolean))].some(t => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) {
    throw new Error('Data ou horário inválido.');
  }
  if ((!!lunchOut !== !!lunchIn) && !(allowOpen && !checkOut && lunchOut && !lunchIn)) throw new Error('Preencha os dois horários de almoço ou deixe ambos vazios.');
  const start = new Date(`${date}T${checkIn}:00`);
  if (!isValid(start) || format(start, 'yyyy-MM-dd') !== date) throw new Error('Data inválida.');
  const resolve = (clock: string) => {
    const value = new Date(`${date}T${clock}:00`);
    if (clock < checkIn) value.setDate(value.getDate() + 1);
    return value;
  };
  const end = checkOut ? resolve(checkOut) : null;
  if (end && end <= start) throw new Error('A saída deve ser posterior à entrada.');
  const result = { checkIn: start.toISOString(), checkOut: end?.toISOString() ?? null,
    lunchOut: lunchOut ? resolve(lunchOut).toISOString() : null,
    lunchIn: lunchIn ? resolve(lunchIn).toISOString() : null };
  validateLunchTimes(result);
  return result;
};

/**
 * Sem `profile`, aplica o padrão legado (8h diárias, noturno 22h–5h em minutos de relógio).
 * Com perfil "weekly", o extra não é calculado por dia (0 aqui): depende da semana,
 * ver `withEffectiveOvertime` em rules.ts.
 */
export const calculateDailyTimes = ({ checkIn, checkOut, lunchOut, lunchIn }: TimeCalculationOptions, profile: RuleProfile = LEGACY_PROFILE): DailyCalculationResult => {
  const defaultResult: DailyCalculationResult = {
    totalMinutes: 0,
    workedMinutes: 0,
    overtimeMinutes: 0,
    nightMinutes: 0,
  };

  const start = toDate(checkIn);
  const end = toDate(checkOut);

  validateLunchTimes({ checkIn, checkOut, lunchOut, lunchIn });

  if (!start || !end) {
    return defaultResult;
  }

  // Garante que a saída seja posterior à entrada, caso contrário os dados são inválidos
  if (!isAfter(end, start)) {
    return defaultResult;
  }

  const totalMinutes = differenceInMinutes(end, start);
  const pauseStart = toDate(lunchOut);
  const pauseEnd = toDate(lunchIn);
  const intervals: [Date, Date][] = pauseStart && pauseEnd
    ? [[start, pauseStart], [pauseEnd, end]]
    : [[start, end]];
  const workedMinutes = Math.floor(intervals.reduce((sum, [a, b]) => sum + b.getTime() - a.getTime(), 0) / 60000);
  
  const overtimeMinutes = profile.mode === 'daily' ? Math.max(0, workedMinutes - profile.dailyLimitMinutes) : 0;
  const nightMinutes = nightMinutesForProfile(intervals, profile);

  return {
    totalMinutes,
    workedMinutes,
    overtimeMinutes,
    nightMinutes,
  };
};

/**
 * Formata os minutos num formato de string (HH:mm ou HHh mm m)
 */
export const formatMinutesToTime = (minutes: number, verbose = false): string => {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  
  if (verbose) {
    return `${h}h ${m}m`;
  }
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const formatDateExtensive = (date: string | Date | null): string => {
  const d = toDate(date);
  if (!d) return '--';
  return format(d, "dd/MM/yyyy");
};

export const formatTime = (date: string | Date | null): string => {
  const d = toDate(date);
  if (!d) return '--:--';
  return format(d, "HH:mm");
};

export interface PayrollPeriod {
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
}

export const getPayrollPeriod = (year: number, month: number): PayrollPeriod => {
  // JS/TS Date: month is 0-indexed (0 = January, 5 = June).
  // The payroll period for June (5) starts on May 20th and ends on June 19th.
  const startDate = new Date(year, month - 1, 20);
  const endDate = new Date(year, month, 19);
  
  return {
    startDate,
    endDate,
    startDateStr: format(startDate, 'yyyy-MM-dd'),
    endDateStr: format(endDate, 'yyyy-MM-dd')
  };
};

