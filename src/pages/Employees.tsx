import { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseAdmin } from '../services/supabase';
import { Loader2, Plus, X, Edit, Power, PowerOff, Key, ClipboardCheck } from 'lucide-react';
import { getPayrollPeriod, formatMinutesToTime } from '../utils/time';
import type { Employee } from '../store/useAuth';

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals state
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // States for Payroll Closings / Hours Liquidation
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [closeMonth, setCloseMonth] = useState<number>(new Date().getMonth());
  const [closeYear, setCloseYear] = useState<number>(new Date().getFullYear());
  const [closeStats, setCloseStats] = useState({ overtimePending: 0, nightPending: 0 });
  const [closeLoading, setCloseLoading] = useState(false);

  const fetchCloseStats = useCallback(async (empId: string, yr: number, mth: number) => {
    try {
      setCloseLoading(true);
      const period = getPayrollPeriod(yr, mth);
      
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('employee_id', empId)
        .gte('date', period.startDateStr)
        .lte('date', period.endDateStr);
        
      if (error) throw error;
      
      let overtimePending = 0;
      let nightPending = 0;
      
      if (data) {
        data.forEach(r => {
          if (r.overtime_status === 'pending') {
            overtimePending += r.overtime_minutes || 0;
          }
          if (r.night_status === 'pending') {
            nightPending += r.night_minutes || 0;
          }
        });
      }
      
      setCloseStats({ overtimePending, nightPending });
    } catch (e) {
      console.error(e);
    } finally {
      setCloseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedEmp) {
      Promise.resolve().then(() => fetchCloseStats(selectedEmp.id, closeYear, closeMonth));
    }
  }, [selectedEmp, closeMonth, closeYear, fetchCloseStats]);

  const handleLiquidate = async (type: 'pay_overtime' | 'compensate_overtime' | 'pay_night') => {
    if (!selectedEmp) return;
    setCloseLoading(true);
    const period = getPayrollPeriod(closeYear, closeMonth);
    const nowIso = new Date().toISOString();
    
    try {
      let updatePayload = {};
      let queryField = '';
      
      if (type === 'pay_overtime') {
        updatePayload = { overtime_status: 'paid', resolved_at: nowIso };
        queryField = 'overtime_status';
      } else if (type === 'compensate_overtime') {
        updatePayload = { overtime_status: 'compensated', resolved_at: nowIso };
        queryField = 'overtime_status';
      } else if (type === 'pay_night') {
        updatePayload = { night_status: 'paid', resolved_at: nowIso };
        queryField = 'night_status';
      }
      
      const { error } = await supabase
        .from('time_records')
        .update(updatePayload)
        .eq('employee_id', selectedEmp.id)
        .gte('date', period.startDateStr)
        .lte('date', period.endDateStr)
        .eq(queryField, 'pending');
        
      if (error) throw error;
      
      alert('Horas liquidadas com sucesso!');
      fetchCloseStats(selectedEmp.id, closeYear, closeMonth);
    } catch (e) {
      alert('Erro ao liquidar horas: ' + (e as Error).message);
    } finally {
      setCloseLoading(false);
    }
  };

  // Form State (Create / Edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [position, setPosition] = useState('');
  const [journeyStart, setJourneyStart] = useState('08:00');
  const [journeyEnd, setJourneyEnd] = useState('18:00');

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setEmployees((data as unknown as Employee[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(() => fetchEmployees());
  }, [fetchEmployees]);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPosition('');
    setRole('user');
    setJourneyStart('08:00');
    setJourneyEnd('18:00');
    setEditingId(null);
  };

  const handleOpenCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    resetForm();
    setEditingId(emp.id);
    setName(emp.name || '');
    setEmail(emp.email || '');
    setPosition(emp.position || '');
    setRole(emp.role || 'user');
    setJourneyStart(emp.journey_start ? emp.journey_start.slice(0,5) : '08:00');
    setJourneyEnd(emp.journey_end ? emp.journey_end.slice(0,5) : '18:00');
    setShowEditModal(true);
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 1. Usar o cliente supabaseAdmin para que o admin logado NÃO seja deslogado
      const { data, error } = await supabaseAdmin.auth.signUp({
        email,
        password: 'Mudar123!', // Senha inicial padrão
        options: {
          data: {
            full_name: name,
          }
        }
      });
      
      if (error) throw error;
      
      // 2. O trigger handle_new_user cria automaticamente a linha no painel do banco e lá o role fica como 'user'.
      // Aqui, vamos dar um update explícito com todos os dados:
      if (data.user) {
        await supabase.from('employees')
          .update({ 
            position, 
            role, 
            journey_start: journeyStart,
            journey_end: journeyEnd,
            name // garante que atualizou
          })
          .eq('id', data.user.id);
      }

      alert("Funcionário criado com sucesso. A senha inicial é 'Mudar123!'");
      setShowModal(false);
      resetForm();
      fetchEmployees();
    } catch (e) {
      alert("Erro ao criar: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          name,
          position,
          role,
          journey_start: journeyStart,
          journey_end: journeyEnd
        })
        .eq('id', editingId);

      if (error) throw error;

      alert("Dados do funcionário atualizados!");
      setShowEditModal(false);
      resetForm();
      fetchEmployees();
    } catch (e) {
      alert("Erro ao atualizar: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetPasswordAdmin = async (email: string) => {
    if (!confirm(`Deseja enviar um e-mail de redefinição de senha para ${email}?`)) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      alert("E-mail de redefinição enviado com sucesso!");
    } catch (e) {
      alert("Erro ao enviar e-mail: " + (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (!confirm(currentStatus ? "Esta ação inativará o funcionário e ele não poderá mais bater ponto. Confirmar?" : "Deseja reativar este funcionário?")) {
      return;
    }

    try {
      // Soft Delete: desativamos (inativamos) a conta
      setLoading(true);
      const { error } = await supabase
        .from('employees')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      fetchEmployees();
    } catch (e) {
      alert("Erro ao mudar status: " + (e as Error).message);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold tracking-tight">Funcionários</h1>
        <button 
          onClick={handleOpenCreate}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm shadow hover:bg-primary/90 flex items-center"
        >
          <Plus className="w-4 h-4 mr-1" />
          Novo Funcionário
        </button>
      </div>

      {/* MODAL DE CRIAÇÃO */}
      {showModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-xl shadow-lg border border-border p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-6">Novo Funcionário</h2>
            <form onSubmit={handleCreateEmployee} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Nome Completo</label>
                <input required value={name} onChange={e=>setName(e.target.value)} type="text" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">E-mail</label>
                <input required value={email} onChange={e=>setEmail(e.target.value)} type="email" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Cargo/Função</label>
                  <input value={position} onChange={e=>setPosition(e.target.value)} type="text" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Acesso</label>
                  <select value={role} onChange={e=>setRole(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="user">Usuário Comum</option>
                    <option value="admin">Administrador Geral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Início da Jornada</label>
                  <input type="time" required value={journeyStart} onChange={e=>setJourneyStart(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Fim da Jornada</label>
                  <input type="time" required value={journeyEnd} onChange={e=>setJourneyEnd(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="pt-4">
                <button disabled={saving} type="submit" className="w-full bg-primary text-primary-foreground py-2 h-10 rounded-lg font-medium shadow flex justify-center items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Cadastrar Funcionário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO */}
      {showEditModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-xl shadow-lg border border-border p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowEditModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-6">Editar Funcionário</h2>
            <form onSubmit={handleUpdateEmployee} className="space-y-4 text-left">
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Nome Completo</label>
                <input required value={name} onChange={e=>setName(e.target.value)} type="text" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground opacity-60">E-mail (Não editável)</label>
                <input disabled value={email} type="email" className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm opacity-60 cursor-not-allowed" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Cargo/Função</label>
                  <input value={position} onChange={e=>setPosition(e.target.value)} type="text" className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Acesso</label>
                  <select value={role} onChange={e=>setRole(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="user">Usuário Comum</option>
                    <option value="admin">Administrador Geral</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Início da Jornada</label>
                  <input type="time" required value={journeyStart} onChange={e=>setJourneyStart(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-foreground">Fim da Jornada</label>
                  <input type="time" required value={journeyEnd} onChange={e=>setJourneyEnd(e.target.value)} className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>
              <div className="pt-4">
                <button disabled={saving} type="submit" className="w-full bg-primary text-primary-foreground py-2 h-10 rounded-lg font-medium shadow flex justify-center items-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE FECHAMENTO */}
      {showCloseModal && selectedEmp && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-lg rounded-xl shadow-lg border border-border p-6 relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setShowCloseModal(false); setSelectedEmp(null); }}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-1">Fechamento de Ponto</h2>
            <p className="text-sm text-muted-foreground mb-6">Funcionário: <span className="font-semibold text-foreground">{selectedEmp.name}</span></p>
            
            <div className="flex gap-2 mb-6">
              <select 
                value={closeMonth} 
                onChange={(e) => setCloseMonth(Number(e.target.value))}
                className="bg-background border border-input rounded-md px-3 py-2 text-sm flex-1 focus:ring-primary focus:ring-primary text-foreground"
              >
                {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                  <option key={i} value={i}>{m}</option>
                ))}
              </select>
              <select 
                value={closeYear} 
                onChange={(e) => setCloseYear(Number(e.target.value))}
                className="bg-background border border-input rounded-md px-3 py-2 text-sm w-28 focus:ring-primary focus:border-primary text-foreground"
              >
                {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {closeLoading ? (
              <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <div className="space-y-6">
                <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-border/40">
                    <span className="font-semibold text-foreground">Horas Extras Pendentes:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-lg">{formatMinutesToTime(closeStats.overtimePending, true)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">Adicional Noturno Pendente:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-lg">{formatMinutesToTime(closeStats.nightPending, true)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Ações de Fechamento</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button 
                      disabled={closeStats.overtimePending === 0}
                      onClick={() => handleLiquidate('pay_overtime')}
                      className="bg-primary text-primary-foreground font-medium py-2.5 px-4 rounded-lg text-sm shadow hover:bg-primary/95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Pagar Horas Extras
                    </button>
                    <button 
                      disabled={closeStats.overtimePending === 0}
                      onClick={() => handleLiquidate('compensate_overtime')}
                      className="bg-teal-600 hover:bg-teal-600/95 text-white font-medium py-2.5 px-4 rounded-lg text-sm shadow transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Compensar Extras (Banco)
                    </button>
                  </div>
                  
                  <button 
                    disabled={closeStats.nightPending === 0}
                    onClick={() => handleLiquidate('pay_night')}
                    className="w-full bg-primary text-primary-foreground font-medium py-2.5 px-4 rounded-lg text-sm shadow hover:bg-primary/95 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Pagar Adicional Noturno
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap min-w-max">
          <thead className="bg-muted text-muted-foreground uppercase text-xs">
            <tr>
              <th className="px-6 py-4 font-semibold tracking-wider">Nome e E-mail</th>
              <th className="px-6 py-4 font-semibold tracking-wider">Cargo</th>
              <th className="px-6 py-4 font-semibold tracking-wider">Jornada</th>
              <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
              <th className="px-6 py-4 font-semibold tracking-wider flex justify-end">Opções</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground/50">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary opacity-50" />
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                  <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-2">
                    <X className="w-6 h-6 opacity-30" />
                  </div>
                  Nenhum funcionário encontrado. Lembre-se, o RLS permite listar caso você seja Administrador.
                </td>
              </tr>
            ) : (
              employees.map(emp => (
                <tr key={emp.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-medium text-foreground">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-[15px]">{emp.name}</span>
                      <span className="text-xs text-muted-foreground/80">{emp.email} {emp.role === 'admin' ? '(Admin)' : ''}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">{emp.position || '--'}</td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {emp.journey_start ? emp.journey_start.slice(0,5) : '08:00'} às {emp.journey_end ? emp.journey_end.slice(0,5) : '18:00'}
                  </td>
                  <td className="px-6 py-4">
                    {emp.is_active ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">Ativo</span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">Inativo</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setSelectedEmp(emp); setShowCloseModal(true); }}
                        className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-green-600 transition-colors tooltip"
                        title="Fechamento de Ponto / Liquidação"
                      >
                        <ClipboardCheck className="w-4.5 h-4.5" />
                      </button>

                      <button 
                        onClick={() => handleOpenEdit(emp)}
                        className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-primary transition-colors tooltip"
                        title="Editar Funcionário"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      
                      <button 
                        onClick={() => handleResetPasswordAdmin(emp.email)}
                        className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-amber-500 transition-colors tooltip"
                        title="Redefinir Senha"
                      >
                        <Key className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => handleToggleStatus(emp.id, emp.is_active)}
                        className={`p-1.5 rounded-md transition-colors tooltip ${
                          emp.is_active 
                            ? "hover:bg-secondary text-muted-foreground hover:text-destructive" 
                            : "hover:bg-secondary hover:text-primary"
                        }`}
                        title={emp.is_active ? "Inativar Conta" : "Reativar Conta"}
                      >
                        {emp.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
