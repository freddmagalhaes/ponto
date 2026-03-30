import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const mockData = [
    { name: 'Seg', hours: 8.5 },
    { name: 'Ter', hours: 7.8 },
    { name: 'Qua', hours: 9.2 },
    { name: 'Qui', hours: 8.0 },
    { name: 'Sex', hours: 8.1 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Horas Trabalhadas</p>
          <p className="text-3xl font-bold text-foreground mt-2">164h</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Horas Extras</p>
          <p className="text-3xl font-bold text-primary mt-2">12h</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Adicional Noturno</p>
          <p className="text-3xl font-bold text-foreground mt-2">4h</p>
        </div>
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <p className="text-sm font-medium text-muted-foreground">Funcionários</p>
          <p className="text-3xl font-bold text-foreground mt-2">24</p>
        </div>
      </div>

      <div className="bg-card p-6 rounded-xl border border-border shadow-sm h-80">
        <h2 className="text-lg font-semibold mb-4">Horas por Dia</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={mockData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="name" stroke="var(--muted-foreground)" />
            <YAxis stroke="var(--muted-foreground)" />
            <Tooltip 
              cursor={{fill: 'var(--muted)'}}
              contentStyle={{backgroundColor: 'var(--card)', borderColor: 'var(--border)'}} 
            />
            <Bar dataKey="hours" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
