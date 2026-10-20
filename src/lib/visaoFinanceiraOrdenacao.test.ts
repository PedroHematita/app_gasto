import { describe, expect, it } from 'vitest';
import type { LinhaVisao } from './visaoFinanceiraModelo';
import { ordenarLancamentosVisao, proximaOrdenacao } from './visaoFinanceiraOrdenacao';

function linha(partial: Partial<LinhaVisao> & Pick<LinhaVisao, 'id' | 'fornecedor' | 'valorCents'>): LinhaVisao {
  return {
    monthKey: '2026-10',
    dataRef: new Date(2026, 9, 1),
    modalidade: 'demais',
    natureza: 'nao_classificado',
    situacao: 'realizado',
    origem: 'Gasto',
    naturezaObservacao: null,
    formaPagamento: null,
    meioPagamento: null,
    instituicaoFinanceira: null,
    ...partial,
  };
}

const LISTA = [
  linha({ id: 'b', fornecedor: 'Beta', valorCents: 100, dataRef: new Date(2026, 9, 2), formaPagamento: 'Parcelado', meioPagamento: 'PIX' }),
  linha({ id: 'a', fornecedor: 'Alfa', valorCents: 300, dataRef: new Date(2026, 9, 10), formaPagamento: 'À Vista', instituicaoFinanceira: 'Nubank' }),
  linha({ id: 'c', fornecedor: 'Casa', valorCents: 200, dataRef: new Date(2026, 9, 1) }),
];

describe('proximaOrdenacao', () => {
  it('percorre as três etapas e troca de coluna do início', () => {
    const primeiro = proximaOrdenacao(null, 'valor');
    const segundo = proximaOrdenacao(primeiro, 'valor');
    const original = proximaOrdenacao(segundo, 'valor');
    expect(primeiro).toEqual({ coluna: 'valor', sentido: 'desc' });
    expect(segundo).toEqual({ coluna: 'valor', sentido: 'asc' });
    expect(original).toBeNull();
    expect(proximaOrdenacao(primeiro, 'fornecedor')).toEqual({ coluna: 'fornecedor', sentido: 'asc' });
  });
});

describe('ordenarLancamentosVisao', () => {
  it('ordena valor, data e forma e volta à ordem original', () => {
    expect(ordenarLancamentosVisao(LISTA, { coluna: 'valor', sentido: 'desc' }).map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(ordenarLancamentosVisao(LISTA, { coluna: 'valor', sentido: 'asc' }).map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(ordenarLancamentosVisao(LISTA, { coluna: 'data', sentido: 'desc' }).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(ordenarLancamentosVisao(LISTA, { coluna: 'data', sentido: 'asc' }).map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(ordenarLancamentosVisao(LISTA, { coluna: 'forma', sentido: 'asc' }).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(ordenarLancamentosVisao(LISTA, { coluna: 'forma', sentido: 'desc' }).map((item) => item.id)).toEqual(['b', 'a', 'c']);
    expect(ordenarLancamentosVisao(LISTA, null).map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });

  it('ordena fornecedor e deixa informação ausente por último nos dois sentidos', () => {
    expect(ordenarLancamentosVisao(LISTA, { coluna: 'fornecedor', sentido: 'asc' }).map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(ordenarLancamentosVisao(LISTA, { coluna: 'fornecedor', sentido: 'desc' }).map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(ordenarLancamentosVisao(LISTA, { coluna: 'meio', sentido: 'asc' }).map((item) => item.id)).toEqual(['b', 'a', 'c']);
    expect(ordenarLancamentosVisao(LISTA, { coluna: 'meio', sentido: 'desc' }).map((item) => item.id)).toEqual(['b', 'a', 'c']);
  });
});
