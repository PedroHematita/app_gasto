import { describe, expect, it } from 'vitest';
import type { FatiaDivida, CompraParceladaNova } from './dividaParceladaModelo';
import { INSTITUICAO_NAO_INFORMADA } from './dividaParceladaModelo';
import {
  colunasComprasNovas,
  colunasDivida,
  destinoDaCompra,
  encerramentosDoMes,
  filtrarFatiasDivida,
  indicadoresDoMes,
  indicadoresInstituicaoDoMes,
  origemDoMes,
  resumoComprasDoMes,
  resumoPorInstituicao,
} from './dividaParceladaConsulta';

function fatia(partial: Partial<FatiaDivida> & Pick<FatiaDivida, 'id' | 'monthKeyVencimento' | 'valorCents'>): FatiaDivida {
  const [y, m] = partial.monthKeyVencimento.split('-').map(Number);
  const ven = new Date(y, m - 1, 6);
  const compraKey = partial.monthKeyCompra ?? '2026-08';
  const [yc, mc] = compraKey.split('-').map(Number);
  return {
    origemTipo: 'gasto_agenda',
    dataVencimento: ven,
    monthKeyCompra: compraKey,
    dataCompra: new Date(yc, mc - 1, 15),
    parcela: 1,
    totalParcelas: 3,
    fornecedor: 'Loja',
    natureza: 'pessoal',
    situacao: 'projecao',
    instituicao: 'Nubank',
    totalCompraCents: 30000,
    gastoId: 'g1',
    compromissoId: null,
    origemRotulo: 'Agenda',
    ...partial,
  };
}

const HOJE = new Date(2026, 9, 20);

