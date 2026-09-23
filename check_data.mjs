import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

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

if (!sourceUrl || !sourceKey) {
  console.log('Credenciais de origem não configuradas em MIGRATE_SOURCE_URL / MIGRATE_SOURCE_KEY.');
  process.exit(0);
}

const sourceDb = createClient(sourceUrl, sourceKey);

async function checkData() {
  const { data } = await sourceDb
    .from('registros_horas')
    .select('*')
    .order('data_trabalho', { ascending: true });

  console.log('Returned length:', data?.length);
}

checkData();
