import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const sourceUrl = 'https://yldmtlllltmvqlcefzbb.supabase.co';
const sourceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsZG10bGxsbHRtdnFsY2VmemJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDAxOTgsImV4cCI6MjA2NDI3NjE5OH0.K-zfje0wQOe1BPnPrYotRxdSy_x5Oh_sj3L81hFFnx8';
const sourceDb = createClient(sourceUrl, sourceKey);

const targetUrl = 'https://eoumoxxthmvtudljrldt.supabase.co';
const targetKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVvdW1veHh0aG12dHVkbGpybGR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjIyMzcsImV4cCI6MjA5MDM5ODIzN30.4QghenJaHUiRD1e0nO3OO4qKbHnEIqGPVN7Kc9Ec96o';
const targetDb = createClient(targetUrl, targetKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function runMigration() {
  console.log('--- Migração do manager-hours para ponto ---');
  
  // 1. Authenticate in target database
  console.log('\nPara inserir os dados com segurança no novo sistema, preciso que você faça login:');
  const email = await question('E-mail (novo app ponto): ');
  const password = await question('Senha: ');

  console.log('\nAutenticando...');
  const { data: authData, error: authError } = await targetDb.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error('Erro de autenticação:', authError.message);
    rl.close();
    return;
  }

  const userId = authData.user.id;
  console.log(`Login com sucesso! Seu ID no novo sistema é: ${userId}`);

  // 2. Fetch data from source
  console.log('\nBuscando registros no manager-hours...');
  const { data: sourceRecords, error: sourceError } = await sourceDb
    .from('registros_horas')
    .select('*')
    .order('data_trabalho', { ascending: true });

  if (sourceError) {
    console.error('Erro ao buscar registros na origem:', sourceError.message);
    rl.close();
    return;
  }

  console.log(`Encontrados ${sourceRecords.length} registros para migrar.`);

  // 3. Transform and Insert Data
  let successCount = 0;
  let errorCount = 0;

  for (const record of sourceRecords) {
    try {
      // Create valid timestamps by combining date and time
      const checkIn = new Date(`${record.data_trabalho}T${record.hora_entrada}-03:00`);
      const checkOut = record.hora_saida ? new Date(`${record.data_trabalho}T${record.hora_saida}-03:00`) : null;

      // Calculate minutes
      const workedMinutes = Math.round(Number(record.horas_normais || 0) * 60);
      const overtimeMinutes = Math.round(Number(record.horas_extras || 0) * 60);
      const nightMinutes = Math.round(Number(record.adicional_noturno || 0) * 60);

      const newRecord = {
        employee_id: userId,
        date: record.data_trabalho,
        check_in: checkIn.toISOString(),
        check_out: checkOut ? checkOut.toISOString() : null,
        worked_minutes: workedMinutes,
        overtime_minutes: overtimeMinutes,
        night_minutes: nightMinutes,
        source: 'imported'
      };

      const { error: insertError } = await targetDb
        .from('time_records')
        .insert(newRecord);

      if (insertError) {
        // Ignorar erros de violação de chave única se os dados já foram inseridos antes
        if (insertError.code === '23505') {
           console.log(`Pular: O dia ${record.data_trabalho} já possui registro.`);
        } else {
           console.error(`Erro ao inserir o dia ${record.data_trabalho}:`, insertError.message);
           errorCount++;
        }
      } else {
        successCount++;
      }
    } catch (e) {
      console.error(`Erro ao processar o dia ${record.data_trabalho}:`, e);
      errorCount++;
    }
  }

  console.log(`\n--- Migração Concluída ---`);
  console.log(`Sucesso: ${successCount}`);
  console.log(`Erros: ${errorCount}`);
  
  rl.close();
}

runMigration();
