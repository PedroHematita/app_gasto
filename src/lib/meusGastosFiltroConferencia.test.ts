import { describe, expect, it } from 'vitest';
import type { GastoRecord } from '../types';
import {
  INSTITUICAO_FILTRO_VAZIA,
  filtrarGastosConferencia,
  listarInstituicoesConferencia,
  rotuloFiltroConferencia,
  tipoMovimentacaoDoMeio,
  type MeusGastosFiltroConferencia,
} from './meusGastosFiltroConferencia';
import {
  lerMeusGastosFiltroConferencia,
  limparMeusGastosFiltroConferencia,
  setMeusGastosFiltroConferencia,
} from '../meusGastosFiltroConferenciaState';
import {
  lerClassificarFiltroConferencia,
  limparClassificarFiltroConferencia,
  setClassificarFiltroConferencia,
} from '../classificarFiltroConferenciaState';
import {
  aplicarFiltrosEOrdenacaoClassificacao,
  CLASSIFICAR_FILTROS_VAZIO,
  CLASSIFICAR_ORDENACAO_PADRAO,
} from '../utils';
import type { GastoClassificacaoRow } from '../types';

function gasto(partial: {
  id: string;
  instituicaoFinanceira?: string;
  meioPagamento?: string;
  formaPagamento?: string;
  total?: number;
  dataCompra?: string;
}): GastoRecord {
  return {
    id: partial.id,
    seq: 0,
    dataCompra: partial.dataCompra ?? '10/11/2026',
    fornecedor: partial.id,
    formaPagamento: partial.formaPagamento ?? 'À Vista',
    meioPagamento: partial.meioPagamento ?? '',
    instituicaoFinanceira: partial.instituicaoFinanceira ?? '',
    observacoes: '',
    total: partial.total ?? 1000,
    comprovanteUrl: '',
    createdAt: '2026-11-13T12:00:00.000Z',
    items: [],
  };
}

describe('tipoMovimentacaoDoMeio', () => {
  it('agrupa conta, crédito e outros sem usar a forma de pagamento', () => {
    expect(tipoMovimentacaoDoMeio('PIX')).toBe('conta');
    expect(tipoMovimentacaoDoMeio('Transferência Bancária')).toBe('conta');
    expect(tipoMovimentacaoDoMeio('Boleto')).toBe('conta');
    expect(tipoMovimentacaoDoMeio('Cartão de Débito')).toBe('conta');
    expect(tipoMovimentacaoDoMeio('Cartão de Crédito')).toBe('credito');
    expect(tipoMovimentacaoDoMeio('Dinheiro')).toBe('outros');
    expect(tipoMovimentacaoDoMeio('Financiamento')).toBe('outros');
    expect(tipoMovimentacaoDoMeio('Boleto Parcelado')).toBe('outros');
    expect(tipoMovimentacaoDoMeio('')).toBe('outros');
    expect(tipoMovimentacaoDoMeio('Cheque')).toBe('outros');
  });
});

