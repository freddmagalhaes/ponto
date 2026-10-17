import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/useAuth';

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  is_active: boolean;
}

export interface EmployeeCompany {
  id: string;
  company_id: string;
  start_date: string;
  end_date: string | null;
  company: Company;
}

/**
 * Hook para buscar as empresas vinculadas ao funcionário atual.
 * Retorna o histórico completo de vínculos com as empresas.
 */
export function useCompanies() {
  const { user } = useAuthStore();
  const [companies, setCompanies] = useState<EmployeeCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const fetchCompanies = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('employee_companies')
          .select(`
            id,
            company_id,
            start_date,
            end_date,
            company:companies (
              id,
              name,
              cnpj,
              is_active
            )
          `)
          .eq('employee_id', user.id)
          .order('start_date', { ascending: true });

        if (fetchError) throw fetchError;

        setCompanies((data as unknown as EmployeeCompany[]) || []);
      } catch (err) {
        console.error('Erro ao buscar empresas:', err);
        setError('Não foi possível carregar as empresas.');
      } finally {
        setLoading(false);
      }
    };

    fetchCompanies();
  }, [user?.id]);

  /**
   * Retorna o nome da empresa correspondente a uma data específica.
   * Faz o lookup nos vínculos carregados sem nova chamada ao banco.
   */
  const getCompanyNameForDate = (dateStr: string): string => {
    if (companies.length === 0) return '--';

    const match = companies.find(ec => {
      const isAfterStart = ec.start_date <= dateStr;
      const isBeforeEnd = !ec.end_date || ec.end_date >= dateStr;
      return isAfterStart && isBeforeEnd;
    });

    return match?.company?.name ?? '--';
  };

  /** Retorna a empresa atualmente ativa (end_date = null) */
  const activeCompany = companies.find(ec => !ec.end_date)?.company ?? null;

  /** Retorna todas as empresas únicas (para filtros de UI) */
  const uniqueCompanies: Company[] = companies.reduce<Company[]>((acc, ec) => {
    if (!acc.find(c => c.id === ec.company_id)) {
      acc.push(ec.company);
    }
    return acc;
  }, []);

  return {
    employeeCompanies: companies,
    uniqueCompanies,
    activeCompany,
    getCompanyNameForDate,
    loading,
    error,
  };
}
