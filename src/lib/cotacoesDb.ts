import type { CotacaoListCard, CotacaoPrecoRow, CotacaoRecord } from '../types';
import { normalizeDescricao } from '../utils';
import { supabase } from './supabase';

/** Mensagens fixas (produto já existe com outra unidade). */
export const MSG_COTACAO_UNIDADE_EXISTENTE = (unidade: string) =>
  `Este produto já está cadastrado com a unidade ${unidade}. Use a mesma unidade para manter a comparação de preços consistente. Se precisar comparar com outra unidade, use uma descrição diferente.`;

export const MSG_PRECO_INVALIDO = 'Informe um valor válido antes de salvar.';
export const MSG_FORNECEDOR_PRECO_OBRIGATORIO = 'Informe o fornecedor antes de salvar.';
export const MSG_DUPLICATA_PRECO =
  'Já existe um preço registrado para este fornecedor nesta data. Deseja substituir ou adicionar mesmo assim?';

function isoToBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function brToISO(br: string): string {
  const [d, m, y] = br.split('/');
  return `${y}-${m}-${d}`;
}

function reaisToCentavos(v: number): number {
  return Math.round(Number(v) * 100);
}

export function fornecedorIgual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Pontuação para ordenação por data BR */
export function compareDataBR(a: string, b: string): number {
  const da = a.split('/').map(Number);
  const db = b.split('/').map(Number);
  const ta = new Date(da[2], da[1] - 1, da[0]).getTime();
  const tb = new Date(db[2], db[1] - 1, db[0]).getTime();
  return ta - tb;
}

/** Preço unitário (centavos) para uma observação: valor total / quantidade da cotação */
export function valorUnitarioCentavos(valorTotalCentavos: number, quantidadeCotacao: number): number {
  const q = Number(quantidadeCotacao);
  if (!q || q <= 0) return 0;
  return Math.round(valorTotalCentavos / q);
}

/** Stats sobre observações filtradas (preços já restritos ao filtro). */
export function statsPrecosUnitarios(unitCentavos: number[]): {
  min: number | null;
  max: number | null;
  avg: number | null;
  diff: number | null;
} {
  const vals = unitCentavos.filter((u) => u > 0);
  if (vals.length === 0) return { min: null, max: null, avg: null, diff: null };
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const sum = vals.reduce((s, v) => s + v, 0);
  const avg = Math.round(sum / vals.length);
  const diff = max - min;
  return { min, max, avg, diff };
}

function mapCotacaoRow(row: {
  id: string;
  org_id: string;
  descricao: string;
  quantidade: string | number;
  unidade_medida: string;
  created_at: string;
}): CotacaoRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    descricao: row.descricao,
    quantidade: Number(row.quantidade),
    unidadeMedida: row.unidade_medida,
    createdAt: row.created_at,
  };
}

function mapPrecoRow(row: {
  id: string;
  fornecedor: string;
  valor: string | number;
  data_registro: string;
  created_at: string;
}): CotacaoPrecoRow {
  return {
    id: row.id,
    fornecedor: row.fornecedor,
    valorCentavos: reaisToCentavos(Number(row.valor)),
    dataRegistroBR: isoToBR(row.data_registro),
    createdAtISO: row.created_at,
  };
}

/** Busca produtos já cadastrados — filtro em `descricao_normalizada`. */
export async function searchDescricoesCotacao(orgId: string, query: string): Promise<string[]> {
  if (!supabase) return [];
  const norm = normalizeDescricao(query);
  if (norm.length < 2) return [];

  const { data, error } = await supabase
    .from('cotacoes')
    .select('descricao, descricao_normalizada')
    .eq('org_id', orgId)
    .ilike('descricao_normalizada', `%${norm}%`)
    .order('created_at', { ascending: false })
    .limit(40);

  if (error || !data) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of data) {
    const key = (r as { descricao_normalizada: string }).descricao_normalizada;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push((r as { descricao: string }).descricao);
    if (out.length >= 8) break;
  }
  return out;
}

