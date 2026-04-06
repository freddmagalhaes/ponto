import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/useAuth';
import { formatMinutesToTime, formatDateExtensive, formatTime } from '../utils/time';
import { Loader2 } from 'lucide-react';
import { parseISO, format, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function MyRecords() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().getMonth());
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    if (user && !user.id.startsWith('mock')) {
      fetchRecords();
    } else {
      setLoading(false);
    }
  }, [user, month, year]);

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
    alert("Função de exportar PDF em desenvolvimento.");
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
