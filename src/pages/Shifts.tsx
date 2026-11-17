import { useState } from 'react';
import { Loader2, Plus, Pencil } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useRuleProfiles } from '../hooks/useRuleProfiles';
import type { WorkShiftRow } from '../utils/rules';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const EMPTY: Omit<WorkShiftRow, 'id'> & { id?: string } = {
  name: '', rule_mode: 'weekly', start_time: '', end_time: '', lunch_minutes: 60, work_days: [1, 2, 3, 4, 5],
  daily_limit_minutes: 480, weekly_limit_minutes: 2640, night_reduced: true, night_prorogation: true, is_active: true,
};
const fmt = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`;

export default function Shifts() {
  const { rows, loading, reload } = useRuleProfiles();
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError('');
    const { id, ...values } = form;
    const payload = { ...values, name: values.name.trim(), start_time: values.start_time || null, end_time: values.end_time || null };
    const { error: dbError } = id
      ? await supabase.from('work_shifts').update(payload).eq('id', id)
      : await supabase.from('work_shifts').insert(payload);
    setSaving(false);
    if (dbError) { setError(dbError.message); return; }
    setForm(null);
    await reload();
  };

  const toggleDay = (d: number) => setForm(f => f && ({
    ...f, work_days: f.work_days.includes(d) ? f.work_days.filter(x => x !== d) : [...f.work_days, d].sort(),
  }));
  const input = 'w-full bg-background border border-input rounded-lg px-3 py-2 text-sm';

  if (loading) return <Loader2 className="w-8 h-8 animate-spin text-primary" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Regras de Jornada</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cada funcionário usa uma regra. Sem regra definida, vale o padrão (8h diárias, noturno 22h–5h).
          </p>
        </div>
        <button onClick={() => { setError(''); setForm({ ...EMPTY }); }}
          className="shrink-0 flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nova regra
        </button>
      </div>

      {!rows.length && <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Nenhuma regra cadastrada (ou a migration <code>20261117120000_work_rule_profiles.sql</code> ainda não foi aplicada).
      </p>}

      <div className="grid gap-3">
        {rows.map(r => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4">
            <div className="space-y-1 text-sm">
              <div className="font-semibold">{r.name}{r.is_active === false && <span className="ml-2 text-xs text-muted-foreground">(inativa)</span>}</div>
              <div className="text-muted-foreground">
                {r.start_time && r.end_time ? `${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)} · ` : ''}
                almoço {r.lunch_minutes} min · {r.work_days.map(d => DAYS[d]).join(', ')}
              </div>
              <div className="text-muted-foreground">
                {r.rule_mode === 'weekly' ? `Extra acima de ${fmt(r.weekly_limit_minutes)}/semana; dia não escalado = extra` : `Extra acima de ${fmt(r.daily_limit_minutes)}/dia`}
                {' · '}noturno{r.night_reduced ? ' com hora reduzida' : ''}{r.night_prorogation ? ' e prorrogação após 5h' : ''}
              </div>
            </div>
            <button onClick={() => { setError(''); setForm({ ...r }); }} aria-label={`Editar ${r.name}`} className="p-2 text-muted-foreground hover:text-foreground">
              <Pencil className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={save} className="bg-card w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl shadow-lg border border-border p-6 space-y-4">
            <h2 className="text-xl font-bold">{form.id ? 'Editar regra' : 'Nova regra'}</h2>
            <label className="block text-sm font-medium">Nome
              <input required className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="block text-sm font-medium">Como apurar horas extras
              <select className={input} value={form.rule_mode} onChange={e => setForm({ ...form, rule_mode: e.target.value as 'daily' | 'weekly' })}>
                <option value="weekly">Semanal (carga semanal + dias escalados)</option>
                <option value="daily">Diária (limite por dia)</option>
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium">Início (informativo)
                <input type="time" className={input} value={form.start_time ?? ''} onChange={e => setForm({ ...form, start_time: e.target.value })} />
              </label>
              <label className="block text-sm font-medium">Fim (informativo)
                <input type="time" className={input} value={form.end_time ?? ''} onChange={e => setForm({ ...form, end_time: e.target.value })} />
              </label>
              <label className="block text-sm font-medium">Almoço (min)
                <input type="number" min={0} className={input} value={form.lunch_minutes} onChange={e => setForm({ ...form, lunch_minutes: Number(e.target.value) })} />
              </label>
              {form.rule_mode === 'daily' ? (
                <label className="block text-sm font-medium">Limite diário (horas)
                  <input type="number" min={1} step="0.01" className={input} value={form.daily_limit_minutes / 60}
                    onChange={e => setForm({ ...form, daily_limit_minutes: Math.round(Number(e.target.value) * 60) })} />
                </label>
              ) : (
                <label className="block text-sm font-medium">Carga semanal (horas)
                  <input type="number" min={1} step="0.01" className={input} value={form.weekly_limit_minutes / 60}
                    onChange={e => setForm({ ...form, weekly_limit_minutes: Math.round(Number(e.target.value) * 60) })} />
                </label>
              )}
            </div>
            {form.rule_mode === 'weekly' && (
              <fieldset className="text-sm">
                <legend className="font-medium mb-1">Dias escalados (os demais dias viram extra)</legend>
                <div className="flex flex-wrap gap-3">
                  {DAYS.map((d, i) => (
                    <label key={d} className="flex items-center gap-1">
                      <input type="checkbox" checked={form.work_days.includes(i)} onChange={() => toggleDay(i)} /> {d}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.night_reduced} onChange={e => setForm({ ...form, night_reduced: e.target.checked })} /> Hora noturna reduzida (52min30s)</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.night_prorogation} onChange={e => setForm({ ...form, night_prorogation: e.target.checked })} /> Prorrogação do noturno após as 5h</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active !== false} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Regra ativa</label>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setForm(null)} className="flex-1 rounded-lg border border-border py-2">Cancelar</button>
              <button disabled={saving} type="submit" className="flex-1 rounded-lg bg-primary text-primary-foreground py-2 font-medium disabled:opacity-50">
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