describe('dividaParceladaConsulta', () => {
  it('soma das fatias do mês bate com o detalhe e com a coluna do gráfico', () => {
    const fatias = [
      fatia({ id: 'a', monthKeyVencimento: '2026-10', monthKeyCompra: '2026-08', valorCents: 10000 }),
      fatia({ id: 'b', monthKeyVencimento: '2026-10', monthKeyCompra: '2026-09', valorCents: 20000 }),
      fatia({ id: 'c', monthKeyVencimento: '2026-11', monthKeyCompra: '2026-09', valorCents: 5000 }),
    ];
    const colunas = colunasDivida(fatias, HOJE);
    const out = colunas.find((c) => c.monthKey === '2026-10');
    expect(out?.totalCents).toBe(30000);
    expect(origemDoMes(fatias, '2026-10').map((o) => o.monthKeyCompra)).toEqual(['2026-08', '2026-09']);
    expect(origemDoMes(fatias, '2026-10')[1].participacao).toBeCloseTo(2 / 3);
  });

  it('saldo ignora quitado e inclui projeção de cartão', () => {
    const fatias = [
      fatia({
        id: 'q', monthKeyVencimento: '2026-11', valorCents: 10000,
        origemTipo: 'compromisso', situacao: 'quitado', gastoId: null, compromissoId: 'c1',
      }),
      fatia({
        id: 'p', monthKeyVencimento: '2026-11', valorCents: 15000,
        origemTipo: 'compromisso', situacao: 'pendente', gastoId: null, compromissoId: 'c1',
      }),
      fatia({ id: 'a', monthKeyVencimento: '2026-11', valorCents: 8000, situacao: 'projecao' }),
    ];
    const ind = indicadoresDoMes(fatias, [], '2026-10');
    expect(ind.saldoFimCents).toBe(23000);
    expect(ind.saldoInicioCents).toBe(23000);
  });

  it('marca encerramentos quando parcela = total', () => {
    const fatias = [
      fatia({ id: '1', monthKeyVencimento: '2026-10', parcela: 3, totalParcelas: 3, valorCents: 12000 }),
      fatia({ id: '2', monthKeyVencimento: '2026-10', parcela: 2, totalParcelas: 3, valorCents: 10000 }),
    ];
    const enc = encerramentosDoMes(fatias, '2026-10');
    expect(enc).toHaveLength(1);
    expect(indicadoresDoMes(fatias, [], '2026-10').qtdEncerramentos).toBe(1);
    expect(indicadoresDoMes(fatias, [], '2026-10').encerramentosCents).toBe(12000);
  });

  it('filtra natureza e destina compra pelos meses de vencimento', () => {
    const fatias = [
      fatia({ id: 'a1', monthKeyVencimento: '2026-10', monthKeyCompra: '2026-09', valorCents: 10000, gastoId: 'g1', natureza: 'pessoal' }),
      fatia({ id: 'a2', monthKeyVencimento: '2026-11', monthKeyCompra: '2026-09', valorCents: 10000, gastoId: 'g1', natureza: 'pessoal' }),
      fatia({ id: 'e1', monthKeyVencimento: '2026-10', monthKeyCompra: '2026-09', valorCents: 5000, gastoId: 'g2', natureza: 'empresa' }),
    ];
    expect(filtrarFatiasDivida(fatias, 'pessoal')).toHaveLength(2);
    const dest = destinoDaCompra(fatias, { gastoId: 'g1' });
    expect(dest.map((d) => d.monthKeyVencimento)).toEqual(['2026-10', '2026-11']);
    expect(dest[0].participacao).toBe(0.5);
  });

  it('conta novas compras pelo mês da compra', () => {
    const compras: CompraParceladaNova[] = [
      {
        id: 'c1', origemTipo: 'gasto_agenda', monthKeyCompra: '2026-10',
        dataCompra: new Date(2026, 9, 5), fornecedor: 'A', natureza: 'pessoal',
        instituicao: 'Nubank', totalCents: 40000, totalParcelas: 4, gastoId: 'g1', compromissoId: null,
      },
    ];
    const ind = indicadoresDoMes([], compras, '2026-10');
    expect(ind.qtdNovasCompras).toBe(1);
    expect(ind.novasComprasCents).toBe(40000);
  });

  it('soma compras integrais por mês de compra sem usar fatias de vencimento', () => {
    const compras: CompraParceladaNova[] = [
      {
        id: 'a', origemTipo: 'gasto_agenda', monthKeyCompra: '2026-09',
        dataCompra: new Date(2026, 8, 10), fornecedor: 'A', natureza: 'pessoal',
        instituicao: 'Nubank', totalCents: 60000, totalParcelas: 6, gastoId: 'g1', compromissoId: null,
      },
      {
        id: 'b', origemTipo: 'compromisso', monthKeyCompra: '2026-09',
        dataCompra: new Date(2026, 8, 20), fornecedor: 'B', natureza: 'nao_classificado',
        instituicao: INSTITUICAO_NAO_INFORMADA, totalCents: 20000, totalParcelas: 2,
        gastoId: null, compromissoId: 'c1',
      },
      {
        id: 'c', origemTipo: 'gasto_agenda', monthKeyCompra: '2026-10',
        dataCompra: new Date(2026, 9, 5), fornecedor: 'C', natureza: 'empresa',
        instituicao: 'C6 Madrigal', totalCents: 10000, totalParcelas: 4, gastoId: 'g2', compromissoId: null,
      },
    ];
    const colunas = colunasComprasNovas(compras, HOJE);
    expect(colunas.find((c) => c.monthKey === '2026-09')?.totalCents).toBe(80000);
    expect(colunas.find((c) => c.monthKey === '2026-10')?.totalCents).toBe(10000);
    expect(resumoComprasDoMes(compras, '2026-09')).toEqual({ totalCents: 80000, qtd: 2 });
  });

  it('filtra instituição com natureza e soma o consolidado das instituições', () => {
    const fatias = [
      fatia({ id: 'n1', monthKeyVencimento: '2026-10', valorCents: 10000, gastoId: 'g1', instituicao: 'Nubank', parcela: 1, totalParcelas: 2 }),
      fatia({ id: 'n2', monthKeyVencimento: '2026-11', valorCents: 10000, gastoId: 'g1', instituicao: 'Nubank', parcela: 2, totalParcelas: 2 }),
      fatia({ id: 'c1', monthKeyVencimento: '2026-10', valorCents: 5000, gastoId: 'g2', instituicao: 'C6 Madrigal', parcela: 1, totalParcelas: 1 }),
      fatia({
        id: 'x1', monthKeyVencimento: '2026-10', valorCents: 3000, gastoId: null, compromissoId: 'c9',
        instituicao: INSTITUICAO_NAO_INFORMADA, origemTipo: 'compromisso', situacao: 'pendente',
      }),
    ];
    expect(filtrarFatiasDivida(fatias, 'todas', 'Nubank')).toHaveLength(2);
    expect(filtrarFatiasDivida(fatias, 'pessoal', 'C6 Madrigal')).toHaveLength(1);

    const resumo = resumoPorInstituicao(fatias, '2026-10');
    const somaMes = resumo.reduce((s, r) => s + r.parcelasMesCents, 0);
    const somaSaldo = resumo.reduce((s, r) => s + r.saldoFuturoCents, 0);
    const consol = indicadoresInstituicaoDoMes(fatias, '2026-10');
    expect(somaMes).toBe(consol.parcelasMesCents);
    expect(somaSaldo).toBe(consol.saldoFuturoCents);
    expect(consol.qtdParcelamentosAtivos).toBe(3);
    expect(consol.qtdParcelasRestantes).toBe(4);
    expect(resumo.find((r) => r.instituicao === 'Nubank')?.qtdParcelamentosAtivos).toBe(1);
    expect(resumo.find((r) => r.instituicao === 'Nubank')?.qtdParcelasRestantes).toBe(2);
  });
});
