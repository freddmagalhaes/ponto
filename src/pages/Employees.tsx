export default function Employees() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Funcionários</h1>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm shadow hover:bg-primary/90">
          + Novo Funcionário
        </button>
      </div>
      
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-secondary/50 text-muted-foreground uppercase">
            <tr>
              <th className="px-6 py-3 font-medium">Nome</th>
              <th className="px-6 py-3 font-medium">Cargo</th>
              <th className="px-6 py-3 font-medium">Jornada</th>
              <th className="px-6 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr className="hover:bg-muted/50">
              <td className="px-6 py-4 font-medium text-foreground">Frederico Admin</td>
              <td className="px-6 py-4">Gerente</td>
              <td className="px-6 py-4">08:00 - 18:00</td>
              <td className="px-6 py-4">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">Ativo</span>
              </td>
            </tr>
            <tr className="hover:bg-muted/50">
              <td className="px-6 py-4 font-medium text-foreground">João Silva</td>
              <td className="px-6 py-4">Desenvolvedor</td>
              <td className="px-6 py-4">08:00 - 18:00</td>
              <td className="px-6 py-4">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">Ativo</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
