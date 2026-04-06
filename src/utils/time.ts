import { differenceInMinutes, parseISO, isValid, format, isAfter, isBefore, getHours, startOfDay } from 'date-fns';

export interface TimeCalculationOptions {
  checkIn: string | Date | null;
  checkOut: string | Date | null;
}

export interface DailyCalculationResult {
  totalMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  nightMinutes: number;
}

const REGULAR_WORK_HOURS_MINUTES = 8 * 60; // 8 horas

/**
 * Normaliza um objeto, transformando string em Data válida se necessário.
 */
const toDate = (date: string | Date): Date | null => {
  if (!date) return null;
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsed) ? parsed : null;
};

/**
 * Calcula o tempo trabalhado dentro do período noturno (22:00 - 05:00).
 */
const getNightMinutes = (start: Date, end: Date): number => {
  let nightMins = 0;
  let current = new Date(start);

  // Verificamos minuto a minuto se recai na janela noturna
  while (isBefore(current, end)) {
    const hour = getHours(current);
    if (hour >= 22 || hour < 5) {
      nightMins++;
    }
    current = new Date(current.getTime() + 60000); // adiciona 1 minuto
  }
  return nightMins;
};

export const calculateDailyTimes = ({ checkIn, checkOut }: TimeCalculationOptions): DailyCalculationResult => {
  const defaultResult: DailyCalculationResult = {
    totalMinutes: 0,
    workedMinutes: 0,
    overtimeMinutes: 0,
    nightMinutes: 0,
  };

  const start = toDate(checkIn as any);
  const end = toDate(checkOut as any);

  if (!start || !end) {
    return defaultResult;
  }

  // Garante que a saída seja posterior à entrada, caso contrário os dados são inválidos
  if (!isAfter(end, start)) {
    return defaultResult;
  }

  const totalMinutes = differenceInMinutes(end, start);
  
  // O horário de almoço fixo é das 12:00 às 13:12
  const dayStart = startOfDay(start);
  const lunchStart = new Date(dayStart);
  lunchStart.setHours(12, 0, 0, 0);
  
  const lunchEnd = new Date(dayStart);
  lunchEnd.setHours(13, 12, 0, 0);

  let lunchDeduction = 0;

  // Verifica se o período de trabalho tem intersecção com o almoço
  if (isBefore(start, lunchEnd) && isAfter(end, lunchStart)) {
    // Calcula o início efetivo da intersecção
    const effectiveLunchStart = isAfter(start, lunchStart) ? start : lunchStart;
    // Calcula o fim efetivo da intersecção
    const effectiveLunchEnd = isBefore(end, lunchEnd) ? end : lunchEnd;
    
    lunchDeduction = differenceInMinutes(effectiveLunchEnd, effectiveLunchStart);
  }

  const workedMinutes = Math.max(0, totalMinutes - lunchDeduction);
  
  // Horas extras: qualquer valor trabalhado que exceder 8 horas (480 minutos)
  const overtimeMinutes = Math.max(0, workedMinutes - REGULAR_WORK_HOURS_MINUTES);

  // Minutos noturnos
  const nightMinutes = getNightMinutes(start, end);

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
  const d = toDate(date as any);
  if (!d) return '--';
  return format(d, "dd/MM/yyyy");
};

export const formatTime = (date: string | Date | null): string => {
  const d = toDate(date as any);
  if (!d) return '--:--';
  return format(d, "HH:mm");
};
