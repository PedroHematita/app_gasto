import { createClient } from '@supabase/supabase-js';
import type { GastoRecord, CompromissoRecord, CompromissoStatus, GastoPereneRecord, PeriodicidadePerene, StatusGastoPerene } from '../types';
import { requireFornecedorTrimmed } from '../utils';
import { listPeriodsDueThroughToday } from './gastosPerenePeriods';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function saveGasto(
  orgId: string,
  dataCompra: string,
  fornecedor: string,
  formaPagamento: string,
  meioPagamento: string,
  instituicaoFinanceira: string,
  observacoes: string,
  total: number,
  comprovanteUrl: string,
  parcelas: number | undefined,
  items: Array<{
    ordem: number;
    descricao: string;
    quantidade: number;
    unidade: string;
    valorCentavos: number;
  }>
) {
  if (!supabase) {
    console.warn('Supabase not configured. Data saved locally only.');
    return null;
  }

  // Parse date dd/mm/yyyy to yyyy-mm-dd
  const [d, m, y] = dataCompra.split('/');
  const dataISO = `${y}-${m}-${d}`;

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const fornecedorOk = requireFornecedorTrimmed(fornecedor);

  const { data: gasto, error: gastoError } = await supabase
    .from('gastos')
    .insert({
      user_id: user.id,
      org_id: orgId,
      data_compra: dataISO,
      fornecedor: fornecedorOk,
      forma_pagamento: formaPagamento,
      meio_pagamento: meioPagamento,
      instituicao_financeira: instituicaoFinanceira,
      observacoes: observacoes || null,
      total: total / 100,
      comprovante_url: comprovanteUrl || null,
      numero_parcelas: formaPagamento === 'a_vista' ? null : parcelas,
    })
    .select()
    .single();

  if (gastoError) throw gastoError;

  const itensData = items.map((item) => ({
    gasto_id: gasto.id,
    ordem: item.ordem,
    descricao_produto_servico: item.descricao,
    quantidade_adquirida: item.quantidade,
    unidade_medida: item.unidade,
    valor_total: item.valorCentavos / 100,
  }));

  const { error: itensError } = await supabase
    .from('itens_gasto')
    .insert(itensData);

  if (itensError) throw itensError;

  return gasto;
}

export async function uploadComprovante(
  userId: string,
  gastoId: string,
  file: File
): Promise<string> {
  if (!supabase) {
    console.warn('Supabase not configured.');
    return '';
  }

  const path = `${userId}/${gastoId}/comprovante.jpg`;
  const { error } = await supabase.storage
    .from('comprovantes')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('comprovantes').getPublicUrl(path);
  return data.publicUrl;
}

