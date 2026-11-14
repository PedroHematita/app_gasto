import { describe, expect, it } from 'vitest';
import type { CompromissoRecord, GastoPereneRecord, GastoRecord } from '../types';
import {
  MODALIDADES_VISAO,
  calcularEvolucao,
  filtrarLinhasVisao,
  montarLinhasVisao,
  naturezaDeTipoGasto,
  resumirLinhasVisao,
  type MontarVisaoInput,
} from './visaoFinanceiraModelo';

const HOJE = new Date(2026, 9, 19);

function gasto(partial: Partial<GastoRecord> & Pick<GastoRecord, 'id' | 'total' | 'dataCompra'>): GastoRecord {
  return {
    seq: 1,
    fornecedor: 'Fornecedor',
    formaPagamento: 'À Vista',
    meioPagamento: 'PIX',
    instituicaoFinanceira: '',
    observacoes: '',
    comprovanteUrl: '',
    createdAt: '2026-01-01T00:00:00Z',
    items: [],
    ...partial,
  };
}

function compromisso(partial: Partial<CompromissoRecord> & Pick<CompromissoRecord, 'id'>): CompromissoRecord {
  return {
    dataCompra: '01/10/2026',
    dataPrevistaPagamento: '19/10/2026',
    fornecedor: 'Compromisso',
    status: 'pendente',
    tipo: 'unico',
    total: 1000,
    createdAt: '2026-01-01T00:00:00Z',
    gastoId: null,
    gastoPereneId: null,
    competenciaChave: null,
    items: [],
    ...partial,
  };
}

function perene(partial: Partial<GastoPereneRecord> = {}): GastoPereneRecord {
  return {
    id: 'perene-1',
    fornecedor: 'Aluguel',
    valorPrevistoCents: 5000,
    periodicidade: 'mensal',
    diaVencimento: 19,
    mesVencimento: null,
    dataInicio: '01/01/2026',
    dataTermino: null,
    observacoes: '',
    status: 'ativo',
    createdAt: '2026-01-01T00:00:00Z',
    ...partial,
  };
}

function base(partial: Partial<MontarVisaoInput> = {}): MontarVisaoInput {
  return {
    hoje: HOJE,
    gastos: [],
    tipoGastoPorId: new Map(),
    gastoIdsPerene: new Set(),
    gastoIdsParcela: new Set(),
    compromissos: [],
    perenes: [],
    perspectiva: 'registrados',
    ...partial,
  };
}

describe('naturezaDeTipoGasto', () => {
  it('não inventa natureza quando o campo está vazio ou no padrão', () => {
    expect(naturezaDeTipoGasto(null)).toBe('nao_classificado');
    expect(naturezaDeTipoGasto('Não Classificado')).toBe('nao_classificado');
    expect(naturezaDeTipoGasto('Pessoal')).toBe('pessoal');
    expect(naturezaDeTipoGasto('Empresarial')).toBe('empresa');
  });
});

