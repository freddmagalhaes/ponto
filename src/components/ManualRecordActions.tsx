import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';
import { Pencil, History, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { saveTimeRecord } from '../services/timeRecords';
import type { TimeRecord } from '../services/timeRecords';
import { calculateDailyTimes, formatDateExtensive, formatMinutesToTime, formatTime, manualTimes } from '../utils/time';

type ManualRecord = TimeRecord & { source: 'manual' | 'imported' };
type Revision = { id: string; changed_at: string; before_record: TimeRecord; after_record: TimeRecord };

export default function ManualRecordActions({ record, onSaved }: { record: ManualRecord; onSaved: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [mode, setMode] = useState<'edit' | 'history' | null>(null);
  const [form, setForm] = useState({ date: '', checkIn: '', lunchOut: '', lunchIn: '', checkOut: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (mode) dialog.current?.showModal();
    else dialog.current?.close();
  }, [mode]);

  useEffect(() => {
    if (mode !== 'history') return;
    let cancelled = false;
    supabase.from('time_record_revisions')
      .select('id,changed_at,before_record,after_record').eq('time_record_id', record.id)
      .order('changed_at', { ascending: false }).then(({ data, error: fetchError }) => {
        if (cancelled) return;
        setHistoryLoading(false);
        if (fetchError) setError('Não foi possível consultar as alterações. Tente novamente.');
        else setRevisions((data ?? []) as Revision[]);
      });
    return () => { cancelled = true; };
  }, [mode, record.id]);

  const openEdit = () => {
    const clock = (value: string | null) => value ? formatTime(value) : '';
    setForm({ date: record.date, checkIn: clock(record.check_in), lunchOut: clock(record.lunch_out),
      lunchIn: clock(record.lunch_in), checkOut: clock(record.check_out) });
    setError('');
    setMode('edit');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try {
      if (form.date > format(new Date(), 'yyyy-MM-dd')) throw new Error('Não é permitido registrar ponto em datas futuras.');
      const punches = manualTimes(form.date, form.checkIn, form.checkOut, form.lunchOut, form.lunchIn, true);
      const times = calculateDailyTimes(punches);
      await saveTimeRecord({ date: form.date, check_in: punches.checkIn, check_out: punches.checkOut,
        lunch_out: punches.lunchOut, lunch_in: punches.lunchIn,
        worked_minutes: times.workedMinutes, overtime_minutes: times.overtimeMinutes,
        night_minutes: times.nightMinutes }, record, true);
      setMode(null);
      await onSaved();
    } catch (err) {
      const failure = err as { code?: string; message?: string };
      setError(failure.code === '23505'
        ? 'Já existe um registro nesta data. Escolha outra data ou edite o registro existente.'
        : failure.message || 'Não foi possível salvar a correção. Tente novamente.');
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };

  if (record.source !== 'manual') return null;

  return <>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <button type="button" onClick={openEdit} className="inline-flex items-center gap-1 text-primary hover:underline">
        <Pencil className="h-4 w-4" /> Editar
      </button>
      <button type="button" onClick={() => { setError(''); setRevisions([]); setHistoryLoading(true); setMode('history'); }}
        className="inline-flex items-center gap-1 text-muted-foreground hover:underline">
        <History className="h-4 w-4" /> Alterações
      </button>
    </div>
    {createPortal(<dialog ref={dialog} onCancel={event => { if (saving) event.preventDefault(); else setMode(null); }}
      aria-label={mode === 'history' ? 'Alterações do registro' : 'Corrigir registro manual'}
      className="m-auto whitespace-normal text-left w-[calc(100vw-2rem)] max-w-xl max-h-[90dvh] overflow-y-auto rounded-xl border border-border bg-card text-card-foreground p-6 shadow-lg backdrop:bg-black/50">
      <h2 className="text-lg font-semibold mb-4">{mode === 'history' ? 'Alterações do registro' : 'Corrigir registro manual'}</h2>
      {error && <p role="alert" className="text-sm text-destructive mb-4">{error}</p>}
      {mode === 'edit' ? <form onSubmit={save} className="space-y-4">
        <fieldset disabled={saving} className="min-w-0">
          <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="sm:col-span-2 flex min-w-0 flex-col text-sm font-medium">Data
            <input type="date" required max={format(new Date(), 'yyyy-MM-dd')} value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="block mt-1.5 min-w-0 w-full rounded-md border border-input bg-background px-3 py-2" />
          </label>
          {([{ key: 'checkIn', label: 'Entrada' }, { key: 'lunchOut', label: 'Saída para almoço' },
            { key: 'lunchIn', label: 'Retorno do almoço' }, { key: 'checkOut', label: 'Saída final' }] as const).map(field => (
            <label key={field.key} className="flex min-w-0 flex-col text-sm font-medium">{field.label}
              <input type="time" required={field.key === 'checkIn'} value={form[field.key]}
                onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                className="block mt-1.5 min-w-0 w-full rounded-md border border-input bg-background px-3 py-2" />
            </label>
          ))}
          </div>
        </fieldset>
        <p className="text-xs text-muted-foreground">Sem almoço, deixe os dois campos vazios. Se a jornada ainda estiver em andamento, deixe a saída final vazia. A correção mantém o mesmo registro e guarda os valores anteriores.</p>
        <div className="flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={() => setMode(null)} className="rounded-md border border-border px-4 py-2">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded-md bg-primary text-primary-foreground px-4 py-2 inline-flex items-center gap-2 disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar correção
          </button>
        </div>
      </form> : <>
        {historyLoading ? <Loader2 aria-label="Carregando alterações" className="w-6 h-6 animate-spin" /> :
          revisions.length === 0 && !error ? <p className="text-sm text-muted-foreground">Nenhuma alteração registrada desde a ativação deste histórico.</p> :
          <div className="space-y-4">{revisions.map(revision => <div key={revision.id} className="border border-border rounded-md p-3 space-y-2">
            <p className="font-medium text-sm">{format(new Date(revision.changed_at), 'dd/MM/yyyy HH:mm:ss')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {(['before_record', 'after_record'] as const).map(key => <div key={key}>
                <p className="font-semibold">{key === 'before_record' ? 'Antes' : 'Depois'}</p>
                <p>{formatDateExtensive(revision[key].date)}</p>
                <p>Entrada: {formatTime(revision[key].check_in)}</p>
                <p>Almoço: {formatTime(revision[key].lunch_out)} – {formatTime(revision[key].lunch_in)}</p>
                <p>Saída: {formatTime(revision[key].check_out)}</p>
                <p>Total: {formatMinutesToTime(revision[key].worked_minutes || 0)}</p>
              </div>)}
            </div>
          </div>)}</div>}
        <button type="button" onClick={() => setMode(null)} className="mt-4 rounded-md border border-border px-4 py-2">Fechar</button>
      </>}
    </dialog>, document.body)}
  </>;
}