export async function searchDescricoes(orgId: string, query: string): Promise<{ label: string; payload: any }[]> {
  if (!supabase || query.length < 2) return [];

  const { data, error } = await supabase
    .from('itens_gasto')
    .select('descricao_produto_servico, unidade_medida, gastos!inner(org_id)')
    .eq('gastos.org_id', orgId)
    .ilike('descricao_produto_servico', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  // Deduplicate and return max 5
  const unique: { label: string; payload: any }[] = [];
  const seen = new Set<string>();

  for (const r of data) {
    const desc = r.descricao_produto_servico as string;
    if (!seen.has(desc)) {
      seen.add(desc);
      unique.push({ label: desc, payload: { unidade: r.unidade_medida } });
    }
  }

  return unique.slice(0, 5);
}

export async function checkUnidadeForDescricao(orgId: string, descricao: string): Promise<string | null> {
  if (!supabase || !descricao.trim()) return null;

  // Use % instead of spaces to catch spacing variations in the DB
  const queryDesc = descricao.trim().replace(/\s+/g, '%');

  const { data, error } = await supabase
    .from('itens_gasto')
    .select('descricao_produto_servico, unidade_medida, gastos!inner(org_id)')
    .eq('gastos.org_id', orgId)
    .ilike('descricao_produto_servico', `%${queryDesc}%`)
    .order('created_at', { ascending: false });

  if (error || !data) return null;

  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
  const normInput = normalize(descricao);

  for (const r of data) {
    if (normalize(r.descricao_produto_servico as string) === normInput) {
      return r.unidade_medida as string;
    }
  }

  return null;
}

export async function searchFornecedores(orgId: string, query: string): Promise<string[]> {
  if (!supabase || query.length < 2) return [];

  const { data, error } = await supabase
    .from('gastos')
    .select('fornecedor')
    .eq('org_id', orgId)
    .not('fornecedor', 'is', null)
    .ilike('fornecedor', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  const unique = [...new Set(data.map((r) => r.fornecedor as string).filter(Boolean))];
  return unique.slice(0, 5);
}

// Helper: convert ISO date to dd/mm/yyyy
function isoToBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Helper: convert dd/mm/yyyy to ISO
function brToISO(br: string): string {
  const [d, m, y] = br.split('/');
  return `${y}-${m}-${d}`;
}

// Fetch all gastos with items (for search across fornecedor AND item descriptions)
export async function fetchGastos(orgId: string): Promise<GastoRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('gastos')
    .select(`
      id, data_compra, fornecedor, forma_pagamento, meio_pagamento,
      instituicao_financeira, observacoes, total, comprovante_url, numero_parcelas, created_at,
      itens_gasto ( id, ordem, descricao_produto_servico, quantidade_adquirida, unidade_medida, valor_total, created_at )
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any, index: number) => ({
    id: row.id,
    seq: data.length - index,
    dataCompra: isoToBR(row.data_compra),
    fornecedor: row.fornecedor || '',
    formaPagamento: row.forma_pagamento || '',
    meioPagamento: row.meio_pagamento || '',
    instituicaoFinanceira: row.instituicao_financeira || '',
    observacoes: row.observacoes || '',
    total: Math.round((row.total || 0) * 100),
    comprovanteUrl: row.comprovante_url || '',
    parcelas: row.numero_parcelas || undefined,
    createdAt: row.created_at,
    items: (row.itens_gasto || [])
      .sort((a: any, b: any) => a.ordem - b.ordem)
      .map((item: any) => ({
        id: item.id,
        ordem: item.ordem,
        descricao: item.descricao_produto_servico,
        quantidade: item.quantidade_adquirida,
        unidade: item.unidade_medida,
        valorCentavos: Math.round((item.valor_total || 0) * 100),
      })),
  }));
}

// Fetch single gasto by ID
export async function fetchGastoById(gastoId: string): Promise<GastoRecord | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('gastos')
    .select(`
      id, data_compra, fornecedor, forma_pagamento, meio_pagamento,
      instituicao_financeira, observacoes, total, comprovante_url, numero_parcelas, created_at,
      itens_gasto ( id, ordem, descricao_produto_servico, quantidade_adquirida, unidade_medida, valor_total, created_at )
    `)
    .eq('id', gastoId)
    .single();

  if (error || !data) return null;

  // Get seq number
  const { count } = await supabase
    .from('gastos')
    .select('id', { count: 'exact', head: true })
    .lte('created_at', data.created_at);

  return {
    id: data.id,
    seq: count || 1,
    dataCompra: isoToBR(data.data_compra),
    fornecedor: data.fornecedor || '',
    formaPagamento: data.forma_pagamento || '',
    meioPagamento: data.meio_pagamento || '',
    instituicaoFinanceira: data.instituicao_financeira || '',
    observacoes: data.observacoes || '',
    total: Math.round((data.total || 0) * 100),
    comprovanteUrl: data.comprovante_url || '',
    parcelas: data.numero_parcelas || undefined,
    createdAt: data.created_at,
    items: ((data as any).itens_gasto || [])
      .sort((a: any, b: any) => a.ordem - b.ordem)
      .map((item: any) => ({
        id: item.id,
        ordem: item.ordem,
        descricao: item.descricao_produto_servico,
        quantidade: item.quantidade_adquirida,
        unidade: item.unidade_medida,
        valorCentavos: Math.round((item.valor_total || 0) * 100),
      })),
  };
}

// Update existing gasto — preserves comprovante_url if no new file provided
export async function updateGasto(
  gastoId: string,
  dataCompra: string,
  fornecedor: string,
  formaPagamento: string,
  meioPagamento: string,
  instituicaoFinanceira: string,
  observacoes: string,
  total: number,
  newComprovanteUrl: string | null, // null = keep existing
  parcelas: number | undefined,
  items: Array<{
    ordem: number;
    descricao: string;
    quantidade: number;
    unidade: string;
    valorCentavos: number;
  }>
) {
  if (!supabase) return null;

  const fornecedorOk = requireFornecedorTrimmed(fornecedor);

  const updateData: any = {
    data_compra: brToISO(dataCompra),
    fornecedor: fornecedorOk,
    forma_pagamento: formaPagamento,
    meio_pagamento: meioPagamento,
    instituicao_financeira: instituicaoFinanceira,
    observacoes: observacoes || null,
    total: total / 100,
    numero_parcelas: formaPagamento === 'a_vista' ? null : parcelas,
  };

  // Only update comprovante_url if a new file was provided
  if (newComprovanteUrl !== null) {
    updateData.comprovante_url = newComprovanteUrl || null;
  }

  const { error: gastoError } = await supabase
    .from('gastos')
    .update(updateData)
    .eq('id', gastoId);

  if (gastoError) throw gastoError;

  // Delete old items and insert new ones
  const { error: deleteError } = await supabase
    .from('itens_gasto')
    .delete()
    .eq('gasto_id', gastoId);

  if (deleteError) throw deleteError;

  const itensData = items.map((item) => ({
    gasto_id: gastoId,
    ordem: item.ordem,
    descricao_produto_servico: item.descricao,
    quantidade_adquirida: item.quantidade,
    unidade_medida: item.unidade,
    valor_total: item.valorCentavos / 100,
  }));

  const { error: itensError } = await supabase
    .from('itens_gasto')
    .insert(itensData);

  if (itensError) throw itensError;

  return { id: gastoId };
}

// Price history for a specific description
export interface PriceHistoryRecord {
  data: string;       // dd/mm/yyyy
  fornecedor: string;
  valorCentavos: number;
  quantidade: number;
  unidade: string;
  valorUnitarioCentavos: number;
}

export async function fetchPriceHistory(orgId: string, descricao: string, unidade: string): Promise<PriceHistoryRecord[]> {
  if (!supabase || !descricao.trim() || !unidade) return [];

  // Query itens_gasto with their parent gasto for date and fornecedor
  const { data, error } = await supabase
    .from('itens_gasto')
    .select(`
      valor_total,
      quantidade_adquirida,
      unidade_medida,
      created_at,
      gastos!inner ( data_compra, fornecedor, org_id )
    `)
    .eq('gastos.org_id', orgId)
    .ilike('descricao_produto_servico', descricao.trim())
    .eq('unidade_medida', unidade)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  // Filter out records with 0 quantity to avoid division by zero
  const validData = data.filter((r: any) => Number(r.quantidade_adquirida) > 0);

  return validData.map((row: any) => {
    const qty = Number(row.quantidade_adquirida);
    const totalCents = Math.round((row.valor_total || 0) * 100);
    return {
      data: isoToBR(row.gastos.data_compra),
      fornecedor: row.gastos.fornecedor || '',
      valorCentavos: totalCents,
      quantidade: qty,
      unidade: row.unidade_medida,
      valorUnitarioCentavos: Math.round(totalCents / qty),
    };
  });
}

// ----- Compromissos financeiros -----

function effectiveStatusFromPrevistaISO(iso: string): 'pendente' | 'vencido' {
  const [y, m, d] = iso.split('-').map(Number);
  const prev = new Date(y, m - 1, d);
  prev.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return prev < today ? 'vencido' : 'pendente';
}

function mapCompromissoRow(row: any): CompromissoRecord {
  const items = ((row.compromisso_itens || []) as any[])
    .sort((a: any, b: any) => a.ordem - b.ordem)
    .map((item: any) => ({
      id: item.id,
      ordem: item.ordem,
      descricao: item.descricao_produto_servico,
      quantidade: item.quantidade_adquirida,
      unidade: item.unidade_medida,
      valorCentavos: Math.round((item.valor_total || 0) * 100),
    }));

  const total = items.reduce((s, i) => s + i.valorCentavos, 0);

  return {
    id: row.id,
    dataCompra: isoToBR(row.data_compra),
    dataPrevistaPagamento: isoToBR(row.data_prevista_pagamento),
    fornecedor: row.fornecedor || '',
    status: row.status as CompromissoStatus,
    total,
    createdAt: row.created_at,
    gastoId: row.gasto_id || null,
    gastoPereneId: row.gasto_perene_id || null,
    competenciaChave: row.competencia_chave || null,
    items,
  };
}

/** Atualiza pendente ↔ vencido conforme data prevista (não altera quitado/cancelado). */
export async function syncCompromissosStatus(orgId: string): Promise<void> {
  if (!supabase) return;

  const { data: rows, error } = await supabase
    .from('compromissos')
    .select('id, status, data_prevista_pagamento')
    .eq('org_id', orgId)
    .in('status', ['pendente', 'vencido']);

  if (error || !rows?.length) return;

  for (const row of rows) {
    const expected = effectiveStatusFromPrevistaISO(row.data_prevista_pagamento as string);
    if (expected !== row.status) {
      await supabase.from('compromissos').update({ status: expected }).eq('id', row.id);
    }
  }
}

export async function fetchCompromissosAtivos(orgId: string): Promise<CompromissoRecord[]> {
  if (!supabase) return [];

  await syncCompromissosStatus(orgId);

  const { data, error } = await supabase
    .from('compromissos')
    .select(`
      id, data_compra, data_prevista_pagamento, fornecedor, status, created_at, gasto_id, gasto_perene_id, competencia_chave,
      compromisso_itens ( id, ordem, descricao_produto_servico, quantidade_adquirida, unidade_medida, valor_total )
    `)
    .eq('org_id', orgId)
    .in('status', ['pendente', 'vencido']);

  if (error || !data) return [];

  const records = data.map(mapCompromissoRow);

  const byPrevista = (a: CompromissoRecord, b: CompromissoRecord) =>
    brToISO(a.dataPrevistaPagamento).localeCompare(brToISO(b.dataPrevistaPagamento));

  const vencidos = records.filter((c) => c.status === 'vencido').sort(byPrevista);

  const pendentes = records.filter((c) => c.status === 'pendente').sort(byPrevista);

  return [...vencidos, ...pendentes];
}

export async function fetchCompromissoIndicatorCounts(orgId: string): Promise<{ vencidos: number; pendentes: number }> {
  const list = await fetchCompromissosAtivos(orgId);
  let vencidos = 0;
  let pendentes = 0;
  for (const c of list) {
    if (c.status === 'vencido') vencidos++;
    else if (c.status === 'pendente') pendentes++;
  }
  return { vencidos, pendentes };
}

export async function fetchCompromissoById(compromissoId: string): Promise<CompromissoRecord | null> {
  if (!supabase) return null;

  // syncCompromissosStatus is called by the caller if needed

  const { data, error } = await supabase
    .from('compromissos')
    .select(`
      id, data_compra, data_prevista_pagamento, fornecedor, status, created_at, gasto_id, gasto_perene_id, competencia_chave,
      compromisso_itens ( id, ordem, descricao_produto_servico, quantidade_adquirida, unidade_medida, valor_total )
    `)
    .eq('id', compromissoId)
    .single();

  if (error || !data) return null;

  return mapCompromissoRow(data);
}

export async function saveCompromisso(
  orgId: string,
  dataCompraBR: string,
  dataPrevistaBR: string,
  fornecedor: string,
  items: Array<{
    ordem: number;
    descricao: string;
    quantidade: number;
    unidade: string;
    valorCentavos: number;
  }>
): Promise<string | null> {
  if (!supabase) {
    console.warn('Supabase not configured.');
    return null;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const fornecedorOk = requireFornecedorTrimmed(fornecedor);

  const prevISO = brToISO(dataPrevistaBR);
  const statusInicial = effectiveStatusFromPrevistaISO(prevISO);

  const { data: row, error } = await supabase
    .from('compromissos')
    .insert({
      user_id: user.id,
      org_id: orgId,
      data_compra: brToISO(dataCompraBR),
      data_prevista_pagamento: prevISO,
      fornecedor: fornecedorOk,
      status: statusInicial,
    })
    .select('id')
    .single();

  if (error || !row) throw error;

  const itensData = items.map((item) => ({
    compromisso_id: row.id,
    ordem: item.ordem,
    descricao_produto_servico: item.descricao,
    quantidade_adquirida: item.quantidade,
    unidade_medida: item.unidade,
    valor_total: item.valorCentavos / 100,
  }));

  const { error: itensError } = await supabase.from('compromisso_itens').insert(itensData);

  if (itensError) throw itensError;

  return row.id as string;
}

export async function cancelCompromisso(compromissoId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { error } = await supabase
    .from('compromissos')
    .update({ status: 'cancelado' })
    .eq('id', compromissoId);

  if (error) throw error;
}

export async function linkCompromissoQuitado(compromissoId: string, gastoId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { error } = await supabase
    .from('compromissos')
    .update({ status: 'quitado', gasto_id: gastoId })
    .eq('id', compromissoId);

  if (error) throw error;
}

// ----- Gastos perenes -----

function mapGastoPereneRow(row: any): GastoPereneRecord {
  return {
    id: row.id,
    fornecedor: row.fornecedor || '',
    valorPrevistoCents: Math.round((Number(row.valor_previsto) || 0) * 100),
    periodicidade: row.periodicidade as PeriodicidadePerene,
    diaVencimento: Number(row.dia_vencimento),
    mesVencimento: row.mes_vencimento != null ? Number(row.mes_vencimento) : null,
    dataInicio: isoToBR(row.data_inicio),
    dataTermino: row.data_termino ? isoToBR(row.data_termino) : null,
    observacoes: row.observacoes || '',
    status: row.status as StatusGastoPerene,
    createdAt: row.created_at,
  };
}

export async function fetchGastosPerenesAtivos(orgId: string): Promise<GastoPereneRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('gastos_perenes')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'ativo')
    .order('fornecedor', { ascending: true });

  if (error || !data) return [];
  return data.map(mapGastoPereneRow);
}

export async function fetchGastoPereneById(id: string): Promise<GastoPereneRecord | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('gastos_perenes')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) return null;
  return mapGastoPereneRow(data);
}

export async function createGastoPerene(orgId: string, payload: {
  fornecedor: string;
  valorPrevistoCents: number;
  periodicidade: PeriodicidadePerene;
  diaVencimento: number;
  mesVencimento: number | null;
  dataInicioBR: string;
  dataTerminoBR: string | null;
  observacoes: string;
}): Promise<string | null> {
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuário não autenticado');

  const fornecedorOk = requireFornecedorTrimmed(payload.fornecedor);

  const mesDb =
    payload.periodicidade === 'anual'
      ? payload.mesVencimento
      : null;

  const { data: row, error } = await supabase
    .from('gastos_perenes')
    .insert({
      user_id: user.id,
      org_id: orgId,
      fornecedor: fornecedorOk,
      valor_previsto: payload.valorPrevistoCents / 100,
      periodicidade: payload.periodicidade,
      dia_vencimento: payload.diaVencimento,
      mes_vencimento: mesDb,
      data_inicio: brToISO(payload.dataInicioBR),
      data_termino: payload.dataTerminoBR ? brToISO(payload.dataTerminoBR) : null,
      observacoes: payload.observacoes.trim() || null,
      status: 'ativo',
    })
    .select('id')
    .single();

  if (error || !row) throw error;
  return row.id as string;
}

export async function updateGastoPereneEdicao(
  id: string,
  patch: {
    valorPrevistoCents: number;
    diaVencimento: number;
    mesVencimento: number | null;
    observacoes: string;
  }
): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');

  const current = await fetchGastoPereneById(id);
  if (!current) throw new Error('Gasto perene não encontrado');

  const mesDb =
    current.periodicidade === 'anual'
      ? patch.mesVencimento
      : null;

  const { error } = await supabase
    .from('gastos_perenes')
    .update({
      valor_previsto: patch.valorPrevistoCents / 100,
      dia_vencimento: patch.diaVencimento,
      mes_vencimento: mesDb,
      observacoes: patch.observacoes.trim() || null,
    })
    .eq('id', id);

  if (error) throw error;
}

export async function encerrarGastoPerene(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado');

  const { error } = await supabase
    .from('gastos_perenes')
    .update({ status: 'encerrado' })
    .eq('id', id);

  if (error) throw error;
}

export async function fetchCompromissosByGastoPereneId(orgId: string, gastoPereneId: string): Promise<CompromissoRecord[]> {
  if (!supabase) return [];

  await syncCompromissosStatus(orgId);

  const { data, error } = await supabase
    .from('compromissos')
    .select(`
      id, data_compra, data_prevista_pagamento, fornecedor, status, created_at, gasto_id, gasto_perene_id, competencia_chave,
      compromisso_itens ( id, ordem, descricao_produto_servico, quantidade_adquirida, unidade_medida, valor_total )
    `)
    .eq('gasto_perene_id', gastoPereneId)
    .order('data_prevista_pagamento', { ascending: false });

  if (error || !data) return [];
  return data.map(mapCompromissoRow);
}

async function insertCompromissoGerado(input: {
  userId: string;
  orgId: string;
  fornecedor: string;
  valorCentavos: number;
  dataCompraISO: string;
  dataPrevistaISO: string;
  gastoPereneId: string;
  competenciaChave: string;
}): Promise<void> {
  if (!supabase) return;

  const statusInicial = effectiveStatusFromPrevistaISO(input.dataPrevistaISO);

  const { data: row, error } = await supabase
    .from('compromissos')
    .insert({
      user_id: input.userId,
      org_id: input.orgId,
      data_compra: input.dataCompraISO,
      data_prevista_pagamento: input.dataPrevistaISO,
      fornecedor: input.fornecedor,
      status: statusInicial,
      gasto_perene_id: input.gastoPereneId,
      competencia_chave: input.competenciaChave,
    })
    .select('id')
    .single();

  if (error || !row) throw error;

  const { error: itensError } = await supabase.from('compromisso_itens').insert({
    compromisso_id: row.id,
    ordem: 1,
    descricao_produto_servico: input.fornecedor || 'Gasto perene',
    quantidade_adquirida: 1,
    unidade_medida: 'Contrato',
    valor_total: input.valorCentavos / 100,
  });

  if (itensError) throw itensError;
}

export async function ensureCompromissosFromGastosPerenes(orgId: string): Promise<void> {
  if (!supabase) return;

  await syncCompromissosStatus(orgId);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: perenes, error } = await supabase
    .from('gastos_perenes')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'ativo');

  if (error || !perenes?.length) return;

  const today = new Date();

  for (const row of perenes) {
    const dataInicio = new Date(row.data_inicio as string);
    const dataTermino = row.data_termino ? new Date(row.data_termino as string) : null;

    const periods = listPeriodsDueThroughToday(
      {
        periodicidade: row.periodicidade as PeriodicidadePerene,
        diaVencimento: Number(row.dia_vencimento),
        mesVencimento: row.mes_vencimento != null ? Number(row.mes_vencimento) : null,
        dataInicio,
        dataTermino,
      },
      today
    );

    const valorCentavos = Math.round((Number(row.valor_previsto) || 0) * 100);
    const fornecedorOk = (row.fornecedor as string) || 'Gasto perene';

    for (const p of periods) {
      const { data: existing } = await supabase
        .from('compromissos')
        .select('id')
        .eq('gasto_perene_id', row.id)
        .eq('competencia_chave', p.competenciaChave)
        .maybeSingle();

      if (existing) continue;

      await insertCompromissoGerado({
        userId: user.id,
        orgId,
        fornecedor: fornecedorOk,
        valorCentavos,
        dataCompraISO: p.dataCompraISO,
        dataPrevistaISO: p.dataPrevistaISO,
        gastoPereneId: row.id as string,
        competenciaChave: p.competenciaChave,
      });
    }
  }
}

// =========================================================================
// ADMIN FUNCTIONS
// =========================================================================

export async function adminFetchOrgs() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('organizacoes')
    .select(`
      id,
      nome,
      created_at,
      organizacao_membros ( count )
    `)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((org: any) => ({
    id: org.id,
    nome: org.nome,
    createdAt: org.created_at,
    memberCount: org.organizacao_membros[0]?.count || 0,
  }));
}

export async function adminFetchUsers() {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('admin_get_all_users');
  if (error || !data) return [];
  return data;
}

export async function adminSearchUserByEmail(email: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('admin_search_user_by_email', { p_email: email });
  if (error || !data || data.length === 0) return null;
  return data[0];
}

export async function adminFetchLinks() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('organizacao_membros')
    .select(`
      id,
      org_id,
      user_id,
      role,
      created_at,
      organizacoes ( nome )
    `)
    .order('created_at', { ascending: false });
    
  if (error || !data) return [];
  return data;
}

export async function adminCreateOrg(nome: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('organizacoes')
    .insert({ nome })
    .select('id, nome, created_at')
    .single();

  if (error) {
    console.error('Error creating org:', error);
    return null;
  }
  return data;
}

export async function adminLinkUserToOrg(userId: string, orgId: string, role: 'owner' | 'member') {
  if (!supabase) return false;
  const { error } = await supabase
    .from('organizacao_membros')
    .insert({ user_id: userId, org_id: orgId, role });

  if (error) {
    console.error('Error linking user to org:', error);
    return false;
  }
  return true;
}

export async function adminUnlinkUser(linkId: string) {
  if (!supabase) return false;
  const { error } = await supabase
    .from('organizacao_membros')
    .delete()
    .eq('id', linkId);

  if (error) {
    console.error('Error unlinking user:', error);
    return false;
  }
  return true;
}