describe('filtrarGastosConferencia', () => {
  const amostra = [
    gasto({ id: 'pix-c6', instituicaoFinanceira: 'C6 Madrigal', meioPagamento: 'PIX', total: 10 }),
    gasto({ id: 'bol-c6', instituicaoFinanceira: 'C6 Madrigal', meioPagamento: 'Boleto', total: 20 }),
    gasto({ id: 'ted-c6', instituicaoFinanceira: 'C6 Madrigal', meioPagamento: 'Transferência Bancária', total: 30 }),
    gasto({ id: 'deb-c6', instituicaoFinanceira: 'C6 Madrigal', meioPagamento: 'Cartão de Débito', total: 40 }),
    gasto({
      id: 'cred-avista-c6',
      instituicaoFinanceira: 'C6 Madrigal',
      meioPagamento: 'Cartão de Crédito',
      formaPagamento: 'À Vista',
      total: 50,
    }),
    gasto({
      id: 'cred-parc-c6',
      instituicaoFinanceira: 'C6 Madrigal',
      meioPagamento: 'Cartão de Crédito',
      formaPagamento: 'Parcelado',
      total: 60,
    }),
    gasto({ id: 'pix-nu', instituicaoFinanceira: 'Nubank', meioPagamento: 'PIX', total: 70 }),
    gasto({ id: 'din-c6', instituicaoFinanceira: 'C6 Madrigal', meioPagamento: 'Dinheiro', total: 80 }),
    gasto({ id: 'fin-c6', instituicaoFinanceira: 'C6 Madrigal', meioPagamento: 'Financiamento', total: 90 }),
    gasto({ id: 'bp-c6', instituicaoFinanceira: 'C6 Madrigal', meioPagamento: 'Boleto Parcelado', total: 15 }),
    gasto({ id: 'vazio', instituicaoFinanceira: '  ', meioPagamento: '', total: 5 }),
    gasto({ id: 'na', instituicaoFinanceira: '(não se aplica)', meioPagamento: 'PIX', total: 8 }),
  ];

  it('C6 + Conta exclui crédito e outros', () => {
    const filtro: MeusGastosFiltroConferencia = {
      instituicoes: ['C6 Madrigal'],
      tipo: 'conta',
    };
    const ids = filtrarGastosConferencia(amostra, filtro).map((g) => g.id);
    expect(ids.sort()).toEqual(['bol-c6', 'deb-c6', 'pix-c6', 'ted-c6']);
  });

  it('C6 + crédito inclui à vista e parcelado no cartão', () => {
    const ids = filtrarGastosConferencia(amostra, {
      instituicoes: ['C6 Madrigal'],
      tipo: 'credito',
    }).map((g) => g.id);
    expect(ids.sort()).toEqual(['cred-avista-c6', 'cred-parc-c6']);
  });

  it('Nubank + Conta', () => {
    const ids = filtrarGastosConferencia(amostra, {
      instituicoes: ['Nubank'],
      tipo: 'conta',
    }).map((g) => g.id);
    expect(ids).toEqual(['pix-nu']);
  });

  it('múltiplas instituições com tipo todas', () => {
    const ids = filtrarGastosConferencia(amostra, {
      instituicoes: ['C6 Madrigal', 'Nubank'],
      tipo: 'todas',
    }).map((g) => g.id);
    expect(ids).toContain('pix-nu');
    expect(ids).toContain('pix-c6');
    expect(ids).not.toContain('vazio');
  });

  it('outros meios: dinheiro, financiamento, boleto parcelado e sem meio', () => {
    const ids = filtrarGastosConferencia(amostra, {
      instituicoes: [],
      tipo: 'outros',
    }).map((g) => g.id);
    expect(ids.sort()).toEqual(['bp-c6', 'din-c6', 'fin-c6', 'vazio']);
  });

  it('sem instituição entra na chave vazia, distinto de (não se aplica)', () => {
    const chaves = listarInstituicoesConferencia(amostra);
    expect(chaves).toContain('C6 Madrigal');
    expect(chaves).toContain('(não se aplica)');
    expect(chaves).toContain(INSTITUICAO_FILTRO_VAZIA);
    const vazios = filtrarGastosConferencia(amostra, {
      instituicoes: [INSTITUICAO_FILTRO_VAZIA],
      tipo: 'todas',
    });
    expect(vazios.map((g) => g.id)).toEqual(['vazio']);
  });

  it('total do recorte soma só os visíveis', () => {
    const recorte = filtrarGastosConferencia(amostra, {
      instituicoes: ['C6 Madrigal'],
      tipo: 'conta',
    });
    expect(recorte.reduce((s, g) => s + g.total, 0)).toBe(100);
  });

  it('combina com recorte textual prévio (AND)', () => {
    const aposBusca = amostra.filter((g) => g.fornecedor.includes('pix'));
    const recorte = filtrarGastosConferencia(aposBusca, {
      instituicoes: ['C6 Madrigal'],
      tipo: 'conta',
    });
    expect(recorte.map((g) => g.id)).toEqual(['pix-c6']);
  });

  it('rótulo discreto', () => {
    expect(rotuloFiltroConferencia({ instituicoes: ['C6 Madrigal'], tipo: 'conta' }))
      .toBe('C6 Madrigal · Conta');
    expect(rotuloFiltroConferencia({ instituicoes: ['Nubank'], tipo: 'credito' }))
      .toBe('Nubank · Cartão de crédito');
    expect(rotuloFiltroConferencia({ instituicoes: [], tipo: 'todas' })).toBeNull();
  });
});

