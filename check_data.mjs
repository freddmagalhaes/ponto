import { createClient } from '@supabase/supabase-js';

const sourceUrl = 'https://yldmtlllltmvqlcefzbb.supabase.co';
const sourceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsZG10bGxsbHRtdnFsY2VmemJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDAxOTgsImV4cCI6MjA2NDI3NjE5OH0.K-zfje0wQOe1BPnPrYotRxdSy_x5Oh_sj3L81hFFnx8';
const sourceDb = createClient(sourceUrl, sourceKey);

async function checkData() {
  const { data } = await sourceDb
    .from('registros_horas')
    .select('*')
    .order('data_trabalho', { ascending: true });

  console.log('Returned length:', data?.length);
}

checkData();