describe('montarLinhasVisao', () => {
  it('mantém o parcelado integral no mês da compra em Gastos registrados', () => {
    const linhas = montarLinhasVisao(base({
      gastos: [gasto({
        id: 'g1',
        total: 300,
        dataCompra: '01/08/2026',
        formaPagamento: 'Parcelado',
        parcelas: 3,
        fornecedor: 'Loja',
      })],
      tipoGastoPorId: new Map([['g1', 'Pessoal']]),
    }));

    expect(linhas).toHaveLength(1);
    expect(linhas[0].monthKey).toBe('2026-08');
    expect(linhas[0].valorCents).toBe(300);
    expect(linhas[0].modalidade).toBe('parcelado');
    expect(linhas[0].situacao).toBe('realizado');
    expect(linhas[0].formaPagamento).toBe('Parcelado');
  });

  it('reparte o parcelado na agenda do comprometimento, sempre como previsão', () => {
    const compra = gasto({
      id: 'g1',
      total: 300,
      dataCompra: '01/08/2026',
      formaPagamento: 'Parcelado',
      parcelas: 3,
      fornecedor: 'Loja',
    });
    const avista = gasto({ id: 'g2', total: 1000, dataCompra: '15/09/2026', fornecedor: 'Mercado' });
    const linhas = montarLinhasVisao(base({
      perspectiva: 'comprometimento',
      gastos: [compra, avista],
      tipoGastoPorId: new Map([['g1', 'Pessoal']]),
    }));

    expect(linhas).toHaveLength(3);
    expect(linhas.reduce((s, item) => s + item.valorCents, 0)).toBe(300);
    expect(linhas.every((item) => item.situacao === 'projecao')).toBe(true);
    expect(linhas.map((item) => item.monthKey)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(linhas.some((item) => item.id.startsWith('gasto:g2'))).toBe(false);
  });

  it('conta só a parcela em aberto do compromisso, sem o total do pai', () => {
    const linhas = montarLinhasVisao(base({
      perspectiva: 'comprometimento',
      compromissos: [compromisso({
        id: 'c1',
        tipo: 'parcelado',
        total: 99999,
        parcelas: [
          {
            id: 'p1',
            compromissoId: 'c1',
            numeroParcela: 1,
            totalParcelas: 2,
            valorCentavos: 400,
            dataVencimentoBR: '10/09/2026',
            status: 'quitado',
          },
          {
            id: 'p2',
            compromissoId: 'c1',
            numeroParcela: 2,
            totalParcelas: 2,
            valorCentavos: 600,
            dataVencimentoBR: '10/11/2026',
            status: 'pendente',
          },
        ],
      })],
    }));

    expect(linhas).toHaveLength(1);
    expect(linhas[0].valorCents).toBe(600);
    expect(linhas[0].situacao).toBe('pendente');
    expect(linhas[0].natureza).toBe('nao_classificado');
    expect(linhas[0].naturezaObservacao).toBeTruthy();
    expect(linhas[0].formaPagamento).toBeNull();
    expect(linhas[0].meioPagamento).toBeNull();
    expect(linhas[0].instituicaoFinanceira).toBeNull();
  });

  it('não projeta o perene na data em que já existe compromisso', () => {
    const linhas = montarLinhasVisao(base({
      perspectiva: 'comprometimento',
      perenes: [perene()],
      compromissos: [compromisso({
        id: 'c-out',
        gastoPereneId: 'perene-1',
        dataPrevistaPagamento: '19/10/2026',
        total: 5000,
        fornecedor: 'Aluguel',
      })],
    }));

    const outubro = linhas.filter((item) => item.monthKey === '2026-10');
    expect(outubro).toHaveLength(1);
    expect(outubro[0].id).toBe('comp:c-out');
    expect(outubro[0].situacao).toBe('pendente');
    expect(linhas.some((item) => item.id === 'prev-perene:perene-1:2026-11-19')).toBe(true);
    expect(linhas.some((item) => item.id === 'prev-perene:perene-1:2026-10-19')).toBe(false);
  });

  it('coloca o perene quitado só em registrados e não o projeta de novo', () => {
    const entrada = {
      gastos: [gasto({ id: 'gq', total: 5000, dataCompra: '19/09/2026', fornecedor: 'Aluguel' })],
      tipoGastoPorId: new Map([['gq', 'Empresarial']]),
      gastoIdsPerene: new Set(['gq']),
      perenes: [perene()],
    };
    const registrados = montarLinhasVisao(base(entrada));
    const comprometido = montarLinhasVisao(base({ ...entrada, perspectiva: 'comprometimento' }));

    expect(registrados.filter((item) => item.monthKey === '2026-09')).toEqual([
      expect.objectContaining({ modalidade: 'perene', natureza: 'empresa', situacao: 'realizado', valorCents: 5000 }),
    ]);
    expect(comprometido.some((item) => item.monthKey === '2026-09')).toBe(false);
    expect(comprometido.some((item) => item.id === 'prev-perene:perene-1:2026-11-19')).toBe(true);
  });

  it('na visão completa mostra o à vista e reparte o parcelado sem repetir o valor', () => {
    const linhas = montarLinhasVisao(base({
      perspectiva: 'completa',
      gastos: [
        gasto({ id: 'avista', total: 1000, dataCompra: '15/09/2026', fornecedor: 'Mercado' }),
        gasto({
          id: 'cartao',
          total: 300,
          dataCompra: '01/08/2026',
          formaPagamento: 'Parcelado',
          parcelas: 3,
          fornecedor: 'Loja',
        }),
      ],
      perenes: [perene()],
      compromissos: [compromisso({
        id: 'c-out',
        gastoPereneId: 'perene-1',
        dataPrevistaPagamento: '19/10/2026',
        total: 5000,
        fornecedor: 'Aluguel',
      })],
    }));

    const setembro = linhas.filter((item) => item.monthKey === '2026-09');
    expect(setembro.map((item) => item.id).sort()).toEqual(['agenda:cartao:1', 'gasto:avista']);
    expect(setembro.find((item) => item.id === 'gasto:avista')?.modalidade).toBe('demais');
    expect(setembro.find((item) => item.id === 'gasto:avista')?.situacao).toBe('realizado');
    expect(linhas.filter((item) => item.id.startsWith('agenda:cartao')).map((item) => item.situacao)).toEqual([
      'projecao',
      'projecao',
      'projecao',
    ]);
    expect(linhas.some((item) => item.monthKey === '2026-08' && item.id === 'gasto:cartao')).toBe(false);
    expect(linhas.filter((item) => item.id === 'comp:c-out' || item.id === 'prev-perene:perene-1:2026-10-19')).toHaveLength(1);
    expect(linhas.some((item) => item.id === 'prev-perene:perene-1:2026-11-19')).toBe(true);
  });

  it('soma os registrados como Meus Gastos: integral no mês da data, sem compromisso em aberto', () => {
    const linhas = montarLinhasVisao(base({
      gastos: [
        gasto({ id: 'a', total: 1551959, dataCompra: '10/09/2026' }),
        gasto({ id: 'b', total: 30000, dataCompra: '02/09/2026', formaPagamento: 'Parcelado', parcelas: 3 }),
      ],
      compromissos: [compromisso({ id: 'aberto', total: 999 })],
    }));
    const setembro = linhas.filter((item) => item.monthKey === '2026-09');
    expect(setembro.reduce((s, item) => s + item.valorCents, 0)).toBe(1551959 + 30000);
    expect(linhas.some((item) => item.id.startsWith('comp:'))).toBe(false);
  });
});

describe('agenda de compra à vista no cartão de crédito', () => {
  const creditoAvista = gasto({
    id: 'credito',
    total: 25001,
    dataCompra: '15/11/2026',
    formaPagamento: 'À Vista',
    meioPagamento: 'Cartão de Crédito',
    instituicaoFinanceira: 'Nubank',
    fornecedor: 'Mercado',
  });

  it('não inclui PIX nem débito à vista no comprometimento', () => {
    const pix = gasto({ id: 'pix', total: 1000, dataCompra: '15/11/2026' });
    const debito = gasto({
      id: 'deb', total: 2000, dataCompra: '15/11/2026', meioPagamento: 'Cartão de Débito',
    });
    const linhas = montarLinhasVisao(base({
      perspectiva: 'comprometimento',
      gastos: [pix, debito],
    }));
    expect(linhas.some((item) => item.id.startsWith('agenda:'))).toBe(false);
    expect(linhas.some((item) => item.id.startsWith('gasto:'))).toBe(false);
  });

  it('projeta uma ocorrência no vencimento nominal da fatura, Demais gastos, instituição e natureza originais', () => {
    const linhas = montarLinhasVisao(base({
      perspectiva: 'comprometimento',
      gastos: [creditoAvista],
      tipoGastoPorId: new Map([['credito', 'Pessoal']]),
    }));
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      id: 'agenda:credito:1',
      monthKey: '2026-12',
      valorCents: 25001,
      modalidade: 'demais',
      situacao: 'projecao',
      natureza: 'pessoal',
      instituicaoFinanceira: 'Nubank',
      meioPagamento: 'Cartão de Crédito',
      formaPagamento: 'À Vista',
      fornecedor: 'Mercado',
    });
    expect(linhas[0].dataRef.getDate()).toBe(10);
    expect(linhas[0].dataRef.getMonth()).toBe(11);
  });

  it('compra no fechamento entra na fatura do mês; após o fechamento, no ciclo seguinte', () => {
    const input = { perspectiva: 'comprometimento' as const };
    const noDia = montarLinhasVisao(base({
      ...input,
      gastos: [gasto({
        id: 'fecha', total: 1000, dataCompra: '03/11/2026',
        formaPagamento: 'À Vista', meioPagamento: 'Cartão de Crédito',
      })],
    }));
    const depois = montarLinhasVisao(base({
      ...input,
      gastos: [gasto({
        id: 'depois', total: 1000, dataCompra: '04/11/2026',
        formaPagamento: 'À Vista', meioPagamento: 'Cartão de Crédito',
      })],
    }));
    expect(noDia[0].monthKey).toBe('2026-11');
    expect(noDia[0].dataRef.getDate()).toBe(10);
    expect(depois[0].monthKey).toBe('2026-12');
    expect(depois[0].dataRef.getDate()).toBe(10);
  });

  it('compra em dezembro projeta janeiro do ano seguinte', () => {
    const linhas = montarLinhasVisao(base({
      perspectiva: 'comprometimento',
      gastos: [gasto({
        id: 'dez',
        total: 8000,
        dataCompra: '20/12/2026',
        formaPagamento: 'À Vista',
        meioPagamento: 'Cartão de Crédito',
      })],
    }));
    expect(linhas[0].monthKey).toBe('2027-01');
    expect(linhas[0].dataRef.getFullYear()).toBe(2027);
    expect(linhas[0].dataRef.getMonth()).toBe(0);
    expect(linhas[0].dataRef.getDate()).toBe(10);
  });

  it('na visão completa aparece só no vencimento projetado, sem duplicar o mês da compra', () => {
    const linhas = montarLinhasVisao(base({
      perspectiva: 'completa',
      gastos: [creditoAvista],
      tipoGastoPorId: new Map([['credito', 'Pessoal']]),
    }));
    expect(linhas.filter((item) => item.id === 'gasto:credito')).toHaveLength(0);
    expect(linhas.filter((item) => item.id === 'agenda:credito:1')).toHaveLength(1);
    expect(linhas.filter((item) => item.monthKey === '2026-11')).toHaveLength(0);
    const dezembro = linhas.filter((item) => item.monthKey === '2026-12');
    expect(dezembro.reduce((s, item) => s + item.valorCents, 0)).toBe(25001);
    expect(resumirLinhasVisao(dezembro).porModalidade.demais).toBe(25001);
    expect(resumirLinhasVisao(dezembro).porModalidade.parcelado).toBe(0);
  });

  it('Gastos registrados continuam no mês da data_compra', () => {
    const linhas = montarLinhasVisao(base({
      perspectiva: 'registrados',
      gastos: [creditoAvista],
    }));
    expect(linhas.map((item) => item.id)).toEqual(['gasto:credito']);
    expect(linhas[0].monthKey).toBe('2026-11');
    expect(linhas[0].valorCents).toBe(25001);
    expect(linhas[0].modalidade).toBe('demais');
  });

  it('preserva parcelado no crédito e em outros meios; gráfico não mistura à vista crédito com parcelado', () => {
    const linhas = montarLinhasVisao(base({
      perspectiva: 'comprometimento',
      gastos: [
        creditoAvista,
        gasto({
          id: 'parc-cred', total: 30000, dataCompra: '15/11/2026',
          formaPagamento: 'Parcelado', parcelas: 3, meioPagamento: 'Cartão de Crédito',
        }),
        gasto({
          id: 'parc-pix', total: 20000, dataCompra: '15/11/2026',
          formaPagamento: 'Parcelado', parcelas: 2, meioPagamento: 'PIX',
        }),
      ],
    }));
    expect(linhas.filter((item) => item.id.startsWith('agenda:credito:'))).toHaveLength(1);
    expect(linhas.filter((item) => item.id.startsWith('agenda:parc-cred:'))).toHaveLength(3);
    expect(linhas.filter((item) => item.id.startsWith('agenda:parc-pix:'))).toHaveLength(2);
    expect(linhas.find((item) => item.id === 'agenda:credito:1')?.modalidade).toBe('demais');
    expect(linhas.filter((item) => item.id.startsWith('agenda:parc-cred:')).every((item) => item.modalidade === 'parcelado')).toBe(true);
  });

  it('parcelado no crédito segue o ciclo da fatura; PIX parcelado permanece no dia 6', () => {
    const linhas = montarLinhasVisao(base({
      perspectiva: 'comprometimento',
      gastos: [
        gasto({
          id: 'cred', total: 60000, dataCompra: '05/11/2026',
          formaPagamento: 'Parcelado', parcelas: 3, meioPagamento: 'Cartão de Crédito',
          instituicaoFinanceira: 'Nubank',
        }),
        gasto({
          id: 'pix', total: 40000, dataCompra: '05/11/2026',
          formaPagamento: 'Parcelado', parcelas: 2, meioPagamento: 'PIX',
        }),
      ],
    }));
    const cred = linhas.filter((item) => item.id.startsWith('agenda:cred:'));
    const pix = linhas.filter((item) => item.id.startsWith('agenda:pix:'));
    expect(cred.map((item) => item.monthKey)).toEqual(['2026-12', '2027-01', '2027-02']);
    expect(cred.every((item) => item.dataRef.getDate() === 10)).toBe(true);
    expect(cred.reduce((s, item) => s + item.valorCents, 0)).toBe(60000);
    expect(pix.map((item) => item.monthKey)).toEqual(['2026-12', '2027-01']);
    expect(pix.every((item) => item.dataRef.getDate() === 6)).toBe(true);
  });

  it('editar a data da compra reposiciona a fatura; editar o meio de PIX para crédito gera agenda', () => {
    const baseGasto = {
      id: 'edit',
      total: 4000,
      formaPagamento: 'À Vista' as const,
      meioPagamento: 'Cartão de Crédito',
    };
    const input = { perspectiva: 'comprometimento' as const };
    const antesFecha = montarLinhasVisao(base({
      ...input,
      gastos: [gasto({ ...baseGasto, dataCompra: '02/11/2026' })],
    }));
    const depoisFecha = montarLinhasVisao(base({
      ...input,
      gastos: [gasto({ ...baseGasto, dataCompra: '04/11/2026' })],
    }));
    expect(antesFecha[0].monthKey).toBe('2026-11');
    expect(depoisFecha[0].monthKey).toBe('2026-12');

    const comoPix = gasto({ id: 'edit', total: 4000, dataCompra: '10/11/2026' });
    const comoCredito = { ...comoPix, meioPagamento: 'Cartão de Crédito' };
    expect(montarLinhasVisao(base({ ...input, gastos: [comoPix] }))).toHaveLength(0);
    expect(montarLinhasVisao(base({ ...input, gastos: [comoCredito] }))).toHaveLength(1);
    expect(montarLinhasVisao(base({ ...input, gastos: [comoPix] }))).toHaveLength(0);
  });
});

