export default function MyRecords() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Meus Registros</h1>
        <div className="flex gap-2">
          <select className="bg-card border border-border rounded-md px-3 py-2 text-sm focus:ring-primary focus:border-primary">
            <option>Março 2026</option>
            <option>Fevereiro 2026</option>
          </select>
          <button className="bg-secondary text-secondary-foreground border border-border px-4 py-2 rounded-md font-medium text-sm shadow-sm hover:bg-secondary/80">
            Exportar PDF
          </button>
        </div>
      </div>
      
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
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
            <tr className="hover:bg-muted/50">
              <td className="px-6 py-4 font-medium text-foreground">29/03/2026</td>
              <td className="px-6 py-4">08:00</td>
              <td className="px-6 py-4">18:00</td>
              <td className="px-6 py-4">08:48</td>
              <td className="px-6 py-4">00:48 / 00:00</td>
              <td className="px-6 py-4">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Manual</span>
              </td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-6 py-4 font-medium text-foreground">28/03/2026</td>
              <td className="px-6 py-4">08:15</td>
              <td className="px-6 py-4">18:30</td>
              <td className="px-6 py-4">09:03</td>
              <td className="px-6 py-4 text-primary font-medium">01:03 / 00:00</td>
              <td className="px-6 py-4">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">Sistema AFV</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
