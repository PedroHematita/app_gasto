import { formatCurrency, normalizeDescricao } from '../../utils';
import { fetchPriceHistory, type PriceHistoryRecord } from '../supabase';
import {
  avaliarDesvioComHistorico,
  type DesvioPrecoUnitario,
} from '../desvioPreco';
import { ordenarGastosNaTela, type GastoRascunhoLote } from './modelo';
import type { AvisoLote } from './validacao';

export function chaveHistoricoPreco(descricao: string, unidade: string): string {
  return `${normalizeDescricao(descricao)}|${unidade.trim()}`;
}

function parseQuantidade(texto: string): number | null {
  const t = texto.trim().replace(/\s+/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

export interface DesvioPrecoItemLote {
  gastoId: string;
  itemId: string;
  posicaoGasto: number;
  descricao: string;
  unidade: string;
  desvio: DesvioPrecoUnitario;
}

/** Busca histórico por par descrição+unidade únicos do lote. */
export async function buscarHistoricosDoLote(
  orgId: string,
  gastos: GastoRascunhoLote[]
): Promise<Map<string, PriceHistoryRecord[]>> {
  const chaves = new Map<string, { descricao: string; unidade: string }>();

  for (const gasto of gastos) {
    for (const item of gasto.itens) {
      const desc = item.descricao.trim();
      const unidade = item.unidade.trim();
      if (desc.length < 2 || !unidade) continue;
      const chave = chaveHistoricoPreco(desc, unidade);
      if (!chaves.has(chave)) {
        chaves.set(chave, { descricao: desc, unidade });
      }
    }
  }

  const resultado = new Map<string, PriceHistoryRecord[]>();
  await Promise.all(
    [...chaves.entries()].map(async ([chave, { descricao, unidade }]) => {
      const hist = await fetchPriceHistory(orgId, descricao, unidade);
      resultado.set(chave, hist);
    })
  );
  return resultado;
}

export function coletarDesviosPrecoLote(
  gastos: GastoRascunhoLote[],
  posicaoPorGastoId: Record<string, number>,
  historicoPorChave: ReadonlyMap<string, ReadonlyArray<{ valorCentavos: number; quantidade: number }>>
): DesvioPrecoItemLote[] {
  const desvios: DesvioPrecoItemLote[] = [];
  const ordenados = ordenarGastosNaTela(gastos);

  for (const gasto of ordenados) {
    const posicaoGasto = posicaoPorGastoId[gasto.id] ?? 0;
    for (const item of gasto.itens) {
      if (item.valorCentavos == null || item.valorCentavos <= 0) continue;
      const qtd = parseQuantidade(item.quantidade);
      if (qtd == null || qtd <= 0) continue;
      const desc = item.descricao.trim();
      const unidade = item.unidade.trim();
      if (desc.length < 2 || !unidade) continue;

      const hist = historicoPorChave.get(chaveHistoricoPreco(desc, unidade));
      if (!hist || hist.length === 0) continue;

      const desvio = avaliarDesvioComHistorico(item.valorCentavos, qtd, hist);
      if (!desvio?.foraDaFaixa) continue;

      desvios.push({
        gastoId: gasto.id,
        itemId: item.id,
        posicaoGasto,
        descricao: desc,
        unidade,
        desvio,
      });
    }
  }

  return desvios;
}

export function avisosDeDesviosPreco(desvios: DesvioPrecoItemLote[]): AvisoLote[] {
  return desvios.map((d) => ({
    tipo: 'preco_fora_media' as const,
    gastoId: d.gastoId,
    itemId: d.itemId,
    posicaoGasto: d.posicaoGasto,
    mensagem: `“${d.descricao}”: valor unitário ${formatCurrency(d.desvio.valorUnitarioCentavos)} / ${d.unidade} fora da média histórica (${formatCurrency(d.desvio.mediaPonderadaCentavos)} / ${d.unidade}). Confira a unidade e o preço.`,
  }));
}
