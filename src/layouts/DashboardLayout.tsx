import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Clock, 
  FileBox, 
  LogOut, 
  Fingerprint,
  Sun,
  Moon,
  Menu,
  X
} from 'lucide-react';
import { useAuthStore } from '../store/useAuth';
import { useThemeStore } from '../store/useTheme';

export default function DashboardLayout() {
  const { employeeData, signOut } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = employeeData?.role === 'admin';

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, adminOnly: true },
    { name: 'Bater Ponto', path: '/registrar', icon: Fingerprint, adminOnly: false },
    { name: 'Meus Registros', path: '/historico', icon: Clock, adminOnly: false },
    { name: 'Funcionários', path: '/funcionarios', icon: Users, adminOnly: true },
    { name: 'Importar AFV', path: '/importar', icon: FileBox, adminOnly: true },
  ];

  // Fecha o menu mobile sempre que navegar para outra rota
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const visibleMenuItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-card border-r border-border hidden md:flex md:flex-col shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-border text-primary">
          <Clock className="w-6 h-6 mr-2" />
          <span className="font-bold text-lg text-foreground tracking-tight">PontoApp</span>
        </div>
        
        <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          {visibleMenuItems.map((item) => {
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
            );
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

      {/* Backdrop do Menu Mobile */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)} 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Drawer Lateral Mobile */}
      <aside 
        className={`fixed top-0 bottom-0 left-0 w-72 bg-card border-r border-border z-50 flex flex-col p-4 shadow-2xl transition-transform duration-300 md:hidden ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-14 flex items-center justify-between px-2 border-b border-border text-primary mb-4">
          <div className="flex items-center">
            <Clock className="w-6 h-6 mr-2" />
            <span className="font-bold text-lg text-foreground tracking-tight">PontoApp</span>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
            aria-label="Fechar menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 space-y-1.5 overflow-y-auto">
          {visibleMenuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-medium' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        <div className="p-2 border-t border-border mt-auto pt-4">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-2 rounded-lg bg-secondary/50">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
              {employeeData?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{employeeData?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{employeeData?.role}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setMobileMenuOpen(false);
              signOut();
            }}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen sm:ml-0 overflow-y-auto w-full pb-20 md:pb-8">
        {/* Header superior */}
        <div className="h-16 flex items-center justify-between px-4 md:px-8 bg-card md:bg-transparent border-b border-border md:border-transparent sticky top-0 z-20 backdrop-blur-md bg-card/90">
          <div className="flex items-center md:hidden">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 mr-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-none"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center text-primary">
              <Clock className="w-6 h-6 mr-2" />
              <span className="font-bold text-lg text-foreground">PontoApp</span>
            </div>
          </div>

          <div className="hidden md:block" /> {/* Spacer */}

          <div className="flex items-center gap-2">
            <button 
              onClick={toggleTheme}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-card md:bg-card/50 border border-border shadow-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-300 hover:scale-105 active:scale-95"
              aria-label="Alternar tema"
              title="Alternar modo Claro / Escuro"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-500" />}
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8 flex-1 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>

      {/* Bottom Navigation Bar Mobile (Navegação rápida por toque no celular) */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-lg border-t border-border z-30 flex items-center justify-around md:hidden px-2 shadow-lg">
        {visibleMenuItems.slice(0, 4).map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] tracking-tight truncate max-w-[70px]">{item.name}</span>
            </Link>
          );
        })}
        {visibleMenuItems.length > 4 && (
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center flex-1 py-1 text-muted-foreground hover:text-foreground"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Mais</span>
          </button>
        )}
      </nav>
    </div>
  );
}
