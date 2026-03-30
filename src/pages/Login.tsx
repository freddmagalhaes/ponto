import { useState } from 'react';
import { useAuthStore } from '../store/useAuth';
import { supabase } from '../services/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser, setEmployeeData } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // TEMPORÁRIO PARA TESTE DA INTERFACE:
        if (email === 'admin@teste.com' && password === '123456') {
          setUser({ id: 'mock-1', email } as any, { access_token: 'mock' } as any);
          setEmployeeData({ id: 'mock-1', name: 'Administrador Teste', email, role: 'admin', position: 'Gerente', created_at: new Date().toISOString() });
          return;
        }
        if (email === 'user@teste.com' && password === '123456') {
          setUser({ id: 'mock-2', email } as any, { access_token: 'mock' } as any);
          setEmployeeData({ id: 'mock-2', name: 'Funcionário Comum', email, role: 'user', position: 'Analista', created_at: new Date().toISOString() });
          return;
        }
        throw error;
      }
      
      setUser(data.user, data.session);
      
      // Fetch employee data
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('id', data.user.id)
        .single();
        
      if (empError) console.error("Could not fetch employee profile:", empError);
      
      if (empData) {
        setEmployeeData(empData);
      }
      
    } catch (err: any) {
      setError(err.message || 'Falha ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold">Faça seu Login</h3>
      </div>
      
      {error && (
        <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleLogin}>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
            placeholder="seu@email.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
            placeholder="********"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>

        <div className="mt-4 text-xs bg-muted p-3 rounded-md border border-border">
          <p className="font-semibold mb-1 text-foreground">Contas de Teste (Mock):</p>
          <p>Admin: <span className="font-mono">admin@teste.com</span> / <span className="font-mono">123456</span></p>
          <p>Comum: <span className="font-mono">user@teste.com</span> / <span className="font-mono">123456</span></p>
        </div>
      </form>
    </div>
  );
}
