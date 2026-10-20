/**
 * Leitura para a Visão Financeira. Não grava status, quitação nem classificação.
 */

import type { CompromissoRecord, GastoPereneRecord, GastoRecord } from '../types';
import {
  fetchCompromissosParceladosLeitura,
  fetchCompromissosPendentesLeitura,
  fetchGastos,
  fetchGastosParaClassificacao,
  fetchGastosPerenesAtivos,
  supabase,
} from './supabase';

export interface VisaoFinanceiraBruta {
  gastos: GastoRecord[];
  tipoGastoPorId: Map<string, string | null>;
  /** Compromissos em aberto — usados pela Visão Geral. */
  compromissos: CompromissoRecord[];
  /** Compromissos parcelados com histórico (inclui quitados) — Dívida Parcelada. */
  compromissosParcelados: CompromissoRecord[];
  perenes: GastoPereneRecord[];
  gastoIdsPerene: Set<string>;
  /** Gasto de quitação → id do modelo perene (quando o vínculo existe). */
  gastoPereneIdPorGastoId: Map<string, string>;
  gastoIdsParcela: Set<string>;
  avisos: string[];
}

async function lerVinculosQuitacao(orgId: string, avisos: string[]): Promise<{
  perene: Set<string>;
  gastoPereneIdPorGastoId: Map<string, string>;
  parcela: Set<string>;
}> {
  const perene = new Set<string>();
  const gastoPereneIdPorGastoId = new Map<string, string>();
  const parcela = new Set<string>();
  if (!supabase) return { perene, gastoPereneIdPorGastoId, parcela };

  const compromissos = await supabase
    .from('compromissos')
    .select('gasto_id, gasto_perene_id')
    .eq('org_id', orgId)
    .not('gasto_id', 'is', null);

  if (compromissos.error) {
    avisos.push('Não foi possível ler o vínculo entre gastos quitados e compromissos perenes.');
  } else {
    for (const row of compromissos.data ?? []) {
      if (!row.gasto_id || !row.gasto_perene_id) continue;
      const gastoId = row.gasto_id as string;
      const pereneId = row.gasto_perene_id as string;
      perene.add(gastoId);
      gastoPereneIdPorGastoId.set(gastoId, pereneId);
    }
  }

  const parcelas = await supabase
    .from('compromisso_parcelas')
    .select('gasto_id, compromissos!inner(org_id)')
    .eq('compromissos.org_id', orgId)
    .not('gasto_id', 'is', null);

  if (parcelas.error) {
    avisos.push('Não foi possível identificar gastos que vieram de parcelas já quitadas.');
  } else {
    for (const row of parcelas.data ?? []) {
      if (row.gasto_id) parcela.add(row.gasto_id as string);
    }
  }

  return { perene, gastoPereneIdPorGastoId, parcela };
}

export async function carregarVisaoFinanceira(orgId: string): Promise<VisaoFinanceiraBruta> {
  const avisos: string[] = [];
  const [gastos, classificacao, perenes, vinculos, compromissos, compromissosParcelados] = await Promise.all([
    fetchGastos(orgId),
    fetchGastosParaClassificacao(orgId),
    fetchGastosPerenesAtivos(orgId),
    lerVinculosQuitacao(orgId, avisos),
    fetchCompromissosPendentesLeitura(orgId).catch(() => {
      avisos.push('Não foi possível ler os compromissos em aberto.');
      return [];
    }),
    fetchCompromissosParceladosLeitura(orgId).catch(() => {
      avisos.push('Não foi possível ler o histórico de compromissos parcelados.');
      return [];
    }),
  ]);

  const tipoGastoPorId = new Map<string, string | null>();
  for (const row of classificacao) tipoGastoPorId.set(row.id, row.tipoGasto);

  if (classificacao.length === 0 && gastos.length > 0) {
    avisos.push('A natureza dos gastos não pôde ser lida. Eles aparecem como não classificados.');
  }

  return {
    gastos,
    tipoGastoPorId,
    compromissos,
    compromissosParcelados,
    perenes,
    gastoIdsPerene: vinculos.perene,
    gastoPereneIdPorGastoId: vinculos.gastoPereneIdPorGastoId,
    gastoIdsParcela: vinculos.parcela,
    avisos,
  };
}
