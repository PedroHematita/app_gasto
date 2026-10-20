import { describe, expect, it } from 'vitest';
import type { LinhaVisao } from './visaoFinanceiraModelo';
import {
  alternarOpcaoFiltro,
  filtrarLancamentosVisao,
  filtrosLancamentoAtivos,
  opcoesFiltroLancamento,
} from './visaoFinanceiraFiltroLancamentos';
import { ordenarLancamentosVisao } from './visaoFinanceiraOrdenacao';

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
  linha({
    id: 'pix',
    fornecedor: 'Padaria',
    valorCents: 1000,
    formaPagamento: 'À Vista',
    meioPagamento: 'PIX',
    instituicaoFinanceira: 'Nubank',
    natureza: 'pessoal',
    dataRef: new Date(2026, 9, 3),
  }),
  linha({
    id: 'credito',
    fornecedor: 'Mercado',
    valorCents: 2500,
    formaPagamento: 'Parcelado',
    meioPagamento: 'Cartão de Crédito',
    instituicaoFinanceira: 'Nubank',
    natureza: 'pessoal',
    dataRef: new Date(2026, 9, 8),
  }),
  linha({
    id: 'empresa',
    fornecedor: 'Fornecedor',
    valorCents: 4000,
    formaPagamento: 'À Vista',
    meioPagamento: 'PIX',
    instituicaoFinanceira: 'Nubank PJ',
    natureza: 'empresa',
  }),
  linha({ id: 'sem', fornecedor: 'Compromisso', valorCents: 700, natureza: 'nao_classificado' }),
];

describe('filtrarLancamentosVisao', () => {
  it('isola uma opção e soma só as linhas visíveis', () => {
    const visiveis = filtrarLancamentosVisao(LISTA, { meio: ['PIX'] });
    expect(visiveis.map((item) => item.id)).toEqual(['pix', 'empresa']);
    expect(visiveis.reduce((soma, item) => soma + item.valorCents, 0)).toBe(5000);
  });

  it('aceita várias opções na mesma coluna', () => {
    const visiveis = filtrarLancamentosVisao(LISTA, { meio: ['PIX', 'Crédito'] });
    expect(visiveis.map((item) => item.id)).toEqual(['pix', 'credito', 'empresa']);
  });

  it('combina colunas e deixa ordenar o resultado', () => {
    const visiveis = filtrarLancamentosVisao(LISTA, {
      meio: ['PIX'],
      instituicao: ['Nubank'],
      classificacao: ['Pessoal'],
    });
    expect(visiveis.map((item) => item.id)).toEqual(['pix']);
    const porMeio = filtrarLancamentosVisao(LISTA, { meio: ['PIX'] });
    expect(ordenarLancamentosVisao(porMeio, { coluna: 'valor', sentido: 'desc' }).map((item) => item.id)).toEqual(['empresa', 'pix']);
  });

  it('isola registros sem informação e não inventa pagamento', () => {
    const visiveis = filtrarLancamentosVisao(LISTA, { forma: ['—'], meio: ['—'], instituicao: ['—'] });
    expect(visiveis.map((item) => item.id)).toEqual(['sem']);
    expect(visiveis[0].formaPagamento).toBeNull();
    expect(visiveis[0].meioPagamento).toBeNull();
    expect(visiveis[0].instituicaoFinanceira).toBeNull();
  });

  it('limpar os filtros devolve a lista original', () => {
    const marcado = alternarOpcaoFiltro(alternarOpcaoFiltro({}, 'meio', 'PIX'), 'meio', 'PIX');
    expect(filtrosLancamentoAtivos(marcado)).toBe(false);
    expect(filtrarLancamentosVisao(LISTA, marcado).map((item) => item.id)).toEqual(['pix', 'credito', 'empresa', 'sem']);
  });

  it('lista as opções existentes e deixa a indisponível por último', () => {
    expect(opcoesFiltroLancamento(LISTA, 'meio')).toEqual(['Crédito', 'PIX', '—']);
    expect(opcoesFiltroLancamento(LISTA, 'classificacao')).toEqual(['Empresa', 'Não classificado', 'Pessoal']);
  });
});
