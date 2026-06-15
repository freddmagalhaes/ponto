import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/useAuth';
import { formatMinutesToTime, formatDateExtensive, formatTime } from '../utils/time';
import { Loader2 } from 'lucide-react';
import { format, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function MyRecords() {
  const { user, employeeData } = useAuthStore();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [isDateInitialized, setIsDateInitialized] = useState(false);

  useEffect(() => {
    const fetchServerDate = async () => {
      try {
        // Faz uma requisição leve para pegar o cabeçalho 'Date' do servidor
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`, { method: 'GET' });
        const serverDateStr = res.headers.get('date');
        if (serverDateStr) {
          const serverDate = new Date(serverDateStr);
          setMonth(serverDate.getMonth());
          setYear(serverDate.getFullYear());
        }
      } catch {
        console.warn("Falha ao buscar data do servidor, usando data local.");
      } finally {
        setIsDateInitialized(true);
      }
    };
    fetchServerDate();
  }, []);

  useEffect(() => {
    if (!isDateInitialized) return;
    
    if (user && !user.id.startsWith('mock')) {
      fetchRecords();
    } else {
      setLoading(false);
    }
  }, [user, month, year, isDateInitialized]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      
      const baseDate = new Date(year, month, 1);
      const startDateStr = format(baseDate, 'yyyy-MM-dd');
      const endDateStr = format(endOfMonth(baseDate), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('employee_id', user?.id)
        .gte('date', startDateStr)
        .lte('date', endDateStr)
        .order('date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!records || records.length === 0) {
      alert("Não há registros para exportar neste mês.");
      return;
    }

    const doc = new jsPDF();
    const monthName = months[month];
    
    // Cabeçalho
    doc.setFontSize(18);
    doc.text(`Relatório de Ponto - ${monthName} de ${year}`, 14, 22);
    
    // Info adicional
    doc.setFontSize(11);
    doc.text(`Empresa: PontoApp`, 14, 30);
    doc.text(`Funcionário: ${employeeData?.name || user?.user_metadata?.name || 'Não informado'}`, 14, 36);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 14, 42);

    const tableColumn = ["Data", "Entrada", "Saída", "Total", "Extra / Noturno", "Origem"];
    const tableRows: any[] = [];

    records.forEach(record => {
      const dateStr = formatDateExtensive(record.date);
      const checkIn = formatTime(record.check_in);
      const checkOut = formatTime(record.check_out);
      const total = formatMinutesToTime(record.worked_minutes || 0);
      const extraNight = `${formatMinutesToTime(record.overtime_minutes || 0)} / ${formatMinutesToTime(record.night_minutes || 0)}`;
      const source = record.source === 'imported' ? 'Importado' : 'Manual';
      
      tableRows.push([dateStr, checkIn, checkOut, total, extraNight, source]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 48,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      margin: { bottom: 60 } // Garante espaço no rodapé para que a assinatura não fique sozinha numa página
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
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

    doc.save(`relatorio_ponto_${String(month + 1).padStart(2, '0')}_${year}.pdf`);
  };

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Meus Registros</h1>
        <div className="flex gap-2">
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
                <th className="px-6 py-3 font-medium">Entrada</th>
                <th className="px-6 py-3 font-medium">Saída</th>
                <th className="px-6 py-3 font-medium">Total</th>
                <th className="px-6 py-3 font-medium">Extra / Noturno</th>
                <th className="px-6 py-3 font-medium">Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                    Nenhum registro encontrado para este período.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-muted/50">
                    <td className="px-6 py-4 font-medium text-foreground">
                      {formatDateExtensive(record.date)}
                    </td>
                    <td className="px-6 py-4">{formatTime(record.check_in)}</td>
                    <td className="px-6 py-4">{formatTime(record.check_out)}</td>
                    <td className="px-6 py-4 font-medium text-primary">
                      {formatMinutesToTime(record.worked_minutes || 0)}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <span className={record.overtime_minutes > 0 ? "text-primary font-medium" : ""}>
                        {formatMinutesToTime(record.overtime_minutes || 0)}
                      </span>
                      {" / "}
                      {formatMinutesToTime(record.night_minutes || 0)}
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
