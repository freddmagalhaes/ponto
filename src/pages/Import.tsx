import { useState } from 'react';
import { UploadCloud, FileType, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { calculateDailyTimes } from '../utils/time';

export default function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processFile = async () => {
    if (!file) return;
    setProcessing(true);
    setResult(null);
    
    try {
      const text = await file.text();
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      // Expected header: email,date,check_in,check_out
      // Example: frederico@teste.com,2026-04-06,08:00,18:00
      
      const errors: string[] = [];
      let successCount = 0;

      // 1. Fetch all employees to map emails to IDs
      const { data: employees, error: empError } = await supabase.from('employees').select('id, email');
      if (empError) throw empError;

      const emailMap = new Map(employees?.map(e => [e.email.toLowerCase(), e.id]));

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const parts = line.split(',');
        if (parts.length < 3) {
          errors.push(`Linha ${i + 1}: Formato inválido.`);
          continue;
        }

        const [email, dateStr, checkInTime, checkOutTime] = parts.map(p => p.trim());
        
        const employeeId = emailMap.get(email.toLowerCase());
        if (!employeeId) {
          errors.push(`Linha ${i + 1}: E-mail não encontrado (${email}).`);
          continue;
        }

        // Format datetimes (assuming date is YYYY-MM-DD and times are HH:mm)
        const checkInIso = `${dateStr}T${checkInTime}:00`;
        const checkOutIso = checkOutTime ? `${dateStr}T${checkOutTime}:00` : null;

        let workedMinutes = 0, overtimeMinutes = 0, nightMinutes = 0;

        if (checkOutIso) {
          const times = calculateDailyTimes({ checkIn: checkInIso, checkOut: checkOutIso });
          workedMinutes = times.workedMinutes;
          overtimeMinutes = times.overtimeMinutes;
          nightMinutes = times.nightMinutes;
        }

        try {
          // Upsert based on employee_id and date
          const { error: insertError } = await supabase.from('time_records').upsert({
            employee_id: employeeId,
            date: dateStr,
            check_in: new Date(checkInIso).toISOString(),
            check_out: checkOutIso ? new Date(checkOutIso).toISOString() : null,
            worked_minutes: workedMinutes,
            overtime_minutes: overtimeMinutes,
            night_minutes: nightMinutes,
            source: 'imported'
          }, { onConflict: 'employee_id, date' });

          if (insertError) {
             errors.push(`Linha ${i + 1}: Erro do DB - ${insertError.message}`);
          } else {
             successCount++;
          }
        } catch (dbErr) {
           errors.push(`Linha ${i + 1}: Erro ao formatar data.`);
        }
      }

      setResult({ success: successCount, errors });

    } catch (e: any) {
      alert("Erro ao ler o arquivo: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Importar Registros em Lote</h1>
        <p className="text-muted-foreground">Importe o arquivo CSV para registrar as batidas de todos os funcionários automaticamente.</p>
      </div>

      <div 
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-upload')?.click()}
        className={`mt-8 border-2 border-dashed ${file ? 'border-primary bg-primary/5' : 'border-border bg-card'} hover:bg-muted/50 transition-colors rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer min-h-[250px]`}
      >
        <input 
          id="file-upload" 
          type="file" 
          accept=".csv,.txt"
          className="hidden" 
          onChange={handleFileChange}
        />
        
        {!file ? (
          <>
            <UploadCloud className="w-16 h-16 text-primary/60 mb-4" />
            <h3 className="font-semibold text-lg">Arraste e solte o arquivo aqui</h3>
            <p className="text-sm text-muted-foreground mt-2">ou clique para procurar no seu computador</p>
            <p className="text-xs text-muted-foreground mt-4 font-mono select-all">Formato esperado (CSV): email,data,entrada,saida</p>
          </>
        ) : (
          <>
            <FileType className="w-16 h-16 text-primary mb-4" />
            <h3 className="font-bold text-xl">{file.name}</h3>
            <p className="text-sm text-muted-foreground mt-2">{(file.size / 1024).toFixed(2)} KB</p>
            
            <button 
              disabled={processing}
              className="mt-8 bg-primary text-primary-foreground font-semibold px-8 py-3 rounded-full shadow hover:bg-primary/90 flex items-center disabled:opacity-70 disabled:cursor-wait"
              onClick={(e) => { e.stopPropagation(); processFile(); }}
            >
              {processing ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
              {processing ? 'Processando...' : 'Processar Arquivo'}
            </button>
          </>
        )}
      </div>

      {result && (
        <div className="bg-card border border-border shadow-sm rounded-xl p-6 mt-6">
          <h3 className="text-lg font-bold mb-4">Resultado da Importação</h3>
          <p className="text-primary font-medium">{result.success} registros importados com sucesso.</p>
          
          {result.errors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-destructive font-medium mb-2">{result.errors.length} erros encontrados:</p>
              <ul className="text-sm text-destructive/80 space-y-1 max-h-40 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="bg-destructive/10 border border-destructive/20 text-destructive/90 rounded-xl p-4 flex gap-3 mt-8">
        <AlertCircle className="w-6 h-6 shrink-0" />
        <div>
          <h4 className="font-semibold">Notas sobre a importação</h4>
          <p className="text-sm mt-1 opacity-90">O arquivo precisa ter um cabeçalho e ser no formato CSV. Exemplo de linha:<br/> <code>joao@empresa.com, 2026-03-20, 08:00, 18:00</code>. Linhas com e-mails não cadastrados no sistema serão ignoradas.</p>
        </div>
      </div>
    </div>
  );
}
