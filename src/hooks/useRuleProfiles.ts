import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../services/supabase';
import { LEGACY_PROFILE, profileFromRow } from '../utils/rules';
import type { RuleProfile, WorkShiftRow } from '../utils/rules';

/**
 * Carrega perfis de jornada e feriados. Se as tabelas ainda não existem (migration não aplicada)
 * ou a leitura falha, cai no padrão legado para não quebrar a apuração.
 */
export function useRuleProfiles() {
  const [rows, setRows] = useState<WorkShiftRow[]>([]);
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [shifts, holidays] = await Promise.all([
      supabase.from('work_shifts').select('*').order('name'),
      supabase.from('holidays').select('date'),
    ]);
    setRows(shifts.error ? [] : (shifts.data as WorkShiftRow[]));
    setHolidayDates(holidays.error ? [] : (holidays.data as { date: string }[]).map(h => h.date));
    setLoading(false);
  }, []);

  useEffect(() => { Promise.resolve().then(reload); }, [reload]);

  const profiles = useMemo(() => new Map(rows.map(r => [r.id, profileFromRow(r)])), [rows]);
  const holidays = useMemo(() => new Set(holidayDates), [holidayDates]);
  const getProfile = useCallback((shiftId?: string | null): RuleProfile =>
    (shiftId && profiles.get(shiftId)) || LEGACY_PROFILE, [profiles]);

  return { rows, profiles, holidays, getProfile, loading, reload };
}
