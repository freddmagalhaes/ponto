import { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Square, Loader2, Save, X, CalendarPlus } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/useAuth';
import { calculateDailyTimes, formatMinutesToTime, formatTime, manualTimes } from '../utils/time';
import { useCompanies } from '../hooks/useCompanies';

import { saveTimeRecord } from '../services/timeRecords';
import type { TimeRecord } from '../services/timeRecords';

// Helper para obter geolocalização via API nativa Web do navegador (desktop e mobile)
const getCoordinates = async (): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    return await new Promise((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        console.warn("Geolocalização não suportada neste navegador.");
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.warn("Erro ao obter geolocalização na web:", error.message);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  } catch (err) {
    console.error("Erro geral ao obter coordenadas de geolocalização:", err);
    return null;
  }
};

const verifyBiometrics = async (): Promise<boolean> => {
  return true;
};

export default function Ponto() {
  const { user } = useAuthStore();
  const { activeCompany } = useCompanies();
  const todayDateStr = format(new Date(), 'yyyy-MM-dd');

  const [time, setTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [todayRecord, setTodayRecord] = useState<TimeRecord | null>(null);
  
  // Estado para o formulário manual
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualDate, setManualDate] = useState(todayDateStr);
  const [manualCheckIn, setManualCheckIn] = useState('08:00');
  const [manualCheckOut, setManualCheckOut] = useState('18:00');

  const [manualLunchOut, setManualLunchOut] = useState('');
  const [manualLunchIn, setManualLunchIn] = useState('');
  const [manualRecord, setManualRecord] = useState<TimeRecord | null>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualReady, setManualReady] = useState(false);
  const [showExitChoice, setShowExitChoice] = useState(false);
  const [loadError, setLoadError] = useState('');
  const savingRef = useRef(false);
  const exitDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = exitDialogRef.current;
    if (showExitChoice) dialog?.showModal();
    else dialog?.close();
  }, [showExitChoice]);

  const fetchTodayRecord = useCallback(async () => {
    if (!user) return;
    try {
      setLoadError('');
      // Keep an open shift on its entry date, including after midnight.
      const { data: open, error: openError } = await supabase.from('time_records')
        .select('*').eq('employee_id', user.id).is('check_out', null)
        .order('date', { ascending: false }).limit(1).maybeSingle();
      if (openError) throw openError;
      if (open) setTodayRecord(open);
      else {
        const { data, error } = await supabase.from('time_records').select('*')
          .eq('employee_id', user.id).eq('date', todayDateStr).maybeSingle();
        if (error) throw error;
        setTodayRecord(data);
      }
    } catch (e) {
      setLoadError('Não foi possível carregar o ponto. Tente novamente.');
      console.error(e);
    } finally { setLoading(false); }
  }, [user, todayDateStr]);

  useEffect(() => {
    if (!showManualForm || !user || !manualDate) return;
    let cancelled = false;
    supabase.from('time_records').select('*').eq('employee_id', user.id)
      .eq('date', manualDate).maybeSingle().then(({ data, error }) => {
        if (cancelled) return;
        setManualLoading(false);
        if (error) {
          setManualReady(false);
          alert('Não foi possível carregar os horários dessa data. Feche e reabra o formulário.');
          return;
        }
        setManualRecord(data);
        setManualCheckIn(data?.check_in ? formatTime(data.check_in) : '08:00');
        setManualCheckOut(data?.check_out ? formatTime(data.check_out) : '18:00');
        setManualLunchOut(data?.lunch_out ? formatTime(data.lunch_out) : '');
        setManualLunchIn(data?.lunch_in ? formatTime(data.lunch_in) : '');
        setManualReady(true);
      });
    return () => { cancelled = true; };
  }, [showManualForm, manualDate, user]);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user && user.id) {
      Promise.resolve().then(() => fetchTodayRecord());
    } else {
      Promise.resolve().then(() => setLoading(false));
    }
  }, [user, fetchTodayRecord]);

  const hasCheckIn = !!todayRecord?.check_in;
  const hasCheckOut = !!todayRecord?.check_out;
  const atLunch = !!todayRecord?.lunch_out && !todayRecord?.lunch_in;

  const handleBaterPonto = async (type: 'entrada' | 'almoco_saida' | 'almoco_retorno' | 'saida') => {
    if (!user || savingRef.current || loading || loadError) return;
    if ((type === 'entrada' && hasCheckIn) || (type !== 'entrada' && (!todayRecord || hasCheckOut)) ||
        (type === 'almoco_saida' && todayRecord?.lunch_out) ||
        (type === 'almoco_retorno' && !atLunch) || (type === 'saida' && atLunch)) return;
    savingRef.current = true;
    setSaving(true);
    setShowExitChoice(false);
    const nowIso = new Date().toISOString();
    try {
      setStatusMessage('Validando biometria...');
      if (!await verifyBiometrics()) return;
      setStatusMessage('Buscando localização...');
      const coords = await getCoordinates();
      const lat = coords && Number.isFinite(coords.latitude) ? coords.latitude : null;
      const lng = coords && Number.isFinite(coords.longitude) ? coords.longitude : null;
      setStatusMessage('Registrando ponto...');
      if (type === 'entrada') {
        await saveTimeRecord({ employee_id: user.id, date: todayDateStr, check_in: nowIso,
          source: 'manual', latitude_in: lat, longitude_in: lng }, null);
      } else if (todayRecord) {
        const values: Record<string, unknown> = {};
        if (type === 'almoco_saida') values.lunch_out = nowIso;
        if (type === 'almoco_retorno') values.lunch_in = nowIso;
        if (type === 'saida') {
          const times = calculateDailyTimes({ checkIn: todayRecord.check_in, checkOut: nowIso,
            lunchOut: todayRecord.lunch_out, lunchIn: todayRecord.lunch_in });
          Object.assign(values, { check_out: nowIso, worked_minutes: times.workedMinutes,
            overtime_minutes: times.overtimeMinutes, night_minutes: times.nightMinutes,
            latitude_out: lat, longitude_out: lng });
        }
        await saveTimeRecord(values, todayRecord);
      }
    } catch (e) {
      alert('Erro ao registrar o ponto: ' + (e as Error).message);
    } finally {
      await fetchTodayRecord();
      savingRef.current = false;
      setSaving(false);
      setStatusMessage('');
    }
  };

  const handleManualSubmit = async () => {
    if (!user || savingRef.current || !manualReady) return;
    savingRef.current = true;
    setSaving(true);
    try {
      if (manualDate > todayDateStr) throw new Error('Não é permitido registrar ponto em datas futuras.');
      const punches = manualTimes(manualDate, manualCheckIn, manualCheckOut, manualLunchOut, manualLunchIn);
      const times = calculateDailyTimes(punches);
      await saveTimeRecord({ employee_id: user.id, date: manualDate,
        check_in: punches.checkIn, check_out: punches.checkOut,
        lunch_out: punches.lunchOut, lunch_in: punches.lunchIn,
        worked_minutes: times.workedMinutes, overtime_minutes: times.overtimeMinutes,
        night_minutes: times.nightMinutes, ...(!manualRecord ? { source: 'manual' } : {}) }, manualRecord);
      setShowManualForm(false);
      alert('Registro manual salvo com sucesso!');
      await fetchTodayRecord();
    } catch (e) {
      alert('Erro ao salvar registro manual: ' + (e as Error).message);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

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

      {loadError && <div role="alert" className="text-destructive text-center">
        {loadError} <button onClick={() => fetchTodayRecord()} className="underline">Tentar novamente</button>
      </div>}
      <dialog ref={exitDialogRef} onCancel={() => setShowExitChoice(false)} aria-labelledby="exit-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-card text-card-foreground p-6 shadow-lg backdrop:bg-black/50">
        <div className="space-y-4">
          <h2 id="exit-title" className="text-lg font-semibold">Registrar saída</h2>
          <button autoFocus onClick={() => handleBaterPonto('almoco_saida')} className="w-full rounded-md bg-primary text-primary-foreground p-3">Sair para almoço</button>
          <button onClick={() => handleBaterPonto('saida')} className="w-full rounded-md bg-destructive text-destructive-foreground p-3">Encerrar expediente sem intervalo</button>
          <button onClick={() => setShowExitChoice(false)} className="w-full rounded-md border border-border p-3">Cancelar</button>
        </div>
      </dialog>
      {loading ? (
        <div className="p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="flex gap-6 w-full max-w-md mt-12">
            <button 
              disabled={saving || !!loadError || hasCheckOut || (hasCheckIn && !atLunch)}
              onClick={() => handleBaterPonto(atLunch ? 'almoco_retorno' : 'entrada')}
              className="flex-1 bg-primary text-primary-foreground rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:shadow-lg disabled:cursor-not-allowed"
            >
              <Play className="w-10 h-10" />
              <span className="text-xl font-bold uppercase tracking-wider">{atLunch ? 'Retorno' : 'Entrada'}</span>
              <span className="text-sm opacity-80 font-medium">{atLunch ? 'Retornar do almoço' : hasCheckIn ? 'Registrada' : 'Bater ponto de chegada'}</span>
            </button>
            
            <button 
              disabled={saving || !!loadError || !hasCheckIn || hasCheckOut || atLunch}
              onClick={() => todayRecord?.lunch_in ? handleBaterPonto('saida') : setShowExitChoice(true)}
              className="flex-1 bg-destructive text-destructive-foreground rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:-translate-y-0 disabled:hover:shadow-lg disabled:cursor-not-allowed"
            >
              <Square className="w-10 h-10" />
              <span className="text-xl font-bold uppercase tracking-wider">Saída</span>
              <span className="text-sm opacity-80 font-medium">
                {!hasCheckIn ? 'Aguardando Entrada' : hasCheckOut ? 'Finalizado' : atLunch ? 'Aguardando retorno' : todayRecord?.lunch_in ? 'Encerrar expediente' : 'Almoço ou saída'}
              </span>
            </button>
          </div>

          <div className="w-full max-w-md mt-4">
            {!showManualForm ? (
              <button 
                disabled={saving}
                onClick={() => { setManualDate(todayRecord?.date ?? todayDateStr); setManualLoading(true); setManualReady(false); setShowManualForm(true); }}
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
                      disabled={saving}
                      onChange={(e) => { setManualDate(e.target.value); setManualReady(false); setManualLoading(true); }}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Entrada</label>
                      <input 
                        disabled={saving || manualLoading || !manualReady}
                        type="time" 
                        value={manualCheckIn}
                        onChange={(e) => setManualCheckIn(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1.5 text-foreground">Saída</label>
                      <input 
                        disabled={saving || manualLoading || !manualReady}
                        type="time" 
                        value={manualCheckOut}
                        onChange={(e) => setManualCheckOut(e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    {[{ label: 'Saída para almoço', value: manualLunchOut, set: setManualLunchOut },
                      { label: 'Retorno do almoço', value: manualLunchIn, set: setManualLunchIn }].map(field => (
                      <label key={field.label} className="flex-1 min-w-0 text-sm font-medium">
                        {field.label}
                        <input type="time" value={field.value} disabled={saving || manualLoading || !manualReady}
                          onChange={e => field.set(e.target.value)}
                          className="w-full mt-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Sem intervalo? Deixe os dois horários de almoço vazios.</p>
                  <button 
                    onClick={handleManualSubmit}
                    disabled={saving || manualLoading || !manualReady}
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
            <div className="flex items-center gap-2">
              <span>{todayRecord && todayRecord.date !== todayDateStr ? `Registro de ${format(new Date(`${todayRecord.date}T12:00:00`), 'dd/MM/yyyy')}` : 'Registro de Hoje'}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                {activeCompany?.name ?? '--'}
              </span>
            </div>
            {(saving || loading) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                <span>{statusMessage || 'Carregando...'}</span>
              </div>
            )}
         </h3>
         <div className="flex justify-between items-center py-2">
           <span className="text-muted-foreground font-medium">Entrada</span>
           <span className={`font-bold ${hasCheckIn ? 'text-foreground' : 'text-muted-foreground'}`}>
             {todayRecord?.check_in ? formatTime(todayRecord.check_in) : '--:--'}
           </span>
         </div>
         {[['Saída para almoço', todayRecord?.lunch_out], ['Retorno do almoço', todayRecord?.lunch_in]].map(([label, value]) => (
           <div key={label} className="flex justify-between items-center py-2 border-t border-border/50">
             <span className="text-muted-foreground font-medium">{label}</span>
             <span className="font-bold">{value ? formatTime(value) : '--:--'}</span>
           </div>
         ))}
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
           O total é calculado ao encerrar o expediente, descontando o intervalo de almoço registrado.
         </p>
      </div>
    </div>
  );
}
