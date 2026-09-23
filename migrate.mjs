import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import * as fs from 'fs';

// Helper para ler .env.local se existir
const loadEnv = () => {
  const env = {};
  if (fs.existsSync('.env.local')) {
    const lines = fs.readFileSync('.env.local', 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return env;
};

const localEnv = loadEnv();

const sourceUrl = process.env.MIGRATE_SOURCE_URL || localEnv.MIGRATE_SOURCE_URL || '';
const sourceKey = process.env.MIGRATE_SOURCE_KEY || localEnv.MIGRATE_SOURCE_KEY || '';

const targetUrl = process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL || '';
const targetKey = process.env.VITE_SUPABASE_ANON_KEY || localEnv.VITE_SUPABASE_ANON_KEY || '';

if (!targetUrl || !targetKey) {
  console.error("Erro: Credenciais do Supabase de destino não encontradas em .env.local ou variáveis de ambiente.");
  process.exit(1);
}

const sourceDb = sourceUrl && sourceKey ? createClient(sourceUrl, sourceKey) : null;
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
