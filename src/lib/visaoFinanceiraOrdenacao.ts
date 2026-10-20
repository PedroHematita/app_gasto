/**
 * Ordenação só visual da tabela de lançamentos da Visão Financeira.
 * Não altera valores, totais nem a ordem original enquanto nenhuma coluna está ativa.
 */

import { isFormaPagamentoParcelado } from './gastosParceladosFuturos';
import { ROTULO_NATUREZA, type LinhaVisao } from './visaoFinanceiraModelo';
import { rotuloMeioPagamentoFiltroClassificacao } from '../utils';

export type ColunaOrdenacaoVisao =
  | 'fornecedor'
  | 'forma'
  | 'meio'
  | 'instituicao'
  | 'classificacao'
  | 'data'
  | 'valor';

export type SentidoOrdenacaoVisao = 'asc' | 'desc';

export interface OrdenacaoVisao {
  coluna: ColunaOrdenacaoVisao;
  sentido: SentidoOrdenacaoVisao;
}

export function formaExibida(forma: string | null): string {
  const texto = forma?.trim();
  if (!texto) return '—';
  if (isFormaPagamentoParcelado(texto)) return 'Parcelado';
  if (texto.toLowerCase() === 'à vista' || texto.toLowerCase() === 'a vista') return 'À Vista';
  return texto;
}

export function meioExibido(meio: string | null): string {
  const texto = meio?.trim();
  if (!texto) return '—';
  return rotuloMeioPagamentoFiltroClassificacao(texto);
}

export function instituicaoExibida(instituicao: string | null): string {
  const texto = instituicao?.trim();
  if (!texto) return '—';
  if (texto.toLowerCase() === '(não se aplica)') return 'Não se aplica';
  return texto;
}

function sentidoInicial(coluna: ColunaOrdenacaoVisao): SentidoOrdenacaoVisao {
  if (coluna === 'data' || coluna === 'valor') return 'desc';
  return 'asc';
}

/** Clique: primeira ordem, ordem inversa e, no terceiro, a lista original. */
export function proximaOrdenacao(
  atual: OrdenacaoVisao | null,
  coluna: ColunaOrdenacaoVisao,
): OrdenacaoVisao | null {
  if (!atual || atual.coluna !== coluna) {
    return { coluna, sentido: sentidoInicial(coluna) };
  }
  const inicial = sentidoInicial(coluna);
  if (atual.sentido === inicial) {
    return { coluna, sentido: inicial === 'asc' ? 'desc' : 'asc' };
  }
  return null;
}

function textoPresente(valor: string): string | null {
  const texto = valor.trim();
  if (!texto || texto === '—') return null;
  return texto;
}

function compararTexto(a: string, b: string, sentido: SentidoOrdenacaoVisao): number {
  const esquerda = textoPresente(a);
  const direita = textoPresente(b);
  if (esquerda == null && direita == null) return 0;
  if (esquerda == null) return 1;
  if (direita == null) return -1;
  const cmp = esquerda.localeCompare(direita, 'pt-BR', { sensitivity: 'base' });
  return sentido === 'asc' ? cmp : -cmp;
}

function rankForma(forma: string | null): number | null {
  const texto = formaExibida(forma);
  if (texto === '—') return null;
  if (texto === 'À Vista') return 0;
  if (texto === 'Parcelado') return 1;
  return 2;
}

function comparar(a: LinhaVisao, b: LinhaVisao, ordenacao: OrdenacaoVisao): number {
  const { coluna, sentido } = ordenacao;
  if (coluna === 'fornecedor') return compararTexto(a.fornecedor, b.fornecedor, sentido);
  if (coluna === 'meio') return compararTexto(meioExibido(a.meioPagamento), meioExibido(b.meioPagamento), sentido);
  if (coluna === 'instituicao') {
    return compararTexto(instituicaoExibida(a.instituicaoFinanceira), instituicaoExibida(b.instituicaoFinanceira), sentido);
  }
  if (coluna === 'classificacao') {
    return compararTexto(ROTULO_NATUREZA[a.natureza], ROTULO_NATUREZA[b.natureza], sentido);
  }
  if (coluna === 'forma') {
    const esquerda = rankForma(a.formaPagamento);
    const direita = rankForma(b.formaPagamento);
    if (esquerda == null && direita == null) return 0;
    if (esquerda == null) return 1;
    if (direita == null) return -1;
    if (esquerda !== direita) return sentido === 'asc' ? esquerda - direita : direita - esquerda;
    return compararTexto(formaExibida(a.formaPagamento), formaExibida(b.formaPagamento), sentido);
  }
  if (coluna === 'data') {
    const cmp = a.dataRef.getTime() - b.dataRef.getTime();
    return sentido === 'asc' ? cmp : -cmp;
  }
  const cmp = a.valorCents - b.valorCents;
  return sentido === 'asc' ? cmp : -cmp;
}

export function ordenarLancamentosVisao(linhas: LinhaVisao[], ordenacao: OrdenacaoVisao | null): LinhaVisao[] {
  if (!ordenacao) return linhas;
  return linhas
    .map((linha, indice) => ({ linha, indice }))
    .sort((a, b) => {
      const cmp = comparar(a.linha, b.linha, ordenacao);
      if (cmp !== 0) return cmp;
      return a.indice - b.indice;
    })
    .map((item) => item.linha);
}
