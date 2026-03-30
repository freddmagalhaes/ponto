import { differenceInMinutes, parseISO, isValid, format, isAfter, isBefore, addDays, getHours, setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';

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

const LUNCH_BREAK_MINUTES = 72; // 1h12min
const REGULAR_WORK_HOURS_MINUTES = 8 * 60; // 8 hours

/**
 * Normalizes a date-like object to a valid Date.
 */
const toDate = (date: string | Date): Date | null => {
  if (!date) return null;
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  return isValid(parsed) ? parsed : null;
};

/**
 * Calculates time inside the 22:00 - 05:00 window.
 */
const getNightMinutes = (start: Date, end: Date): number => {
  let nightMins = 0;
  let current = new Date(start);

  // We check minute by minute to see if it falls in the night window (simple approach for ranges < 24h)
  while (isBefore(current, end)) {
    const hour = getHours(current);
    if (hour >= 22 || hour < 5) {
      nightMins++;
    }
    current = new Date(current.getTime() + 60000); // add 1 minute
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

  // Ensure end is after start, if not something is wrong with the record
  if (!isAfter(end, start)) {
    return defaultResult;
  }

  const totalMinutes = differenceInMinutes(end, start);
  
  // Deduct fixed 1h12 lunch break
  // Only deduct if they worked more than the lunch break itself to avoid negative numbers
  const workedMinutes = Math.max(0, totalMinutes > LUNCH_BREAK_MINUTES ? totalMinutes - LUNCH_BREAK_MINUTES : totalMinutes);
  
  // Overtime is anything over 8 hours
  const overtimeMinutes = Math.max(0, workedMinutes - REGULAR_WORK_HOURS_MINUTES);

  // Night hours
  const nightMinutes = getNightMinutes(start, end);

  return {
    totalMinutes,
    workedMinutes,
    overtimeMinutes,
    nightMinutes,
  };
};

/**
 * Formats minutes into HH:mm or HHh mm m string format
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
