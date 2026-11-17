import { useCallback, useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';

interface Holiday { id: string; date: string; name: string; scope: 'national' | 'state' | 'municipal'; source: string | null }
const SCOPES = { national: 'Nacional', state: 'Estadual', municipal: 'Municipal' } as const;
const input = 'w-full bg-background border border-input rounded-lg px-3 py-2 text-sm';

export default function Holidays() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [rows, setRows] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ date: '', name: '', scope: 'national' as Holiday['scope'], source: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: dbError } = await supabase.from('holidays').select('*')
      .gte('date', `${year}-01-01`).lte('date', `${year}-12-31`).order('date');
    if (dbError) setError('Não foi possível carregar os feriados. A migration 20261117120000 foi aplicada?');
    else { setRows(data as Holiday[]); setError(''); }
    setLoading(false);
  }, [year]);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error: dbError } = await supabase.from('holidays').insert({
      date: form.date, name: form.name.trim(), scope: form.scope, source: form.source.trim() || null });
    if (dbError) { setError(dbError.code === '23505' ? 'Esse feriado já está cadastrado nessa data.' : dbError.message); return; }
    setForm({ ...form, date: '', name: '' });
    setError('');
    await load();
  };

  const remove = async (h: Holiday) => {
    if (!confirm(`Remover "${h.name}" (${h.date.split('-').reverse().join('/')})?`)) return;
    const { error: dbError } = await supabase.from('holidays').delete().eq('id', h.id);
    if (dbError) setError(dbError.message); else await load();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feriados</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Trabalho em feriado entra como extra de 100% nas regras semanais. Cadastre apenas os feriados que valem para a unidade
          (nacionais, de Minas Gerais e de São José da Lapa), a partir de fonte oficial; informe a fonte para auditoria.
        </p>
      </div>

      <form onSubmit={add} className="rounded-xl border border-border bg-card p-4 grid sm:grid-cols-[auto_1fr_auto_1fr_auto] gap-3 items-end">
        <label className="text-xs font-medium">Data<input required type="date" className={input} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
        <label className="text-xs font-medium">Nome<input required className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label className="text-xs font-medium">Abrangência
          <select className={input} value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value as Holiday['scope'] })}>
            {Object.entries(SCOPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="text-xs font-medium">Fonte (lei/decreto)<input className={input} value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} /></label>
        <button className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium">Adicionar</button>
      </form>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <button onClick={() => setYear(y => y - 1)} className="rounded-lg border border-border px-3 py-1">‹</button>
        <strong>{year}</strong>
        <button onClick={() => setYear(y => y + 1)} className="rounded-lg border border-border px-3 py-1">›</button>
      </div>

      {loading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : rows.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">Nenhum feriado cadastrado em {year}. Sem cadastro, o sistema trata a data como dia comum.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map(h => (
            <li key={h.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <span className="font-medium">{h.date.split('-').reverse().join('/')}</span> · {h.name}
                <span className="ml-2 text-xs text-muted-foreground">{SCOPES[h.scope]}{h.source ? ` · ${h.source}` : ''}</span>
              </div>
              <button onClick={() => remove(h)} aria-label={`Remover ${h.name}`} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
