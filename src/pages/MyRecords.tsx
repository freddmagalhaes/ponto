import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/useAuth';
import { formatMinutesToTime, formatDateExtensive, formatTime, getPayrollPeriod } from '../utils/time';
import { useCompanies } from '../hooks/useCompanies';
import { Loader2, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TimeRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string | null;
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
    try {
      setLoading(true);
      
      const period = getPayrollPeriod(year, month);

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('employee_id', user?.id)
        .gte('date', period.startDateStr)
        .lte('date', period.endDateStr)
        .order('date', { ascending: false });

      if (error) throw error;
      setRecords((data as unknown as TimeRecord[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, year, month]);

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

    const doc = new jsPDF();
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
    doc.text(`Relatório de Ponto - Ciclo de Fechamento`, 14, 20);
    doc.setFontSize(12);
    doc.text(`Período: ${formattedStart} a ${formattedEnd}`, 14, 27);
    
    // Info adicional
    doc.setFontSize(11);
    doc.text(`Empresa: ${companyHeader}`, 14, 34);
    doc.text(`Funcionário: ${employeeData?.name || user?.user_metadata?.name || 'Não informado'}`, 14, 40);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 46);

    const tableColumn = ["Data", "Empresa", "Entrada", "Saída", "Total", "Extras (Status)", "Noturno (Status)", "Origem", "Localização"];
    const tableRows: (string | null)[][] = [];

    filteredRecords.forEach(record => {
      const dateStr = formatDateExtensive(record.date);
      const company = getCompanyNameForDate(record.date);
      const checkIn = formatTime(record.check_in);
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
      
      tableRows.push([dateStr, company, checkIn, checkOut, total, overtimeStr, nightStr, source, gpsStatus]);
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
    doc.save(`relatorio_ponto_${companySlug}_${String(month + 1).padStart(2, '0')}_${year}.pdf`);
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const period = getPayrollPeriod(year, month);
  const formattedStart = format(period.startDate, 'dd/MM/yyyy');
  const formattedEnd = format(period.endDate, 'dd/MM/yyyy');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Registros</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Período: <span className="font-semibold text-foreground">{formattedStart}</span> a <span className="font-semibold text-foreground">{formattedEnd}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select 
            value={selectedCompany} 
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm focus:ring-primary focus:border-primary font-medium"
            disabled={companiesLoading}
          >
            <option value="all">Todas as Empresas</option>
            {uniqueCompanies.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <select 
            value={month} 
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm focus:ring-primary focus:border-primary"
          >
            {months.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm focus:ring-primary focus:border-primary"
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button 
            onClick={handleExportPDF}
            className="bg-secondary text-secondary-foreground border border-border px-4 py-2 rounded-md font-medium text-sm shadow-sm hover:bg-secondary/80"
          >
            Exportar PDF
          </button>
        </div>
      </div>
      
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-muted-foreground uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">Data</th>
                <th className="px-6 py-3 font-medium">Empresa</th>
                <th className="px-6 py-3 font-medium">Entrada</th>
                <th className="px-6 py-3 font-medium">Saída</th>
                <th className="px-6 py-3 font-medium">Total</th>
                <th className="px-6 py-3 font-medium">Extra / Noturno</th>
                <th className="px-6 py-3 font-medium">Origem</th>
                <th className="px-6 py-3 font-medium">Localização</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum registro encontrado para este período com o filtro selecionado.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                      {formatDateExtensive(record.date)}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const companyName = getCompanyNameForDate(record.date);
                        const isActive = uniqueCompanies.find(c => !c.name.includes('DVL') && c.name === companyName);
                        return (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          }`}>
                            {companyName}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">{formatTime(record.check_in)}</td>
                    <td className="px-6 py-4">{formatTime(record.check_out)}</td>
                    <td className="px-6 py-4 font-medium text-primary">
                      {formatMinutesToTime(record.worked_minutes || 0)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        {record.overtime_minutes > 0 && (
                          <span className="flex items-center gap-1.5">
                            <span className="font-semibold text-primary">{formatMinutesToTime(record.overtime_minutes)}</span>
                            {record.overtime_status === 'paid' ? (
                              <span className="px-1.5 py-0.5 bg-green-500/10 text-green-600 border border-green-500/20 rounded text-[10px] font-bold">Pago</span>
                            ) : record.overtime_status === 'compensated' ? (
                              <span className="px-1.5 py-0.5 bg-teal-500/10 text-teal-600 border border-teal-500/20 rounded text-[10px] font-bold">Banco</span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded text-[10px] font-bold">Pendente</span>
                            )}
                          </span>
                        )}
                        {record.night_minutes > 0 && (
                          <span className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground">{formatMinutesToTime(record.night_minutes)} Not.</span>
                            {record.night_status === 'paid' ? (
                              <span className="px-1.5 py-0.5 bg-green-500/10 text-green-600 border border-green-500/20 rounded text-[10px] font-bold">Pago</span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded text-[10px] font-bold">Pendente</span>
                            )}
                          </span>
                        )}
                        {(!record.overtime_minutes && !record.night_minutes) && (
                          <span className="text-xs text-muted-foreground/60 font-normal">--</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {record.source === 'imported' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                          Importado
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          Manual
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {typeof record.latitude_in === 'number' && typeof record.longitude_in === 'number' && Number.isFinite(record.latitude_in) && Number.isFinite(record.longitude_in) && (
                          <a 
                            href={`https://www.google.com/maps?q=${record.latitude_in},${record.longitude_in}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80 flex items-center gap-0.5 font-medium"
                            title="Localização de Entrada"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="text-xs">Ent.</span>
                          </a>
                        )}
                        {typeof record.latitude_out === 'number' && typeof record.longitude_out === 'number' && Number.isFinite(record.latitude_out) && Number.isFinite(record.longitude_out) && (
                          <a 
                            href={`https://www.google.com/maps?q=${record.latitude_out},${record.longitude_out}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-destructive hover:text-destructive/80 flex items-center gap-0.5 font-medium"
                            title="Localização de Saída"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="text-xs">Saí.</span>
                          </a>
                        )}
                        {!Number.isFinite(record.latitude_in) && !Number.isFinite(record.latitude_out) && (
                          <span className="text-xs text-muted-foreground/60 font-normal">Sem GPS</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
