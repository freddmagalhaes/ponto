import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, Download } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useRuleProfiles } from '../hooks/useRuleProfiles';
import { exportAfd, exportAej } from '../services/compliance';
import type { CompanyRow, RepSettingsRow } from '../services/compliance';
import { saveBytes } from '../utils/download';
import { digits } from '../utils/afd';

const input = 'w-full bg-background border border-input rounded-lg px-3 py-2 text-sm';

export default function Compliance() {
  const { getProfile } = useRuleProfiles();
  const [settings, setSettings] = useState<RepSettingsRow | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loadError, setLoadError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [from, setFrom] = useState(format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'));
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'));

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      supabase.from('rep_settings').select('*').single(),
      supabase.from('companies').select('id, name, cnpj, service_location').order('name'),
    ]);
    if (s.error || c.error) { setLoadError('Não foi possível carregar. A migration 20261117140000 foi aplicada?'); return; }
    setSettings(s.data as RepSettingsRow);
    setCompanies(c.data as CompanyRow[]);
    setCompanyId(prev => prev || (c.data as CompanyRow[])[0]?.id || '');
  }, []);
  useEffect(() => { Promise.resolve().then(load); }, [load]);

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label); setMessage('');
    try { await job(); } catch (e) { setMessage((e as Error).message); } finally { setBusy(''); }
  };

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    run('settings', async () => {
      const { error } = await supabase.from('rep_settings').update({
        inpi_registration: digits(settings.inpi_registration) || null, developer_kind: settings.developer_kind,
        developer_id: digits(settings.developer_id) || null, developer_name: settings.developer_name?.trim() || null,
        developer_email: settings.developer_email?.trim() || null, ptrp_name: settings.ptrp_name, ptrp_version: settings.ptrp_version,
        enforce_afd: settings.enforce_afd,
      }).eq('id', true);
      if (error) throw error;
      setMessage('Dados do software salvos.');
    });
  };

  const saveCompany = (c: CompanyRow) => run(`company-${c.id}`, async () => {
    const { error } = await supabase.from('companies').update({ cnpj: digits(c.cnpj) || null, service_location: c.service_location?.trim() || null }).eq('id', c.id);
    if (error) throw error;
    setMessage(`Empresa ${c.name} salva.`);
  });

  const company = companies.find(c => c.id === companyId);
  const download = (kind: 'afd' | 'aej') => run(kind, async () => {
    if (!settings || !company) throw new Error('Selecione a empresa.');
    if (from > to) throw new Error('A data inicial deve ser anterior à final.');
    const result = kind === 'afd' ? await exportAfd(settings, company, from, to) : await exportAej(settings, company, from, to, getProfile);
    saveBytes(result.bytes, result.filename);
    setMessage(`${result.filename} gerado. Falta assinar o arquivo (.p7s, certificado ICP-Brasil) fora do sistema.`);
  });

  if (loadError) return <p role="alert" className="text-destructive">{loadError}</p>;
  if (!settings) return <Loader2 className="w-8 h-8 animate-spin text-primary" />;
  const set = (patch: Partial<RepSettingsRow>) => setSettings({ ...settings, ...patch });

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Conformidade (Portaria 671)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gera o AFD e o AEJ no leiaute oficial do MTE. Os arquivos saem sem assinatura digital, e o sistema só é um REP-P regular
          com registro do programa no INPI e Atestado Técnico e Termo de Responsabilidade do desenvolvedor.
        </p>
      </div>
      {message && <p role="status" className="rounded-lg border border-border bg-card p-3 text-sm">{message}</p>}

      <form onSubmit={saveSettings} className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Dados do software</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm font-medium">Registro no INPI
            <input className={input} inputMode="numeric" value={settings.inpi_registration ?? ''} onChange={e => set({ inpi_registration: e.target.value })} /></label>
          <label className="text-sm font-medium">Desenvolvedor: tipo
            <select className={input} value={settings.developer_kind ?? ''} onChange={e => set({ developer_kind: (Number(e.target.value) || null) as 1 | 2 | null })}>
              <option value="">Selecione</option><option value="1">CNPJ</option><option value="2">CPF</option></select></label>
          <label className="text-sm font-medium">Desenvolvedor: CNPJ/CPF
            <input className={input} inputMode="numeric" value={settings.developer_id ?? ''} onChange={e => set({ developer_id: e.target.value })} /></label>
          <label className="text-sm font-medium">Desenvolvedor: nome
            <input className={input} value={settings.developer_name ?? ''} onChange={e => set({ developer_name: e.target.value })} /></label>
          <label className="text-sm font-medium sm:col-span-2">Desenvolvedor: e-mail
            <input type="email" className={input} value={settings.developer_email ?? ''} onChange={e => set({ developer_email: e.target.value })} /></label>
          <label className="text-sm font-medium">Programa (PTRP): nome
            <input className={input} value={settings.ptrp_name} onChange={e => set({ ptrp_name: e.target.value })} /></label>
          <label className="text-sm font-medium">Programa: versão
            <input className={input} maxLength={8} value={settings.ptrp_version} onChange={e => set({ ptrp_version: e.target.value })} /></label>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={settings.enforce_afd} onChange={e => set({ enforce_afd: e.target.checked })} />
          <span>Bloquear a batida de quem não tem CPF ou vínculo com empresa (sem isso, a batida é aceita, mas não entra no AFD nem gera comprovante).</span>
        </label>
        <button disabled={busy === 'settings'} className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50">Salvar</button>
      </form>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Empresas (empregador)</h2>
        {companies.map(c => (
          <div key={c.id} className="grid sm:grid-cols-[1fr_1fr_2fr_auto] gap-2 items-end">
            <div className="text-sm font-medium pb-2">{c.name}</div>
            <label className="text-xs">CNPJ<input className={input} inputMode="numeric" value={c.cnpj ?? ''}
              onChange={e => setCompanies(list => list.map(x => x.id === c.id ? { ...x, cnpj: e.target.value } : x))} /></label>
            <label className="text-xs">Local de prestação de serviços<input className={input} value={c.service_location ?? ''}
              onChange={e => setCompanies(list => list.map(x => x.id === c.id ? { ...x, service_location: e.target.value } : x))} /></label>
            <button type="button" onClick={() => saveCompany(c)} className="rounded-lg border border-border px-3 py-2 text-sm">Salvar</button>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="font-semibold">Exportar arquivos</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="text-sm font-medium">Empresa
            <select className={input} value={companyId} onChange={e => setCompanyId(e.target.value)}>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="text-sm font-medium">De<input type="date" className={input} value={from} onChange={e => setFrom(e.target.value)} /></label>
          <label className="text-sm font-medium">Até<input type="date" className={input} value={to} onChange={e => setTo(e.target.value)} /></label>
        </div>
        <div className="flex flex-wrap gap-3">
          {(['afd', 'aej'] as const).map(k => (
            <button key={k} disabled={!!busy} onClick={() => download(k)}
              className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50">
              {busy === k ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Baixar {k.toUpperCase()}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
