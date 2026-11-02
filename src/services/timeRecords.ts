import { supabase } from './supabase';

export interface TimeRecord {
  id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  lunch_out: string | null;
  lunch_in: string | null;
  worked_minutes: number;
}

/** Compare all punch timestamps so a stale page cannot overwrite a newer punch. */
export async function saveTimeRecord(values: Record<string, unknown>, previous: TimeRecord | null, manualOnly = false) {
  if (!previous) {
    const { data, error } = await supabase.from('time_records').insert(values).select().single();
    if (error) throw error;
    return data as TimeRecord;
  }
  let query = supabase.from('time_records').update(values).eq('id', previous.id).eq('date', previous.date);
  if (manualOnly) query = query.eq('source', 'manual');
  for (const key of ['check_in', 'check_out', 'lunch_out', 'lunch_in'] as const) {
    query = previous[key] == null ? query.is(key, null) : query.eq(key, previous[key]);
  }
  const { data, error } = await query.select().maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('O registro foi alterado em outra sessão. Recarregue os horários antes de tentar novamente.');
  return data as TimeRecord;
}
