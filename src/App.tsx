import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useCallback } from 'react';
import { supabase } from './services/supabase';
import { useAuthStore } from './store/useAuth';
import { useThemeStore } from './store/useTheme';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import MyRecords from './pages/MyRecords';
import Ponto from './pages/Ponto';
import Import from './pages/Import';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

export default function App() {
  const { user, isLoading, setUser, setLoading, setEmployeeData } = useAuthStore();
  const { theme } = useThemeStore();

  const fetchEmployee = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (!error && data) {
        setEmployeeData(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [setEmployeeData, setLoading]);

  useEffect(() => {
    // Aplica o tema salvo no carregamento
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null, session);
      if (session?.user) {
        fetchEmployee(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch((e) => {
      console.warn("Supabase fetch failed (mock URL?)", e);
      setLoading(false);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null, session);
        if (session?.user) {
          fetchEmployee(session.user.id);
        } else {
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [setUser, setLoading, fetchEmployee, theme]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public / Non-authenticated routes */}
        {!user ? (
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Route>
        ) : (
          /* Authenticated routes */
          <Route element={<DashboardLayout />}>
            {/* User & Admin shared */}
            <Route path="/" element={<Dashboard />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/historico" element={<MyRecords />} />
            <Route path="/registrar" element={<Ponto />} />
            
            {/* Admin only */}
            <Route element={<ProtectedRoute requiredRole="admin" />}>
              <Route path="/funcionarios" element={<Employees />} />
              <Route path="/importar" element={<Import />} />
            </Route>
            
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}
