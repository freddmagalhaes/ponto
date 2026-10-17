import { differenceInMinutes, parseISO, isValid, format, isAfter, isBefore, getHours } from 'date-fns';

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
const toDate = (date: string | Date | null | undefined): Date | null => {
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

  const start = toDate(checkIn);
  const end = toDate(checkOut);

  if (!start || !end) {
    return defaultResult;
  }

  // Garante que a saída seja posterior à entrada, caso contrário os dados são inválidos
  if (!isAfter(end, start)) {
    return defaultResult;
  }

  const totalMinutes = differenceInMinutes(end, start);
  const workedMinutes = Math.max(0, totalMinutes);
  
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

// Datas de transição entre empresas
export const DVL_LAST_WORK_DATE = '2026-10-08';
export const GLOBO_PHARMA_START_DATE = '2026-10-13';

/**
 * Retorna a empresa correspondente com base na data do registro
 * - Até 08/10/2026: DVL
 * - A partir de 13/10/2026: Globo Pharma
 */
export const getCompanyForDate = (dateStr: string): 'DVL' | 'Globo Pharma' => {
  if (dateStr <= DVL_LAST_WORK_DATE) {
    return 'DVL';
  }
  return 'Globo Pharma';
};
