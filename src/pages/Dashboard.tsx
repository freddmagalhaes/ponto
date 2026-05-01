import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../services/supabase';
import { format, endOfMonth, getDaysInMonth, setDate } from 'date-fns';
import { formatMinutesToTime } from '../utils/time';

export default function Dashboard() {
  const [month, setMonth] = useState<number>(new Date().getMonth());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [isDateInitialized, setIsDateInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    workedMinutes: 0,
    overtimeMinutes: 0,
    nightMinutes: 0,
    employeeCount: 0
  });
  const [chartData, setChartData] = useState<{ name: string, hours: number }[]>([]);

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  useEffect(() => {
    const fetchServerDate = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`, { method: 'GET' });
        const serverDateStr = res.headers.get('date');
        if (serverDateStr) {
          const serverDate = new Date(serverDateStr);
          setMonth(serverDate.getMonth());
          setYear(serverDate.getFullYear());
        }
      } catch (e) {
        console.warn("Falha ao buscar data do servidor, usando data local.");
      } finally {
        setIsDateInitialized(true);
      }
    };
    fetchServerDate();
  }, []);

  useEffect(() => {
    if (isDateInitialized) {
      fetchDashboardData();
    }
  }, [month, year, isDateInitialized]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const baseDate = new Date(year, month, 1);
      const firstDayStr = format(baseDate, 'yyyy-MM-dd');
      const lastDayStr = format(endOfMonth(baseDate), 'yyyy-MM-dd');

      // Fetch all time records for the current month based on the literal 'date'
      const { data: recordsData, error: recordsError } = await supabase
        .from('time_records')
        .select('*')
        .gte('date', firstDayStr)
        .lte('date', lastDayStr);

      if (recordsError) throw recordsError;

      // Fetch employee count
      const { count: empCount, error: empError } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      if (empError) throw empError;

      let totalWorked = 0;
      let totalOvertime = 0;
      let totalNight = 0;

      if (recordsData) {
        recordsData.forEach(record => {
          totalWorked += record.worked_minutes || 0;
          totalOvertime += record.overtime_minutes || 0;
          totalNight += record.night_minutes || 0;
        });
      }

      setStats({
        workedMinutes: totalWorked,
        overtimeMinutes: totalOvertime,
        nightMinutes: totalNight,
        employeeCount: empCount || 0
      });

      // Prepare Chart Data for the whole month
      const daysInMonth = getDaysInMonth(baseDate);
      const monthDays = Array.from({ length: daysInMonth }, (_, i) => {
        const d = setDate(baseDate, i + 1);
        return {
          dateStr: format(d, 'yyyy-MM-dd'),
          name: format(d, 'dd/MM'),
          hours: 0
        };
      });

      if (recordsData) {
        recordsData.forEach(record => {
          const day = monthDays.find(d => d.dateStr === record.date);
          if (day) {
            day.hours += (record.worked_minutes || 0) / 60;
          }
        });
      }

      // Round hours for chart
      monthDays.forEach(d => {
        d.hours = Math.round(d.hours * 10) / 10;
      });

      setChartData(monthDays);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
     return <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-muted rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
           <div className="h-24 bg-muted rounded-xl"></div>
           <div className="h-24 bg-muted rounded-xl"></div>
           <div className="h-24 bg-muted rounded-xl"></div>
           <div className="h-24 bg-muted rounded-xl"></div>
        </div>
        <div className="h-80 bg-muted rounded-xl"></div>
     </div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
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
            {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Horas Trabalhadas (Mês)</p>
          <p className="text-3xl font-bold text-foreground mt-2">{formatMinutesToTime(stats.workedMinutes)}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Horas Extras</p>
          <p className="text-3xl font-bold text-primary mt-2">{formatMinutesToTime(stats.overtimeMinutes)}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Adicional Noturno</p>
          <p className="text-3xl font-bold text-foreground mt-2">{formatMinutesToTime(stats.nightMinutes)}</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Funcionários Ativos</p>
          <p className="text-3xl font-bold text-foreground mt-2">{stats.employeeCount}</p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-border shadow-sm h-80">
        <h2 className="text-lg font-semibold mb-4">Horas Trabalhadas (Mensal)</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" style={{ textTransform: 'capitalize' }} />
            <YAxis stroke="var(--muted-foreground)" />
            <Tooltip 
              cursor={{fill: 'var(--muted)'}}
              contentStyle={{backgroundColor: 'var(--card)', borderColor: 'var(--border)'}} 
              formatter={(value: any) => [`${value}h`, 'Horas']}
            />
            <Bar dataKey="hours" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
