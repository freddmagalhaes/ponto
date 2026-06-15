import { useState, useEffect } from 'react';
import { Play, Square, Loader2, Save, X, CalendarPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/useAuth';
import { calculateDailyTimes, formatMinutesToTime, formatTime } from '../utils/time';

interface TimeRecord {
  id: string;
  check_in: string;
  check_out: string | null;
  worked_minutes: number;
}

export default function Ponto() {
  const [time, setTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todayRecord, setTodayRecord] = useState<TimeRecord | null>(null);
  
  // Estado para o formulário manual
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDate, setManualDate] = useState('');
  const [manualCheckIn, setManualCheckIn] = useState('08:00');
  const [manualCheckOut, setManualCheckOut] = useState('18:00');

  const { user } = useAuthStore();
  
  const todayDateStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    setManualDate(todayDateStr);
  }, [todayDateStr]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user && user.id && !user.id.startsWith('mock')) {
      fetchTodayRecord();
    } else {
      setLoading(false); // Para o carregamento se for usuário de teste
    }
  }, [user]);

  const fetchTodayRecord = async () => {
    try {
      const { data, error } = await supabase
        .from('time_records')
        .select('*')
        .eq('employee_id', user?.id)
        .eq('date', todayDateStr)
        .maybeSingle();
      
      if (!error && data) {
        setTodayRecord(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleBaterPonto = async (type: 'entrada' | 'saida') => {
    if (!user || user.id.startsWith('mock')) {
      alert("Você está usando o usuário de Teste. Conecte ao Supabase real para salvar dados.");
      return;
    }

    setSaving(true);
    const nowIso = new Date().toISOString();

    try {
      if (type === 'entrada') {
        const { data, error } = await supabase
          .from('time_records')
          .insert({
            employee_id: user.id,
            date: todayDateStr,
            check_in: nowIso,
            source: 'manual'
          })
          .select()
          .single();

        if (error) throw error;
        setTodayRecord(data);
      } else if (type === 'saida' && todayRecord) {
        // Calcula os tempos antes de salvar a saída
        const { workedMinutes, overtimeMinutes, nightMinutes } = calculateDailyTimes({
          checkIn: todayRecord.check_in,
          checkOut: nowIso
        });

        const { data, error } = await supabase
          .from('time_records')
          .update({
            check_out: nowIso,
            worked_minutes: workedMinutes,
            overtime_minutes: overtimeMinutes,
            night_minutes: nightMinutes
          })
          .eq('id', todayRecord.id)
          .select()
          .single();

        if (error) throw error;
        setTodayRecord(data);
      }
    } catch (e: any) {
      alert("Erro ao registrar o ponto: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!user || user.id.startsWith('mock')) {
      alert("Você está usando o usuário de Teste.");
      return;
    }
    
    if (!manualDate || !manualCheckIn || !manualCheckOut) {
      alert("Por favor, preencha todos os campos do registro manual.");
      return;
    }

    setSaving(true);
    
    // Converte data + hora em ISO
    const checkInIso = new Date(`${manualDate}T${manualCheckIn}:00`).toISOString();
    const checkOutDate = new Date(`${manualDate}T${manualCheckOut}:00`);

    // Correção: Se o horário de saída for menor ou igual ao horário de entrada,
    // significa que a pessoa trabalhou durante a madrugada atravessando para o DIA SEGUINTE!
    if (manualCheckOut < manualCheckIn) {
      checkOutDate.setDate(checkOutDate.getDate() + 1);
    }
    const checkOutIso = checkOutDate.toISOString();

    const { workedMinutes, overtimeMinutes, nightMinutes } = calculateDailyTimes({
      checkIn: checkInIso,
      checkOut: checkOutIso
    });

    try {
      // Faz upsert para lidar com a constraint unique(employee_id, date)
      const { data, error } = await supabase
        .from('time_records')
        .upsert({
          employee_id: user.id,
          date: manualDate,
          check_in: checkInIso,
          check_out: checkOutIso,
          worked_minutes: workedMinutes,
          overtime_minutes: overtimeMinutes,
          night_minutes: nightMinutes,
          source: 'manual'
        }, { onConflict: 'employee_id,date' })
        .select()
        .single();
      
      if (error) throw error;
      
      if (manualDate === todayDateStr) {
        setTodayRecord(data);
      }
      alert('Registro manual salvo com sucesso!');
      setShowManualForm(false);
    } catch (e: any) {
      alert("Erro ao salvar registro manual: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const hasCheckIn = !!todayRecord?.check_in;
  const hasCheckOut = !!todayRecord?.check_out;

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-8 pb-12">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-medium text-muted-foreground uppercase tracking-widest">
          {format(time, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </h1>
        <div className="text-7xl font-bold tracking-tighter text-foreground tabular-nums">
          {format(time, "HH:mm:ss")}
        </div>
      </div>

      {loading ? (
        <div className="p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="flex gap-6 w-full max-w-md mt-12">
            <button 
              disabled={saving || hasCheckIn}
              onClick={() => handleBaterPonto('entrada')}
              className="flex-1 bg-primary text-primary-foreground rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:shadow-lg disabled:cursor-not-allowed"
            >
              <Play className="w-10 h-10" />
              <span className="text-xl font-bold uppercase tracking-wider">Entrada</span>
              <span className="text-sm opacity-80 font-medium">{hasCheckIn ? 'Registrada' : 'Bater ponto de chegada'}</span>
            </button>
            
            <button 
              disabled={saving || !hasCheckIn || hasCheckOut}
              onClick={() => handleBaterPonto('saida')}
              className="flex-1 bg-destructive text-destructive-foreground rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:shadow-lg disabled:cursor-not-allowed"
            >
              <Square className="w-10 h-10" />
              <span className="text-xl font-bold uppercase tracking-wider">Saída</span>
              <span className="text-sm opacity-80 font-medium">
                {!hasCheckIn ? 'Aguardando Entrada' : hasCheckOut ? 'Finalizado' : 'Encerrar expediente'}
              </span>
            </button>
          </div>

          <div className="w-full max-w-md mt-4">
            {!showManualForm ? (
              <button 
                onClick={() => setShowManualForm(true)}
                className="w-full bg-secondary text-secondary-foreground rounded-xl p-4 flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors border border-border"
              >
                <CalendarPlus className="w-5 h-5" />
                <span className="font-semibold">Inserir Batida Manual</span>
              </button>
            ) : (
              <div className="bg-card border border-border rounded-xl p-5 shadow-md mt-2 relative animate-in fade-in zoom-in-95 duration-200">
                <button 
                  onClick={() => setShowManualForm(false)}
                  className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
                <h3 className="font-semibold text-lg border-b border-border pb-3 mb-4 flex items-center gap-2">
                  <CalendarPlus className="w-5 h-5 text-primary" />
                  Registro Manual
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5 text-foreground">Data</label>
                    <input 
                      type="date" 
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Entrada</label>
                      <input 
                        type="time" 
                        value={manualCheckIn}
                        onChange={(e) => setManualCheckIn(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Saída</label>
                      <input 
                        type="time" 
                        value={manualCheckOut}
                        onChange={(e) => setManualCheckOut(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleManualSubmit}
                    disabled={saving}
                    className="w-full mt-2 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center gap-2 h-10 px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Salvar Registro Manual
                  </button>
                  <p className="text-xs text-center text-muted-foreground pt-1">
                    Cuidado, isso pode sobrescrever registros existentes para essa data.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="mt-8 w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-sm">
         <h3 className="font-semibold text-lg border-b border-border pb-3 mb-4 flex items-center justify-between">
            Registro de Hoje 
            {(saving || loading) && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
         </h3>
         <div className="flex justify-between items-center py-2">
           <span className="text-muted-foreground font-medium">Entrada</span>
           <span className={`font-bold ${hasCheckIn ? 'text-foreground' : 'text-muted-foreground'}`}>
             {todayRecord?.check_in ? formatTime(todayRecord.check_in) : '--:--'}
           </span>
         </div>
         <div className="flex justify-between items-center py-2 border-t border-border/50">
           <span className="text-muted-foreground font-medium">Saída</span>
           <span className={`font-bold ${hasCheckOut ? 'text-destructive' : 'text-muted-foreground'}`}>
             {todayRecord?.check_out ? formatTime(todayRecord.check_out) : '--:--'}
           </span>
         </div>
         <div className="flex justify-between items-center py-2 border-t border-border mt-2 pt-4">
           <span className="font-bold">Horas Trabalhadas</span>
           <span className={`font-bold ${todayRecord?.worked_minutes ? 'text-primary' : 'text-muted-foreground'}`}>
             {todayRecord?.worked_minutes ? formatMinutesToTime(todayRecord.worked_minutes, true) : '0h 0m'}
           </span>
         </div>
         
         <p className="text-xs text-center text-muted-foreground mt-6">
           O intervalo de 1h12min (12:00 às 13:12) é deduzido automaticamente se o período trabalhado tiver intersecção.
         </p>
      </div>
    </div>
  );
}