/** Outra cotação na org já usa esta descrição normalizada (para mensagem de unidade). */
export async function fetchCotacaoPorDescricaoNormalizada(
  orgId: string,
  descricaoBruta: string,
  excludeId?: string
): Promise<CotacaoRecord | null> {
  if (!supabase) return null;
  const norm = normalizeDescricao(descricaoBruta);
  if (!norm) return null;

  let qb = supabase
    .from('cotacoes')
    .select('id, org_id, descricao, quantidade, unidade_medida, created_at')
    .eq('org_id', orgId)
    .eq('descricao_normalizada', norm);

  if (excludeId) qb = qb.neq('id', excludeId);

  const { data, error } = await qb.maybeSingle();

  if (error || !data) return null;
  return mapCotacaoRow(data as Parameters<typeof mapCotacaoRow>[0]);
}

export async function fetchCotacoesList(orgId: string, searchRaw: string): Promise<CotacaoListCard[]> {
  if (!supabase) return [];

  let qb = supabase
    .from('cotacoes')
    .select('id, descricao, quantidade, unidade_medida, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  const sn = normalizeDescricao(searchRaw);
  if (sn.length > 0) {
    qb = qb.ilike('descricao_normalizada', `%${sn}%`);
  }

  const { data: cotacoes, error } = await qb;
  if (error || !cotacoes?.length) return [];

  const ids = cotacoes.map((c: { id: string }) => c.id);
  const { data: precos } = await supabase
    .from('cotacao_precos')
    .select('cotacao_id, fornecedor, valor, created_at')
    .in('cotacao_id', ids);

  const byCotacao = new Map<
    string,
    { rows: { fornecedor: string; valor: number; created_at: string }[] }
  >();
  for (const id of ids) byCotacao.set(id, { rows: [] });
  for (const p of precos || []) {
    const row = p as {
      cotacao_id: string;
      fornecedor: string;
      valor: string | number;
      created_at: string;
    };
    const bucket = byCotacao.get(row.cotacao_id);
    if (!bucket) continue;
    bucket.rows.push({
      fornecedor: row.fornecedor,
      valor: Number(row.valor),
      created_at: row.created_at,
    });
  }

  return cotacoes.map((c: { id: string; descricao: string; quantidade: number | string; unidade_medida: string; created_at: string }) => {
    const qtd = Number(c.quantidade);
    const bucket = byCotacao.get(c.id)?.rows ?? [];
    let menorUnit: number | null = null;
    let fornecedorMenor: string | null = null;
    let ultima = c.created_at;

    for (const r of bucket) {
      const unitCents = valorUnitarioCentavos(reaisToCentavos(r.valor), qtd);
      if (menorUnit === null || unitCents < menorUnit) {
        menorUnit = unitCents;
        fornecedorMenor = r.fornecedor;
      }
      if (r.created_at > ultima) ultima = r.created_at;
    }

    return {
      id: c.id,
      descricao: c.descricao,
      quantidade: qtd,
      unidadeMedida: c.unidade_medida,
      menorPrecoUnitarioCentavos: menorUnit,
      fornecedorMenorPreco: fornecedorMenor,
      qtdRegistrosPreco: bucket.length,
      ultimaAtualizacaoISO: ultima,
    };
  });
}

export async function fetchCotacaoById(id: string): Promise<CotacaoRecord | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('cotacoes')
    .select('id, org_id, descricao, quantidade, unidade_medida, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return mapCotacaoRow(data as Parameters<typeof mapCotacaoRow>[0]);
}

export async function fetchPrecosByCotacaoId(cotacaoId: string): Promise<CotacaoPrecoRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('cotacao_precos')
    .select('id, fornecedor, valor, data_registro, created_at')
    .eq('cotacao_id', cotacaoId)
    .order('data_registro', { ascending: false })
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data.map((row) => mapPrecoRow(row as Parameters<typeof mapPrecoRow>[0]));
}

export async function fetchFornecedoresDaCotacao(cotacaoId: string): Promise<string[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('cotacao_precos')
    .select('fornecedor')
    .eq('cotacao_id', cotacaoId);

  if (error || !data) return [];
  const uniq = [...new Set(data.map((r) => (r as { fornecedor: string }).fornecedor.trim()).filter(Boolean))];
  return uniq.slice(0, 15);
}

