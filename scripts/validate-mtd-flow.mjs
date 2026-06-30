import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = {};
  try {
    const raw = readFileSync('.env', 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  } catch {
    /* ignore */
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL;
const anonKey = env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.log('VALIDATE: SKIP — sem VITE_SUPABASE_URL/ANON_KEY');
  process.exit(0);
}

const ITEM_MTD_COLS =
  'id,gasto_id,direcionamento_mtd,classificacao_geral_mtd,natureza_mtd_raiz,natureza_mtd_caminho,mtd_status,mtd_classificado_em,mtd_classificado_por';

const GASTO_RESUMO_COLS = 'id,org_id,tipo_gasto,mtd_status';

async function probe(client, label) {
  const { data, error } = await client.from('itens_gasto').select(ITEM_MTD_COLS).limit(5);
  if (error) {
    console.log(`VALIDATE: ${label} SELECT itens_gasto MTD — ERRO`, error.code, error.message);
    return { ok: false };
  }
  console.log(`VALIDATE: ${label} SELECT itens_gasto MTD — OK (${(data || []).length} linha(s) na amostra)`);
  return { ok: true, rows: data || [] };
}

async function probeGastosResumo(client, label) {
  const { data, error } = await client
    .from('gastos')
    .select(GASTO_RESUMO_COLS)
    .eq('tipo_gasto', 'Empresarial')
    .limit(5);
  if (error) {
    console.log(`VALIDATE: ${label} SELECT gastos mtd_status — ERRO`, error.code, error.message);
    return;
  }
  console.log(`VALIDATE: ${label} SELECT gastos mtd_status — OK`);
  if (data?.length) {
    console.log('  amostra:', JSON.stringify(data[0]));
  }
}

console.log('=== Validação MTD por item — Supabase remoto ===\n');
console.log('Migration obrigatória: supabase/migrations/20260626_itens_gasto_mtd.sql\n');

const anon = createClient(url, anonKey);
await probe(anon, 'anon');
await probeGastosResumo(anon, 'anon');

console.log('\n--- SQL para conferir após migration ---');
console.log(`
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'itens_gasto'
  AND column_name LIKE '%mtd%'
ORDER BY column_name;

SELECT mtd_status, count(*) FROM public.gastos
WHERE tipo_gasto = 'Empresarial' GROUP BY mtd_status;

SELECT mtd_status, count(*) FROM public.itens_gasto ig
JOIN public.gastos g ON g.id = ig.gasto_id
WHERE g.tipo_gasto = 'Empresarial' GROUP BY mtd_status;
`);
