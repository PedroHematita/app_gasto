/**
 * Posição inicial da rolagem compartilhada do gráfico e da tabela mensal.
 * Não altera colunas, valores nem a rolagem depois que o usuário navega.
 */

export function scrollParaCentralizar(
  indice: number,
  larguraColuna: number,
  larguraVisivel: number,
  larguraConteudo: number,
): number {
  const centro = indice * larguraColuna + larguraColuna / 2;
  const desejado = centro - larguraVisivel / 2;
  const maximo = Math.max(0, larguraConteudo - larguraVisivel);
  return Math.min(Math.max(0, desejado), maximo);
}

/** Mês atual no centro. Sem ele, o trecho do intervalo mais próximo de hoje. */
export function scrollInicialGrafico(input: {
  chaves: readonly string[];
  chaveAtual: string;
  larguraColuna: number;
  larguraVisivel: number;
  larguraConteudo: number;
}): number {
  const { chaves, chaveAtual, larguraColuna, larguraVisivel, larguraConteudo } = input;
  if (chaves.length === 0 || larguraVisivel <= 0) return 0;
  const exato = chaves.indexOf(chaveAtual);
  if (exato >= 0) {
    return scrollParaCentralizar(exato, larguraColuna, larguraVisivel, larguraConteudo);
  }
  const primeiroFuturo = chaves.findIndex((chave) => chave > chaveAtual);
  if (primeiroFuturo === -1) return Math.max(0, larguraConteudo - larguraVisivel);
  return 0;
}
