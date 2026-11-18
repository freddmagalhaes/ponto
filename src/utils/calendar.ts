/** Identificação de dias (final de semana, domingo, feriados) para exibição. Funções puras. */

export type HolidayScope = 'national' | 'state' | 'municipal';
export interface HolidayInfo { name: string; scope: HolidayScope }
export type HolidayMap = ReadonlyMap<string, HolidayInfo[]>;

export interface DayTag { kind: 'weekend' | 'weekday-name' | 'holiday'; label: string }

const SCOPE_LABEL: Record<HolidayScope, string> = { national: 'nacional', state: 'estadual', municipal: 'municipal' };

const dayOfWeek = (date: string) => new Date(`${date}T12:00:00`).getDay();

/**
 * Etiquetas do dia: sábado e domingo mostram "Final de semana" e o nome do dia;
 * feriados mostram abrangência e nome (um dia pode ter mais de um, e coincidir com o fim de semana).
 */
export const dayTags = (date: string, holidays: HolidayMap = new Map()): DayTag[] => {
  const tags: DayTag[] = [];
  const dow = dayOfWeek(date);
  if (dow === 0 || dow === 6) {
    tags.push({ kind: 'weekend', label: 'Final de semana' });
    tags.push({ kind: 'weekday-name', label: dow === 0 ? 'Domingo' : 'Sábado' });
  }
  for (const h of holidays.get(date) ?? []) tags.push({ kind: 'holiday', label: `Feriado ${SCOPE_LABEL[h.scope]} · ${h.name}` });
  return tags;
};

/** Todas as datas (yyyy-MM-dd) de `from` a `to`, inclusive. */
export const eachDate = (from: string, to: string): string[] => {
  const dates: string[] = [];
  const d = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const p = (n: number) => String(n).padStart(2, '0');
  while (d <= end) {
    dates.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return dates;
};

export const buildHolidayMap = (rows: { date: string; name: string; scope: HolidayScope }[]): Map<string, HolidayInfo[]> => {
  const map = new Map<string, HolidayInfo[]>();
  for (const r of rows) map.set(r.date, [...(map.get(r.date) ?? []), { name: r.name, scope: r.scope }]);
  return map;
};
