import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/useAuth';

interface ProtectedRouteProps {
  requiredRole?: 'admin' | 'user';
}

export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, employeeData, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se o usuário não estiver logado, redireciona para login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Se uma função (role) específica for exigida e o usuário não a tiver, redireciona para o painel inicial
  if (requiredRole && employeeData?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  // Caso contrário, renderiza as rotas filhas
  return <Outlet />;
}
