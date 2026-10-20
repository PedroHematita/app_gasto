import { describe, expect, it } from 'vitest';
import type { CompromissoRecord, GastoRecord } from '../types';
import {
  INSTITUICAO_NAO_INFORMADA,
  montarComprasNovas,
  montarFatiasDivida,
  normalizarInstituicaoDivida,
} from './dividaParceladaModelo';

function gasto(partial: Partial<GastoRecord> & Pick<GastoRecord, 'id' | 'dataCompra' | 'total'>): GastoRecord {
  return {
    fornecedor: 'Loja',
    formaPagamento: 'Parcelado',
    meioPagamento: 'Cartão de Crédito',
    instituicaoFinanceira: 'Nubank',
    comprovanteUrl: null,
    items: [],
    createdAt: '2026-01-01',
    parcelas: 6,
    ...partial,
  };
}

function compromisso(partial: Partial<CompromissoRecord> & Pick<CompromissoRecord, 'id' | 'dataCompra' | 'total'>): CompromissoRecord {
  return {
    dataPrevistaPagamento: partial.dataCompra,
    fornecedor: 'Fornecedor',
    status: 'pendente',
    tipo: 'parcelado',
    createdAt: '2026-01-01',
    gastoId: null,
    gastoPereneId: null,
    competenciaChave: null,
    items: [],
    parcelas: [],
    ...partial,
  };
}

const HOJE = new Date(2026, 9, 20);

describe('normalizarInstituicaoDivida', () => {
  it('não inventa instituição e trata ausência como Não informado', () => {
    expect(normalizarInstituicaoDivida('Nubank')).toBe('Nubank');
    expect(normalizarInstituicaoDivida('(não se aplica)')).toBe(INSTITUICAO_NAO_INFORMADA);
    expect(normalizarInstituicaoDivida('')).toBe(INSTITUICAO_NAO_INFORMADA);
    expect(normalizarInstituicaoDivida(null)).toBe(INSTITUICAO_NAO_INFORMADA);
  });
});

describe('montarFatiasDivida', () => {
  it('gera agenda do cartão com origem no mês da compra e última parcela no fim', () => {
    const fatias = montarFatiasDivida({
      hoje: HOJE,
      gastos: [gasto({
        id: 'g1', dataCompra: '15/09/2026', total: 60000, parcelas: 6,
        fornecedor: 'Ultrajato', instituicaoFinanceira: 'C6 Madrigal',
      })],
      tipoGastoPorId: new Map([['g1', 'Pessoal']]),
      gastoIdsPerene: new Set(),
      gastoIdsParcela: new Set(),
      compromissosParcelados: [],
    });
    expect(fatias).toHaveLength(6);
    expect(fatias.every((f) => f.monthKeyCompra === '2026-09')).toBe(true);
    expect(fatias.every((f) => f.situacao === 'projecao')).toBe(true);
    expect(fatias.every((f) => f.instituicao === 'C6 Madrigal')).toBe(true);
    expect(fatias.map((f) => f.monthKeyVencimento)).toEqual([
      '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03',
    ]);
    expect(fatias[0].parcela).toBe(1);
    expect(fatias[5].parcela).toBe(6);
    expect(fatias.reduce((s, f) => s + f.valorCents, 0)).toBe(60000);
  });

  it('não gera agenda para gasto de quitação de parcela', () => {
    const fatias = montarFatiasDivida({
      hoje: HOJE,
      gastos: [gasto({ id: 'quit', dataCompra: '10/10/2026', total: 10000, parcelas: 3 })],
      tipoGastoPorId: new Map(),
      gastoIdsPerene: new Set(),
      gastoIdsParcela: new Set(['quit']),
      compromissosParcelados: [],
    });
    expect(fatias).toHaveLength(0);
  });

  it('inclui compromisso quitado no histórico e ignora cancelado', () => {
    const fatias = montarFatiasDivida({
      hoje: HOJE,
      gastos: [],
      tipoGastoPorId: new Map(),
      gastoIdsPerene: new Set(),
      gastoIdsParcela: new Set(),
      compromissosParcelados: [
        compromisso({
          id: 'c1',
          dataCompra: '01/08/2026',
          total: 30000,
          parcelas: [
            {
              id: 'p1', compromissoId: 'c1', numeroParcela: 1, totalParcelas: 3,
              valorCentavos: 10000, dataVencimentoBR: '01/09/2026', status: 'quitado',
            },
            {
              id: 'p2', compromissoId: 'c1', numeroParcela: 2, totalParcelas: 3,
              valorCentavos: 10000, dataVencimentoBR: '01/11/2026', status: 'pendente',
            },
            {
              id: 'p3', compromissoId: 'c1', numeroParcela: 3, totalParcelas: 3,
              valorCentavos: 10000, dataVencimentoBR: '01/12/2026', status: 'cancelado',
            },
          ],
        }),
      ],
    });
    expect(fatias.map((f) => f.id)).toEqual(['comp-parc:p1', 'comp-parc:p2']);
    expect(fatias[0].situacao).toBe('quitado');
    expect(fatias[1].situacao).toBe('pendente');
    expect(fatias.every((f) => f.natureza === 'nao_classificado')).toBe(true);
    expect(fatias.every((f) => f.instituicao === INSTITUICAO_NAO_INFORMADA)).toBe(true);
  });
});

describe('montarComprasNovas', () => {
  it('lista compras pelo mês da data_compra sem lump no eixo', () => {
    const compras = montarComprasNovas({
      hoje: HOJE,
      gastos: [gasto({ id: 'g1', dataCompra: '12/09/2026', total: 50000, parcelas: 5 })],
      tipoGastoPorId: new Map([['g1', 'Empresa']]),
      gastoIdsPerene: new Set(),
      gastoIdsParcela: new Set(),
      compromissosParcelados: [
        compromisso({
          id: 'c1',
          dataCompra: '05/09/2026',
          total: 20000,
          parcelas: [
            {
              id: 'p1', compromissoId: 'c1', numeroParcela: 1, totalParcelas: 2,
              valorCentavos: 10000, dataVencimentoBR: '05/10/2026', status: 'pendente',
            },
            {
              id: 'p2', compromissoId: 'c1', numeroParcela: 2, totalParcelas: 2,
              valorCentavos: 10000, dataVencimentoBR: '05/11/2026', status: 'pendente',
            },
          ],
        }),
      ],
    });
    expect(compras).toHaveLength(2);
    expect(compras.every((c) => c.monthKeyCompra === '2026-09')).toBe(true);
    expect(compras.reduce((s, c) => s + c.totalCents, 0)).toBe(70000);
  });
});
