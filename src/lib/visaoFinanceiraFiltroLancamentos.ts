/**
 * Filtros visuais da tabela de lançamentos do mês.
 * Não entram no gráfico, nos indicadores nem no cálculo financeiro.
 */

import { ROTULO_NATUREZA, type LinhaVisao } from './visaoFinanceiraModelo';
import { formaExibida, instituicaoExibida, meioExibido } from './visaoFinanceiraOrdenacao';

export const COLUNAS_FILTRO_VISAO = ['forma', 'meio', 'instituicao', 'classificacao'] as const;

export type ColunaFiltroVisao = (typeof COLUNAS_FILTRO_VISAO)[number];

/** Opções marcadas por coluna. Lista vazia ou ausente significa sem filtro naquela coluna. */
export type FiltrosLancamentoVisao = Partial<Record<ColunaFiltroVisao, readonly string[]>>;

export function textoColunaLancamento(linha: LinhaVisao, coluna: ColunaFiltroVisao): string {
  if (coluna === 'forma') return formaExibida(linha.formaPagamento);
  if (coluna === 'meio') return meioExibido(linha.meioPagamento);
  if (coluna === 'instituicao') return instituicaoExibida(linha.instituicaoFinanceira);
  return ROTULO_NATUREZA[linha.natureza];
}

export function opcoesFiltroLancamento(linhas: readonly LinhaVisao[], coluna: ColunaFiltroVisao): string[] {
  const unicos = new Set(linhas.map((linha) => textoColunaLancamento(linha, coluna)));
  return [...unicos].sort((a, b) => {
    if (a === '—') return 1;
    if (b === '—') return -1;
    return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
  });
}

export function filtrosLancamentoAtivos(filtros: FiltrosLancamentoVisao): boolean {
  return Object.values(filtros).some((opcoes) => (opcoes?.length ?? 0) > 0);
}

export function alternarOpcaoFiltro(
  filtros: FiltrosLancamentoVisao,
  coluna: ColunaFiltroVisao,
  opcao: string,
): FiltrosLancamentoVisao {
  const atuais = filtros[coluna] ?? [];
  const proximas = atuais.includes(opcao)
    ? atuais.filter((item) => item !== opcao)
    : [...atuais, opcao];
  const seguinte = { ...filtros };
  if (proximas.length === 0) delete seguinte[coluna];
  else seguinte[coluna] = proximas;
  return seguinte;
}

/** Dentro da coluna, qualquer opção marcada. Entre colunas, todas as condições. */
export function filtrarLancamentosVisao(
  linhas: readonly LinhaVisao[],
  filtros: FiltrosLancamentoVisao,
): LinhaVisao[] {
  const ativos = (Object.keys(filtros) as ColunaFiltroVisao[]).flatMap((coluna) => {
    const opcoes = filtros[coluna];
    return opcoes && opcoes.length > 0 ? [[coluna, opcoes] as const] : [];
  });
  if (ativos.length === 0) return [...linhas];
  return linhas.filter((linha) =>
    ativos.every(([coluna, opcoes]) => opcoes.includes(textoColunaLancamento(linha, coluna))),
  );
}