export async function existePrecoMesmoFornecedorEData(
  cotacaoId: string,
  fornecedor: string,
  dataRegistroBR: string,
  excludePrecoId?: string
): Promise<boolean> {
  const precos = await fetchPrecosByCotacaoId(cotacaoId);
  const iso = brToISO(dataRegistroBR);
  return precos.some(
    (p) =>
      p.id !== excludePrecoId &&
      fornecedorIgual(p.fornecedor, fornecedor) &&
      brToISO(p.dataRegistroBR) === iso
  );
}

export async function createCotacao(
  orgId: string,
  descricao: string,
  quantidade: number,
  unidadeMedida: string
): Promise<{ id: string } | { error: string }> {
  if (!supabase) return { error: 'Supabase não configurado.' };
  const existing = await fetchCotacaoPorDescricaoNormalizada(orgId, descricao);
  if (existing) {
    if (existing.unidadeMedida.trim() !== unidadeMedida.trim()) {
      return { error: MSG_COTACAO_UNIDADE_EXISTENTE(existing.unidadeMedida) };
    }
    return { error: 'Produto já cadastrado nesta organização.' };
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return { error: 'Usuário não autenticado.' };

  const { data, error } = await supabase
    .from('cotacoes')
    .insert({
      org_id: orgId,
      user_id: user.id,
      descricao: descricao.trim(),
      quantidade,
      unidade_medida: unidadeMedida,
    })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const row = await fetchCotacaoPorDescricaoNormalizada(orgId, descricao);
      if (row) return { error: MSG_COTACAO_UNIDADE_EXISTENTE(row.unidadeMedida) };
      return { error: 'Produto já cadastrado nesta organização.' };
    }
    return { error: error.message };
  }
  return { id: (data as { id: string }).id };
}

export async function updateCotacao(
  id: string,
  orgId: string,
  descricao: string,
  quantidade: number,
  unidadeMedida: string
): Promise<{ ok: true } | { error: string }> {
  if (!supabase) return { error: 'Supabase não configurado.' };

  const other = await fetchCotacaoPorDescricaoNormalizada(orgId, descricao, id);
  if (other && other.id !== id) {
    return { error: MSG_COTACAO_UNIDADE_EXISTENTE(other.unidadeMedida) };
  }

  const { error } = await supabase
    .from('cotacoes')
    .update({
      descricao: descricao.trim(),
      quantidade,
      unidade_medida: unidadeMedida,
    })
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) {
    if (error.code === '23505') {
      const row = await fetchCotacaoPorDescricaoNormalizada(orgId, descricao);
      if (row && row.id !== id) return { error: MSG_COTACAO_UNIDADE_EXISTENTE(row.unidadeMedida) };
    }
    return { error: error.message };
  }
  return { ok: true };
}

export async function insertCotacaoPreco(
  cotacaoId: string,
  fornecedorRaw: string,
  valorCentavos: number,
  dataRegistroBR: string
): Promise<{ ok: true } | { error: string }> {
  if (!supabase) return { error: 'Supabase não configurado.' };
  const fornecedor = fornecedorRaw.trim();
  if (!fornecedor) return { error: MSG_FORNECEDOR_PRECO_OBRIGATORIO };
  if (!valorCentavos || valorCentavos <= 0) return { error: MSG_PRECO_INVALIDO };

  const valorReais = valorCentavos / 100;
  const dataISO = brToISO(dataRegistroBR);

  const { error } = await supabase.from('cotacao_precos').insert({
    cotacao_id: cotacaoId,
    fornecedor,
    valor: valorReais,
    data_registro: dataISO,
  });

  if (error) return { error: error.message };
  return { ok: true };
}

export async function deleteCotacaoPreco(precoId: string): Promise<{ ok: true } | { error: string }> {
  if (!supabase) return { error: 'Supabase não configurado.' };
  const { error } = await supabase.from('cotacao_precos').delete().eq('id', precoId);
  if (error) return { error: error.message };
  return { ok: true };
}
