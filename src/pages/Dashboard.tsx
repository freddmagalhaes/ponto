import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../services/supabase';
import { startOfMonth, format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatMinutesToTime } from '../utils/time';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    workedMinutes: 0,
    overtimeMinutes: 0,
    nightMinutes: 0,
    employeeCount: 0
  });
  const [chartData, setChartData] = useState<{ name: string, hours: number }[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const firstDayStr = format(startOfMonth(now), 'yyyy-MM-dd');

      // Fetch all time records for the current month based on the literal 'date'
      const { data: recordsData, error: recordsError } = await supabase
        .from('time_records')
        .select('*')
        .gte('date', firstDayStr);

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

      // Prepare Chart Data for the last 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(now, 6 - i);
        return {
          dateStr: format(d, 'yyyy-MM-dd'),
          name: format(d, 'EEE', { locale: ptBR }),
          hours: 0
        };
      });

      if (recordsData) {
        recordsData.forEach(record => {
          const day = last7Days.find(d => d.dateStr === record.date);
          if (day) {
            day.hours += (record.worked_minutes || 0) / 60;
          }
        });
      }

      // Round hours for chart
      last7Days.forEach(d => {
        d.hours = Math.round(d.hours * 10) / 10;
      });

      setChartData(last7Days);

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
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      
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
        <h2 className="text-lg font-semibold mb-4">Horas Trabalhadas (Últimos 7 dias)</h2>
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