describe('filtros e evolução', () => {
  const linhas = montarLinhasVisao(base({
    gastos: [
      gasto({ id: 'p', total: 1000, dataCompra: '02/09/2026', fornecedor: 'Pessoal' }),
      gasto({ id: 'e', total: 2000, dataCompra: '02/10/2026', fornecedor: 'Empresa' }),
    ],
    tipoGastoPorId: new Map([['p', 'Pessoal'], ['e', 'Empresarial']]),
  }));

  it('combina natureza e período', () => {
    const filtradas = filtrarLinhasVisao(linhas, 'pessoal', MODALIDADES_VISAO, 'historico', HOJE);
    expect(filtradas.map((item) => item.id)).toEqual(['gasto:p']);
  });

  it('aplica o mesmo filtro de natureza nas três perspectivas', () => {
    const gastos = [
      gasto({ id: 'p', total: 1000, dataCompra: '02/09/2026', fornecedor: 'Pessoal' }),
      gasto({ id: 'e', total: 2000, dataCompra: '02/09/2026', fornecedor: 'Empresa' }),
    ];
    const tipos = new Map([['p', 'Pessoal'], ['e', 'Empresarial']]);
    for (const perspectiva of ['completa', 'registrados', 'comprometimento'] as const) {
      const montadas = montarLinhasVisao(base({ perspectiva, gastos, tipoGastoPorId: tipos }));
      const pessoal = filtrarLinhasVisao(montadas, 'pessoal', MODALIDADES_VISAO, 'completa', HOJE);
      expect(pessoal.every((item) => item.natureza === 'pessoal')).toBe(true);
      expect(pessoal.some((item) => item.fornecedor === 'Empresa')).toBe(false);
    }
  });

  it('evolução do mês atual não trata mês anterior vazio como queda definitiva quando não há base', () => {
    const soAtual = filtrarLinhasVisao(linhas, 'empresa', MODALIDADES_VISAO, 'completa', HOJE);
    const evolucao = calcularEvolucao(soAtual, 'mes_atual', HOJE);
    expect(evolucao.atualCents).toBe(2000);
    expect(evolucao.anteriorCents).toBe(0);
    expect(evolucao.variacao).toBeNull();
    expect(resumirLinhasVisao(soAtual).porModalidade.demais).toBe(2000);
  });
});
