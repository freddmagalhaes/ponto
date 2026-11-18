import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { LEGACY_PROFILE, profileFromRow } from '../utils/rules';
import { buildHolidayMap } from '../utils/calendar';
import type { HolidayScope } from '../utils/calendar';
import type { RuleProfile, WorkShiftRow } from '../utils/rules';

/**
 * Carrega perfis de jornada e feriados. Se as tabelas ainda não existem (migration não aplicada)
 * ou a leitura falha, cai no padrão legado para não quebrar a apuração.
 */
export function useRuleProfiles() {
  const [rows, setRows] = useState<WorkShiftRow[]>([]);
  const [holidayRows, setHolidayRows] = useState<{ date: string; name: string; scope: HolidayScope }[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [shifts, holidays] = await Promise.all([
      supabase.from('work_shifts').select('*').order('name'),
      supabase.from('holidays').select('date, name, scope'),
    ]);
    setRows(shifts.error ? [] : (shifts.data as WorkShiftRow[]));
    setHolidayRows(holidays.error ? [] : (holidays.data as { date: string; name: string; scope: HolidayScope }[]));
    setLoading(false);
  }, []);

  useEffect(() => { Promise.resolve().then(reload); }, [reload]);

  const profiles = useMemo(() => new Map(rows.map(r => [r.id, profileFromRow(r)])), [rows]);
  const holidays = useMemo(() => new Set(holidayRows.map(h => h.date)), [holidayRows]);
  const holidayInfo = useMemo(() => buildHolidayMap(holidayRows), [holidayRows]);
  const getProfile = useCallback((shiftId?: string | null): RuleProfile =>
    (shiftId && profiles.get(shiftId)) || LEGACY_PROFILE, [profiles]);

  return { rows, profiles, holidays, holidayInfo, getProfile, loading, reload };
}
