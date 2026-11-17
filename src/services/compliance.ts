import { supabase } from './supabase';
import { fetchAllPages } from '../utils/pagination';
import { buildAfd, buildAej, afdFileName, aejFileName, toLatin1 } from '../utils/afd';
import type { AfdRow, AejEmployee, AejPunchRecord, RepSettings, Employer } from '../utils/afd';
import type { RuleProfile } from '../utils/rules';

export interface RepSettingsRow {
  inpi_registration: string | null; developer_kind: 1 | 2 | null; developer_id: string | null; developer_name: string | null;
  developer_email: string | null; ptrp_name: string; ptrp_version: string; enforce_afd: boolean;
}
export interface CompanyRow { id: string; name: string; cnpj: string | null; service_location: string | null }

export const settingsFromRow = (r: RepSettingsRow): RepSettings => {
  const missing = [
    !r.inpi_registration && 'registro no INPI', !r.developer_kind && 'tipo de identificador do desenvolvedor',
    !r.developer_id && 'CNPJ/CPF do desenvolvedor', !r.developer_name && 'nome do desenvolvedor', !r.developer_email && 'e-mail do desenvolvedor',
  ].filter(Boolean);
  if (missing.length) throw new Error(`Preencha em "Dados do software": ${missing.join(', ')}.`);
  return { inpiRegistration: r.inpi_registration!, developerKind: r.developer_kind!, developerId: r.developer_id!, developerName: r.developer_name!,
    developerEmail: r.developer_email!, ptrpName: r.ptrp_name, ptrpVersion: r.ptrp_version };
};

const employerOf = (c: CompanyRow): Employer => {
  if (!c.cnpj || !/^\d{14}$/.test(c.cnpj)) throw new Error(`Informe o CNPJ (14 dígitos) da empresa ${c.name}.`);
  return { kind: 1, id: c.cnpj, name: c.name, location: c.service_location ?? '' };
};

// Brasil não tem horário de verão desde 2019; o intervalo do período usa o fuso fixo -03:00.
const startOf = (d: string) => `${d}T00:00:00-03:00`;
const endOf = (d: string) => `${d}T23:59:59.999-03:00`;

const AFD_COLUMNS = 'nsr, rec_type, recorded_at, responsible_cpf, employee_id, cpf, employee_name, op, punch_kind, punched_at, collector, offline, hash, employer_cnpj, employer_name, employer_location';

const fetchAfdRows = (companyId: string, from: string, to: string, onlyPunches = false) =>
  fetchAllPages<AfdRow>(async (offset, size) => {
    let q = supabase.from('afd_records').select(AFD_COLUMNS, { count: 'exact' }).eq('company_id', companyId);
    q = onlyPunches ? q.eq('rec_type', 7).gte('punched_at', startOf(from)).lte('punched_at', endOf(to))
                    : q.gte('recorded_at', startOf(from)).lte('recorded_at', endOf(to));
    const { data, count, error } = await q.order('nsr').range(offset, offset + size - 1);
    if (error) throw error;
    return { data: (data ?? []) as unknown as AfdRow[], count };
  });

export async function exportAfd(settingsRow: RepSettingsRow, company: CompanyRow, from: string, to: string) {
  const settings = settingsFromRow(settingsRow);
  const employer = employerOf(company);
  const rows = await fetchAfdRows(company.id, from, to);
  const text = buildAfd({ employer, settings, rows, from, to, generatedAt: new Date() });
  return { filename: afdFileName(settings.inpiRegistration, employer.id), bytes: toLatin1(text), records: rows.length };
}

export async function exportAej(settingsRow: RepSettingsRow, company: CompanyRow, from: string, to: string,
  getProfile: (shiftId?: string | null) => RuleProfile) {
  const settings = settingsFromRow(settingsRow);
  const employer = employerOf(company);

  const { data: links, error: linkError } = await supabase.from('employee_companies').select('employee_id, start_date, end_date')
    .eq('company_id', company.id).lte('start_date', to).or(`end_date.is.null,end_date.gte.${from}`);
  if (linkError) throw linkError;
  const windows = new Map<string, { start: string; end: string | null }[]>();
  for (const l of links ?? []) windows.set(l.employee_id, [...(windows.get(l.employee_id) ?? []), { start: l.start_date, end: l.end_date }]);
  const ids = [...windows.keys()];

  const chunks = <T,>(list: T[], size = 50) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));
  const empRows: { id: string; name: string; cpf: string | null; shift_id: string | null; journey_start: string | null; journey_end: string | null }[] = [];
  const recRows: (AejPunchRecord & { date: string })[] = [];
  for (const part of chunks(ids)) {
    const { data, error } = await supabase.from('employees').select('id, name, cpf, shift_id, journey_start, journey_end').in('id', part);
    if (error) throw error;
    empRows.push(...(data ?? []));
    recRows.push(...await fetchAllPages<AejPunchRecord & { date: string }>(async (offset, size) => {
      const { data: recs, count, error: recError } = await supabase.from('time_records')
        .select('employee_id, date, check_in, lunch_out, lunch_in, check_out, source', { count: 'exact' })
        .in('employee_id', part).gte('date', from).lte('date', to).order('date').order('id').range(offset, offset + size - 1);
      if (recError) throw recError;
      return { data: (recs ?? []) as (AejPunchRecord & { date: string })[], count };
    }));
  }

  const noCpf = empRows.filter(e => !e.cpf).map(e => e.name);
  if (noCpf.length) throw new Error(`Cadastre o CPF de: ${noCpf.join(', ')}.`);
  const employees: AejEmployee[] = empRows.sort((a, b) => a.name.localeCompare(b.name)).map(e => {
    const profile = getProfile(e.shift_id);
    return { id: e.id, cpf: e.cpf!, name: e.name, profile,
      start: profile.start ?? e.journey_start?.slice(0, 5) ?? '08:00', end: profile.end ?? e.journey_end?.slice(0, 5) ?? '18:00' };
  });
  // Só os registros dentro do vínculo com esta empresa.
  const records = recRows.filter(r => (windows.get(r.employee_id) ?? []).some(w => w.start <= r.date && (!w.end || w.end >= r.date)));
  const afdPunches = await fetchAfdRows(company.id, from, to, true);

  const text = buildAej({ employer, settings, employees, records, afdPunches, from, to, generatedAt: new Date() });
  return { filename: aejFileName(employer.id, from, to), bytes: toLatin1(text), employees: employees.length, records: records.length };
}