describe('estado de sessão das abas', () => {
  it('preserva a seleção na sessão e limpa no reset', () => {
    limparMeusGastosFiltroConferencia();
    setMeusGastosFiltroConferencia({ instituicoes: ['C6 Madrigal'], tipo: 'conta' });
    expect(lerMeusGastosFiltroConferencia()).toEqual({
      instituicoes: ['C6 Madrigal'],
      tipo: 'conta',
    });
    limparMeusGastosFiltroConferencia();
    expect(lerMeusGastosFiltroConferencia()).toEqual({ instituicoes: [], tipo: 'todas' });
  });

  it('Meus Gastos e Classificar têm filtros independentes', () => {
    limparMeusGastosFiltroConferencia();
    limparClassificarFiltroConferencia();
    setMeusGastosFiltroConferencia({ instituicoes: ['C6 Madrigal'], tipo: 'conta' });
    setClassificarFiltroConferencia({ instituicoes: ['Nubank'], tipo: 'credito' });
    expect(lerMeusGastosFiltroConferencia()).toEqual({
      instituicoes: ['C6 Madrigal'],
      tipo: 'conta',
    });
    expect(lerClassificarFiltroConferencia()).toEqual({
      instituicoes: ['Nubank'],
      tipo: 'credito',
    });
    limparMeusGastosFiltroConferencia();
    limparClassificarFiltroConferencia();
  });
});

describe('interseção com filtros de Classificar', () => {
  function row(partial: {
    id: string;
    instituicaoFinanceira?: string;
    meioPagamento?: string;
    formaPagamento?: string;
    dataCompra?: string;
    total?: number;
  }): GastoClassificacaoRow {
    return {
      id: partial.id,
      dataCompra: partial.dataCompra ?? '2026-11-10',
      dataCompraBR: '10/11/2026',
      fornecedor: partial.id,
      formaPagamento: partial.formaPagamento ?? 'À Vista',
      meioPagamento: partial.meioPagamento ?? 'PIX',
      instituicaoFinanceira: partial.instituicaoFinanceira ?? '',
      total: partial.total ?? 1000,
      quemGastou: null,
      tipoGasto: 'Não Classificado',
      setor: null,
      dataClassificacao: null,
      responsavelClassificacao: null,
    };
  }

  it('aplica conferência após data/pagamento sem duplicar', () => {
    const gastos = [
      row({ id: 'a', instituicaoFinanceira: 'C6 Madrigal', meioPagamento: 'PIX', total: 10 }),
      row({ id: 'b', instituicaoFinanceira: 'C6 Madrigal', meioPagamento: 'Cartão de Crédito', formaPagamento: 'Parcelado', total: 20 }),
      row({ id: 'c', instituicaoFinanceira: 'Nubank', meioPagamento: 'PIX', total: 30 }),
    ];
    const aposClassificar = aplicarFiltrosEOrdenacaoClassificacao(
      gastos,
      {
        ...CLASSIFICAR_FILTROS_VAZIO,
        pagamento: { formas: [], meios: [], instituicoes: ['C6 Madrigal'] },
      },
      CLASSIFICAR_ORDENACAO_PADRAO,
    );
    expect(aposClassificar.map((g) => g.id).sort()).toEqual(['a', 'b']);
    const visiveis = filtrarGastosConferencia(aposClassificar, {
      instituicoes: [],
      tipo: 'conta',
    });
    expect(visiveis.map((g) => g.id)).toEqual(['a']);
    expect(visiveis.reduce((s, g) => s + g.total, 0)).toBe(10);
    expect(new Set(visiveis.map((g) => g.id)).size).toBe(visiveis.length);
  });
});
