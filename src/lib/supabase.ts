import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export async function saveGasto(
  dataCompra: string,
  fornecedor: string,
  formaPagamento: string,
  meioPagamento: string,
  instituicaoFinanceira: string,
  observacoes: string,
  total: number,
  comprovanteUrl: string,
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

  const { data: gasto, error: gastoError } = await supabase
    .from('gastos')
    .insert({
      user_id: user.id,
      data_compra: dataISO,
      fornecedor: fornecedor || null,
      forma_pagamento: formaPagamento,
      meio_pagamento: meioPagamento,
      instituicao_financeira: instituicaoFinanceira,
      observacoes: observacoes || null,
      total: total / 100,
      comprovante_url: comprovanteUrl || null,
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

export async function searchDescricoes(query: string): Promise<string[]> {
  if (!supabase || query.length < 2) return [];

  const { data, error } = await supabase
    .from('itens_gasto')
    .select('descricao_produto_servico')
    .ilike('descricao_produto_servico', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error || !data) return [];

  // Deduplicate and return max 5
  const unique = [...new Set(data.map((r) => r.descricao_produto_servico as string))];
  return unique.slice(0, 5);
}

export async function searchFornecedores(query: string): Promise<string[]> {
  if (!supabase || query.length < 2) return [];

  const { data, error } = await supabase
    .from('gastos')
    .select('fornecedor')
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

import type { GastoRecord } from '../types';

// Fetch all gastos with items (for search across fornecedor AND item descriptions)
export async function fetchGastos(): Promise<GastoRecord[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('gastos')
    .select(`
      id, data_compra, fornecedor, forma_pagamento, meio_pagamento,
      instituicao_financeira, observacoes, total, comprovante_url, created_at,
      itens_gasto ( id, ordem, descricao_produto_servico, quantidade_adquirida, unidade_medida, valor_total, created_at )
    `)
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
      instituicao_financeira, observacoes, total, comprovante_url, created_at,
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
  items: Array<{
    ordem: number;
    descricao: string;
    quantidade: number;
    unidade: string;
    valorCentavos: number;
  }>
) {
  if (!supabase) return null;

  const updateData: any = {
    data_compra: brToISO(dataCompra),
    fornecedor: fornecedor || null,
    forma_pagamento: formaPagamento,
    meio_pagamento: meioPagamento,
    instituicao_financeira: instituicaoFinanceira,
    observacoes: observacoes || null,
    total: total / 100,
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
}

export async function fetchPriceHistory(descricao: string): Promise<PriceHistoryRecord[]> {
  if (!supabase || !descricao.trim()) return [];

  // Query itens_gasto with their parent gasto for date and fornecedor
  const { data, error } = await supabase
    .from('itens_gasto')
    .select(`
      valor_total,
      created_at,
      gastos!inner ( data_compra, fornecedor )
    `)
    .ilike('descricao_produto_servico', descricao.trim())
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => ({
    data: isoToBR(row.gastos.data_compra),
    fornecedor: row.gastos.fornecedor || '',
    valorCentavos: Math.round((row.valor_total || 0) * 100),
  }));
}
