import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../services/supabase';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setMessage('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      setError(err.message || 'Falha ao solicitar recuperação de senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-bold">Recuperar Senha</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Insira seu e-mail para receber um link de recuperação.
        </p>
      </div>
      
      {error && (
        <div className="bg-destructive/15 text-destructive text-sm p-3 rounded-md">
          {error}
        </div>
      )}

      {message && (
        <div className="bg-green-500/15 text-green-600 dark:text-green-400 text-sm p-3 rounded-md">
          {message}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleResetRequest}>
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

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
        </button>

        <div className="text-center mt-4">
          <Link to="/login" className="text-sm text-primary hover:underline">
            Voltar para o Login
          </Link>
        </div>
      </form>
    </div>
  );
}
