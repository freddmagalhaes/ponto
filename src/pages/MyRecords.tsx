import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/useAuth';
import { formatMinutesToTime, formatDateExtensive, formatTime, getPayrollPeriod } from '../utils/time';
import { useCompanies } from '../hooks/useCompanies';
import { Loader2, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ManualRecordActions from '../components/ManualRecordActions';
import { fetchAllPages } from '../utils/pagination';

interface TimeRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  lunch_out: string | null;
  lunch_in: string | null;
  worked_minutes: number;
  overtime_minutes: number;
  overtime_status: 'pending' | 'paid' | 'compensated';
  night_minutes: number;
  night_status: 'pending' | 'paid';
  source: 'manual' | 'imported';
  latitude_in: number | null;
  longitude_in: number | null;
  latitude_out: number | null;
  longitude_out: number | null;
  resolved_at: string | null;
  created_at: string;
}

export default function MyRecords() {
  const { user, employeeData } = useAuthStore();
  const { uniqueCompanies, getCompanyNameForDate, loading: companiesLoading } = useCompanies();
  const [saveNotice, setSaveNotice] = useState('');
  const [scope, setScope] = useState<'cycle' | 'all'>('cycle');
  const [loadError, setLoadError] = useState('');
  const requestId = useRef(0);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [isDateInitialized, setIsDateInitialized] = useState(false);

  useEffect(() => {
    const fetchServerDate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (!supabaseUrl) return;

        const res = await fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET' });
        const serverDateStr = res.headers.get('date');
        if (serverDateStr) {
          const serverDate = new Date(serverDateStr);
          if (!isNaN(serverDate.getTime())) {
            setMonth(serverDate.getMonth());
            setYear(serverDate.getFullYear());
          }
        }
      } catch {
        // Fallback silencioso para data local do dispositivo
      } finally {
        setIsDateInitialized(true);
      }
    };
    fetchServerDate();
  }, []);

  const fetchRecords = useCallback(async () => {
    if (!user?.id) return;
    const id = ++requestId.current;
    setLoading(true);
    setLoadError('');
    try {
      const period = getPayrollPeriod(year, month);
      const data = await fetchAllPages<TimeRecord>(async (offset, size) => {
        let query = supabase.from('time_records').select('*', { count: 'exact' }).eq('employee_id', user.id);
        if (scope === 'cycle') query = query.gte('date', period.startDateStr).lte('date', period.endDateStr);
        const { data, count, error } = await query.order('date', { ascending: false })
          .order('id', { ascending: false }).range(offset, offset + size - 1);
        if (error) throw error;
        return { data: (data ?? []) as TimeRecord[], count };
      });
      if (id === requestId.current) setRecords(data);
    } catch (e) {
      if (id === requestId.current) {
        setRecords([]);
        setLoadError('Não foi possível carregar os registros. Tente novamente.');
      }
      console.error(e);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [user, year, month, scope]);

  useEffect(() => {
    if (!isDateInitialized) return;
    
    if (user && user.id) {
      Promise.resolve().then(() => fetchRecords());
    } else {
      Promise.resolve().then(() => setLoading(false));
    }
  }, [user, month, year, isDateInitialized, fetchRecords]);

  const filteredRecords = records.filter(record => {
    if (selectedCompany === 'all') return true;
    return getCompanyNameForDate(record.date) === selectedCompany;
  });

  const handleExportPDF = () => {
    if (!filteredRecords || filteredRecords.length === 0) {
      alert("Não há registros para exportar neste período com o filtro selecionado.");
      return;
    }

    const doc = new jsPDF({ orientation: 'landscape' });
    const period = getPayrollPeriod(year, month);
    const formattedStart = format(period.startDate, 'dd/MM/yyyy');
    const formattedEnd = format(period.endDate, 'dd/MM/yyyy');
    
    // Determina o nome da empresa para o cabeçalho
    const allCompanyNames = uniqueCompanies.map(c => c.name).join(' / ');
    const companyHeader = selectedCompany === 'all'
      ? (allCompanyNames || 'Todas as Empresas')
      : selectedCompany;

    // Cabeçalho
    doc.setFontSize(18);
    doc.text(scope === 'all' ? 'Relatório de Ponto - Histórico Completo' : 'Relatório de Ponto - Ciclo de Fechamento', 14, 20);
    doc.setFontSize(12);
    doc.text(scope === 'all'
      ? `Período: ${formatDateExtensive(filteredRecords[filteredRecords.length - 1].date)} a ${formatDateExtensive(filteredRecords[0].date)}`
      : `Período: ${formattedStart} a ${formattedEnd}`, 14, 27);
    
    // Info adicional
    doc.setFontSize(11);
    doc.text(`Empresa: ${companyHeader}`, 14, 34);
    doc.text(`Funcionário: ${employeeData?.name || user?.user_metadata?.name || 'Não informado'}`, 14, 40);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 46);

    const tableColumn = ["Data", "Empresa", "Entrada", "Saída para almoço", "Retorno do almoço", "Saída", "Total", "Extras (Status)", "Noturno (Status)", "Origem", "Localização"];
    const tableRows: (string | null)[][] = [];

    filteredRecords.forEach(record => {
      const dateStr = formatDateExtensive(record.date);
      const company = getCompanyNameForDate(record.date);
      const checkIn = formatTime(record.check_in);
      const lunchOut = formatTime(record.lunch_out);
      const lunchIn = formatTime(record.lunch_in);
      const checkOut = formatTime(record.check_out);
      const total = formatMinutesToTime(record.worked_minutes || 0);
      
      // Overtime status display
      let overtimeStr = formatMinutesToTime(record.overtime_minutes || 0);
      if (record.overtime_minutes > 0) {
        const otStatus = record.overtime_status === 'paid' ? 'Pago' : record.overtime_status === 'compensated' ? 'Banco' : 'Pend.';
        overtimeStr += ` (${otStatus})`;
      }

      // Night status display
      let nightStr = formatMinutesToTime(record.night_minutes || 0);
      if (record.night_minutes > 0) {
        const ntStatus = record.night_status === 'paid' ? 'Pago' : 'Pend.';
        nightStr += ` (${ntStatus})`;
      }

      const source = record.source === 'imported' ? 'Importado' : 'Manual';
      const gpsStatus = record.latitude_in ? 'Sim' : 'Não';
      
      tableRows.push([dateStr, company, checkIn, lunchOut, lunchIn, checkOut, total, overtimeStr, nightStr, source, gpsStatus]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 52,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      margin: { bottom: 60 }
    });

    const finalY = (doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || 150;
    let currentY = finalY + 25;

    doc.setFontSize(10);
    
    // Local e Data
    doc.text("Local e Data: __________________________, _____ de ________________ de 20____", 14, currentY);

    currentY += 25;
    
    // Linha Funcionário
    doc.line(20, currentY, 90, currentY);
    doc.text("Assinatura do Funcionário", 35, currentY + 5);

    // Linha Responsável
    doc.line(120, currentY, 190, currentY);
    doc.text("Assinatura do Responsável", 135, currentY + 5);

    const companySlug = selectedCompany.replace(/\s+/g, '_');
    const filename = scope === 'all' ? `relatorio_ponto_${companySlug}_historico_completo.pdf` : `relatorio_ponto_${companySlug}_${String(month + 1).padStart(2, '0')}_${year}.pdf`;

    // Detecta se a aplicação está rodando dentro do WebView nativo do aplicativo mobile
    const isReactNative = typeof window !== 'undefined' && Boolean((window as unknown as { ReactNativeWebView?: { postMessage: (msg: string) => void } }).ReactNativeWebView);

    if (isReactNative) {
      const base64 = doc.output('datauristring');
      (window as unknown as { ReactNativeWebView: { postMessage: (msg: string) => void } }).ReactNativeWebView.postMessage(
        JSON.stringify({
          type: 'DOWNLOAD_PDF',
          filename,
          base64,
        })
      );
    } else {
      doc.save(filename);
    }
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const period = getPayrollPeriod(year, month);
  const formattedStart = format(period.startDate, 'dd/MM/yyyy');
  const formattedEnd = format(period.endDate, 'dd/MM/yyyy');

  const changeCycle = (offset: number) => {
    const date = new Date(year, month + offset, 1);
    setMonth(date.getMonth());
    setYear(date.getFullYear());
  };

  return (
    <div className="min-w-0 space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meus Registros</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {scope === 'all' ? 'Todo o histórico de ponto, do mais recente ao mais antigo.' :
            <>Ciclo de fechamento: <strong className="text-foreground">{formattedStart} a {formattedEnd}</strong> (dia 20 ao dia 19).</>}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium">Visualização
          <select aria-label="Visualização" value={scope} onChange={e => setScope(e.target.value as 'cycle' | 'all')}
            className="max-w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="cycle">Ciclo de fechamento</option>
            <option value="all">Todo o histórico</option>
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-medium">Empresa
          <select aria-label="Empresa" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)} disabled={companiesLoading}
            className="max-w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
            <option value="all">Todas as Empresas</option>
            {uniqueCompanies.map(company => <option key={company.id} value={company.name}>{company.name}</option>)}
          </select>
        </label>
        {scope === 'cycle' && <div className="flex max-w-full flex-wrap items-center gap-2">
          <button type="button" onClick={() => changeCycle(-1)} aria-label="Ciclo anterior" title="Ciclo anterior"
            className="rounded-md border border-border p-2"><ChevronLeft className="h-5 w-5" /></button>
          <select aria-label="Mês do ciclo" value={month} onChange={e => setMonth(Number(e.target.value))}
            className="min-w-0 rounded-md border border-border bg-background px-2 py-2 text-sm">
            {months.map((name, i) => <option key={name} value={i}>{name}</option>)}
          </select>
          <select aria-label="Ano do ciclo" value={year} onChange={e => setYear(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm">
            {[year - 1, year, year + 1].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
          <button type="button" onClick={() => changeCycle(1)} aria-label="Próximo ciclo" title="Próximo ciclo"
            className="rounded-md border border-border p-2"><ChevronRight className="h-5 w-5" /></button>
        </div>}
        <button type="button" onClick={handleExportPDF} disabled={loading || !filteredRecords.length || !!loadError}
          className="rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium disabled:opacity-50">Exportar PDF</button>
      </div>
      {saveNotice && <p role="status" className="text-sm text-primary">{saveNotice}</p>}
      {loadError ? <div role="alert" className="text-sm text-destructive">{loadError}
        <button onClick={() => fetchRecords()} className="ml-2 underline">Tentar novamente</button>
      </div> : loading ? <div role="status" className="flex items-center justify-center gap-2 py-12 text-sm">
        <Loader2 className="h-6 w-6 animate-spin text-primary" /> Carregando registros…
      </div> : <>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <p aria-live="polite">{filteredRecords.length} {filteredRecords.length === 1 ? 'registro' : 'registros'} {scope === 'cycle' ? 'neste ciclo' : 'no histórico'}{selectedCompany !== 'all' ? ` · ${selectedCompany}` : ''}.</p>
          {scope === 'cycle' && <button onClick={() => setScope('all')} className="text-primary underline">Ver todo o histórico</button>}
        </div>
        {filteredRecords.length === 0 ? <p className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Nenhum registro encontrado para os filtros selecionados.
        </p> : <div className="space-y-3">
          {filteredRecords.map(record => {
            const date = new Date(`${record.date}T12:00:00`);
            const weekend = date.getDay() === 0 || date.getDay() === 6;
            const coordinates = [
              { label: 'GPS entrada', lat: record.latitude_in, lng: record.longitude_in },
              { label: 'GPS saída', lat: record.latitude_out, lng: record.longitude_out },
            ].filter(point => typeof point.lat === 'number' && Number.isFinite(point.lat) && typeof point.lng === 'number' && Number.isFinite(point.lng));
            return <article key={record.id} aria-label={`Registro de ${formatDateExtensive(record.date)}`}
              className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)]">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h2 className="font-semibold text-base">{formatDateExtensive(record.date)}</h2>
                    <span className="text-xs text-muted-foreground">{format(date, 'EEEE', { locale: ptBR })}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="max-w-full break-words rounded bg-secondary px-2 py-1">{getCompanyNameForDate(record.date)}</span>
                    <span className="rounded bg-primary/10 text-primary px-2 py-1">{record.source === 'imported' ? 'Importado' : 'Manual'}</span>
                    {weekend && <span className="rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-1">Fim de semana</span>}
                  </div>
                </div>
                <dl className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
                  {[['Entrada', record.check_in], ['Saída para almoço', record.lunch_out],
                    ['Retorno do almoço', record.lunch_in], ['Saída final', record.check_out]].map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-lg bg-secondary/40 px-3 py-2">
                      <dt className="text-xs text-muted-foreground leading-4 min-h-8">{label}</dt>
                      <dd className="text-base font-semibold tabular-nums">{formatTime(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="mt-3 flex min-w-0 flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                  <div><dt className="text-muted-foreground">Trabalhadas</dt><dd className="font-semibold text-primary text-sm">{formatMinutesToTime(record.worked_minutes || 0)}</dd></div>
                  <div><dt className="text-muted-foreground">Extras</dt><dd className="font-medium">{formatMinutesToTime(record.overtime_minutes || 0)}{record.overtime_minutes > 0 ? ` · ${record.overtime_status === 'paid' ? 'Pago' : record.overtime_status === 'compensated' ? 'Banco' : 'Pendente'}` : ''}</dd></div>
                  <div><dt className="text-muted-foreground">Noturnas</dt><dd className="font-medium">{formatMinutesToTime(record.night_minutes || 0)}{record.night_minutes > 0 ? ` · ${record.night_status === 'paid' ? 'Pago' : 'Pendente'}` : ''}</dd></div>
                </dl>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {coordinates.map(point => <a key={point.label} href={`https://www.google.com/maps?q=${point.lat},${point.lng}`}
                    target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <MapPin className="w-3.5 h-3.5" /> {point.label}
                  </a>)}
                  {!coordinates.length && <span className="text-muted-foreground">Sem GPS</span>}
                  <ManualRecordActions record={record} onSaved={async () => {
                    setSaveNotice('Registro corrigido. Se a data mudou para outro período ou empresa, ajuste os filtros para encontrá-lo.');
                    await fetchRecords();
                  }} />
                </div>
              </div>
            </article>;
          })}
        </div>}
      </>}
    </div>
  );
}
