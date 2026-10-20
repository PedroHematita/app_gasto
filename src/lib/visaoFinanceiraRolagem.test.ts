import { describe, expect, it } from 'vitest';
import { scrollInicialGrafico } from './visaoFinanceiraRolagem';

function meses(inicio: string, quantidade: number): string[] {
  const [anoTexto, mesTexto] = inicio.split('-');
  let ano = Number(anoTexto);
  let mes = Number(mesTexto);
  const chaves: string[] = [];
  for (let i = 0; i < quantidade; i += 1) {
    chaves.push(`${ano}-${String(mes).padStart(2, '0')}`);
    mes += 1;
    if (mes > 12) {
      mes = 1;
      ano += 1;
    }
  }
  return chaves;
}

const COLUNA = 88;
const VISIVEL = 440;

describe('scrollInicialGrafico', () => {
  it('centraliza o mês atual quando o histórico começa anos antes', () => {
    const chaves = meses('2024-08', 39);
    const indice = chaves.indexOf('2026-10');
    const scroll = scrollInicialGrafico({
      chaves,
      chaveAtual: '2026-10',
      larguraColuna: COLUNA,
      larguraVisivel: VISIVEL,
      larguraConteudo: chaves.length * COLUNA,
    });
    expect(scroll).toBe(indice * COLUNA + COLUNA / 2 - VISIVEL / 2);
    expect(scroll).toBeGreaterThan(0);
    expect(scroll).toBeLessThan(chaves.length * COLUNA - VISIVEL);
  });

  it('no histórico encosta no fim e no futuro começa no início', () => {
    const historico = meses('2024-08', 26);
    expect(scrollInicialGrafico({
      chaves: historico,
      chaveAtual: '2026-10',
      larguraColuna: COLUNA,
      larguraVisivel: VISIVEL,
      larguraConteudo: historico.length * COLUNA,
    })).toBe(historico.length * COLUNA - VISIVEL);

    const futuro = meses('2026-11', 12);
    expect(scrollInicialGrafico({
      chaves: futuro,
      chaveAtual: '2026-10',
      larguraColuna: COLUNA,
      larguraVisivel: VISIVEL,
      larguraConteudo: futuro.length * COLUNA,
    })).toBe(0);
  });

  it('não rola quando o mês atual já ocupa a área visível', () => {
    expect(scrollInicialGrafico({
      chaves: ['2026-10'],
      chaveAtual: '2026-10',
      larguraColuna: COLUNA,
      larguraVisivel: VISIVEL,
      larguraConteudo: COLUNA,
    })).toBe(0);
  });
});
