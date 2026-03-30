import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  FileBox, 
  LogOut, 
  Fingerprint
} from 'lucide-react';
import { useAuthStore } from '../store/useAuth';

export default function DashboardLayout() {
  const { employeeData, signOut } = useAuthStore();
  const location = useLocation();

  const isAdmin = employeeData?.role === 'admin';

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, adminOnly: true },
    { name: 'Bater Ponto', path: '/registrar', icon: Fingerprint, adminOnly: false },
    { name: 'Meus Registros', path: '/historico', icon: Clock, adminOnly: false },
    { name: 'Funcionários', path: '/funcionarios', icon: Users, adminOnly: true },
    { name: 'Importar AFV', path: '/importar', icon: FileBox, adminOnly: true },
  ];

  return (
    <div className="min-h-screen bg-secondary/30 dark:bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border hidden md:flex md:flex-col shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-border text-primary">
          <Clock className="w-6 h-6 mr-2" />
          <span className="font-bold text-lg text-foreground tracking-tight">PontoApp</span>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {menuItems.filter(item => !item.adminOnly || isAdmin).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                <span>{item.name}</span>
              </Link>
            )
          })}
        </div>

        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-lg bg-secondary/50">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {employeeData?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{employeeData?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{employeeData?.role}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut()}
            className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen sm:ml-0 overflow-y-auto w-full">
        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-card border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center text-primary">
            <Clock className="w-6 h-6 mr-2" />
            <span className="font-bold text-lg text-foreground">PontoApp</span>
          </div>
          {/* A mobile menu toggle would go here */}
        </div>

        <div className="p-6 md:p-8 flex-1 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
