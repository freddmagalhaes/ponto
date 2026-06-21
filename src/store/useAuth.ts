import { create } from 'zustand';
import type { User, Session } from '@supabase/supabase-js';

// Define the Employee interface that matches the employees table
export interface Employee {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  position: string;
  created_at: string;
  journey_start?: string;
  journey_end?: string;
  is_active?: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  employeeData: Employee | null;
  isLoading: boolean;
  setUser: (user: User | null, session: Session | null) => void;
  setEmployeeData: (data: Employee | null) => void;
  setLoading: (isLoading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  employeeData: null,
  isLoading: true,
  setUser: (user, session) => set({ user, session }),
  setEmployeeData: (employeeData) => set({ employeeData }),
  setLoading: (isLoading) => set({ isLoading }),
  signOut: () => set({ user: null, session: null, employeeData: null }),
}));
