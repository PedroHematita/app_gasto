import { describe, expect, it } from 'vitest';
import {
  aplicarFiltrosEOrdenacaoClassificacao,
  badgePagamentoClassificacao,
  buscarFornecedoresClassificacao,
  compareGastoClassificacaoDesc,
  dataCompraTabelaClassificacao,
  filtrarGastosClassificacaoPorData,
  filtrarGastosClassificacaoPorFornecedor,
  filtrarGastosClassificacaoPorPagamento,
  filtrarGastosClassificacaoPorClassificacao,
  gastoPassaFiltroClassificacaoRapida,
  formaPagamentoChaveClassificacao,
  fornecedorChaveClassificacao,
  gastoPassaFiltroPagamentoClassificacao,
  listarInstituicoesClassificacao,
  listarMeiosPagamentoClassificacao,
  fornecedorExibicaoClassificacao,
  formaPagamentoTabelaClassificacao,
  gastoPassaFiltroDataClassificacao,
  gastoEstaClassificado,
  gastoPassaFiltroFornecedorClassificacao,
  idsVisiveisParaClassificacao,
  intervaloFiltroDataClassificacao,
  mapGastoClassificacaoRowFromDb,
  statusClassificacaoTabela,
  TIPO_GASTO_NAO_CLASSIFICADO,
  linhaPagamentoClassificacao,
  listarFornecedoresClassificacao,
  meioPagamentoTabelaClassificacao,
  proximaOrdenacaoValorClassificacao,
  rotuloFiltroFornecedorClassificacao,
  rotuloFiltroPagamentoClassificacao,
  sortGastosClassificacaoDesc,
  sortGastosClassificacaoValor,
  valorTabelaClassificacao,
  CLASSIFICACAO_GASTO_OPCOES,
  montarPayloadClassificacaoSimples,
  validarClassificacaoMassa,
  validarClassificacaoMassaComAuth,
  CLASSIFICAR_FILTRO_PAGAMENTO_VAZIO,
  CLASSIFICAR_FILTROS_VAZIO,
  CLASSIFICAR_ORDENACAO_PADRAO,
} from './utils';
import type { GastoClassificacaoRow } from './types';

function row(partial: Partial<GastoClassificacaoRow> & Pick<GastoClassificacaoRow, 'id'>): GastoClassificacaoRow {
  return {
    dataCompra: '2026-05-23',
    dataCompraBR: '23/05/2026',
    fornecedor: 'Teste',
    formaPagamento: 'À Vista',
    meioPagamento: 'PIX',
    instituicaoFinanceira: 'Nubank',
    total: 18_000,
    quemGastou: null,
    tipoGasto: TIPO_GASTO_NAO_CLASSIFICADO,
    setor: null,
    dataClassificacao: null,
    responsavelClassificacao: null,
    ...partial,
  };
}

describe('gastoEstaClassificado', () => {
  it('retorna false para Não Classificado', () => {
    expect(gastoEstaClassificado({ tipoGasto: TIPO_GASTO_NAO_CLASSIFICADO })).toBe(false);
  });

  it('retorna false para string vazia', () => {
    expect(gastoEstaClassificado({ tipoGasto: '' })).toBe(false);
  });

  it('retorna false para somente espaços', () => {
    expect(gastoEstaClassificado({ tipoGasto: '   ' })).toBe(false);
  });

  it('retorna true para Empresarial', () => {
    expect(gastoEstaClassificado({ tipoGasto: 'Empresarial' })).toBe(true);
  });
});

describe('statusClassificacaoTabela', () => {
  it('não classificado', () => {
    expect(
      statusClassificacaoTabela({
        tipoGasto: TIPO_GASTO_NAO_CLASSIFICADO,
        setor: null,
        quemGastou: null,
      })
    ).toBe('Não classificado');
  });

  it('tipo e setor', () => {
    expect(
      statusClassificacaoTabela({
        tipoGasto: 'Empresarial',
        setor: 'Operacional',
        quemGastou: 'Madrigal',
      })
    ).toBe('Empresarial · Operacional');
  });

  it('tipo e quem quando setor vazio', () => {
    expect(
      statusClassificacaoTabela({
        tipoGasto: 'Pessoal',
        setor: null,
        quemGastou: 'Pedro',
      })
    ).toBe('Pessoal · Pedro');
    expect(
      statusClassificacaoTabela({
        tipoGasto: 'Empresarial',
        setor: null,
        quemGastou: 'Madrigal',
      })
    ).toBe('Empresarial · Madrigal');
  });

  it('somente tipo', () => {
    expect(
      statusClassificacaoTabela({ tipoGasto: 'Empresarial', setor: null, quemGastou: null })
    ).toBe('Empresarial');
  });
});

describe('montarPayloadClassificacaoSimples', () => {
  it('Pessoal grava Pedro sem setor', () => {
    expect(montarPayloadClassificacaoSimples('Pessoal')).toEqual({
      tipoGasto: 'Pessoal',
      quemGastou: 'Pedro',
      setor: null,
    });
  });

  it('Empresa grava Madrigal sem setor', () => {
    expect(montarPayloadClassificacaoSimples('Empresa')).toEqual({
      tipoGasto: 'Empresarial',
      quemGastou: 'Madrigal',
      setor: null,
    });
  });
});

describe('mapGastoClassificacaoRowFromDb', () => {
  it('mapeia tipo_gasto nulo para Não Classificado', () => {
    const mapped = mapGastoClassificacaoRowFromDb({
      id: 'g1',
      data_compra: '2026-05-25',
      tipo_gasto: null,
      total: 13,
    });
    expect(mapped.tipoGasto).toBe(TIPO_GASTO_NAO_CLASSIFICADO);
    expect(mapped.quemGastou).toBeNull();
    expect(mapped.dataCompraBR).toBe('25/05/2026');
  });

  it('mapeia campos de classificação preenchidos', () => {
    const mapped = mapGastoClassificacaoRowFromDb({
      id: 'g2',
      data_compra: '2026-05-20',
      tipo_gasto: 'Empresarial',
      setor: 'Operacional',
      quem_gastou: 'João',
      data_classificacao: '2026-05-21T10:00:00Z',
      responsavel_classificacao: 'uuid-1',
      total: 100,
    });
    expect(mapped.tipoGasto).toBe('Empresarial');
    expect(mapped.setor).toBe('Operacional');
    expect(mapped.quemGastou).toBe('João');
    expect(mapped.dataClassificacao).toBe('2026-05-21T10:00:00Z');
    expect(mapped.responsavelClassificacao).toBe('uuid-1');
  });
});

describe('fornecedorChaveClassificacao', () => {
  it('fornecedor vazio vira Sem fornecedor', () => {
    expect(fornecedorChaveClassificacao('')).toBe('Sem fornecedor');
    expect(fornecedorChaveClassificacao('   ')).toBe('Sem fornecedor');
    expect(fornecedorChaveClassificacao('  Vivo  ')).toBe('Vivo');
  });
});

describe('fornecedorExibicaoClassificacao', () => {
  it('retorna Sem fornecedor quando vazio', () => {
    expect(fornecedorExibicaoClassificacao('')).toBe('Sem fornecedor');
    expect(fornecedorExibicaoClassificacao('   ')).toBe('Sem fornecedor');
  });
});

describe('listarFornecedoresClassificacao', () => {
  it('remove duplicados e ordena alfabeticamente pt-BR', () => {
    const lista = listarFornecedoresClassificacao([
      row({ id: '1', fornecedor: 'Zebra' }),
      row({ id: '2', fornecedor: 'Alpha' }),
      row({ id: '3', fornecedor: 'Alpha' }),
      row({ id: '4', fornecedor: '' }),
    ]);
    expect(lista).toEqual(['Alpha', 'Sem fornecedor', 'Zebra']);
  });
});

describe('buscarFornecedoresClassificacao', () => {
  it('encontra fornecedor por parte do nome case-insensitive', () => {
    const base = ['Robinho Bar', 'Vivo', 'Sem fornecedor'];
    expect(buscarFornecedoresClassificacao(base, 'rob')).toEqual(['Robinho Bar']);
    expect(buscarFornecedoresClassificacao(base, 'VIV')).toEqual(['Vivo']);
    expect(buscarFornecedoresClassificacao(base, '')).toEqual(base);
  });
});

describe('gastoPassaFiltroFornecedorClassificacao', () => {
  it('filtro vazio deixa todos passarem', () => {
    expect(
      gastoPassaFiltroFornecedorClassificacao(row({ id: '1', fornecedor: 'Vivo' }), [])
    ).toBe(true);
  });

  it('filtro com 1 fornecedor retorna apenas esse', () => {
    const g = row({ id: '1', fornecedor: 'Robinho Bar' });
    expect(gastoPassaFiltroFornecedorClassificacao(g, ['Robinho Bar'])).toBe(true);
    expect(gastoPassaFiltroFornecedorClassificacao(g, ['Vivo'])).toBe(false);
  });

  it('registro vazio combina com Sem fornecedor', () => {
    expect(
      gastoPassaFiltroFornecedorClassificacao(row({ id: '1', fornecedor: '' }), [
        'Sem fornecedor',
      ])
    ).toBe(true);
  });

  it('filtro com 2 fornecedores usa lógica OR', () => {
    expect(
      gastoPassaFiltroFornecedorClassificacao(row({ id: '1', fornecedor: 'Vivo' }), [
        'Robinho Bar',
        'Vivo',
      ])
    ).toBe(true);
    expect(
      gastoPassaFiltroFornecedorClassificacao(row({ id: '2', fornecedor: 'Outro' }), [
        'Robinho Bar',
        'Vivo',
      ])
    ).toBe(false);
  });
});

describe('filtrarGastosClassificacaoPorFornecedor', () => {
  it('filtra por chaves selecionadas', () => {
    const gastos = [
      row({ id: 'a', fornecedor: 'Vivo' }),
      row({ id: 'b', fornecedor: 'Robinho Bar' }),
    ];
    expect(filtrarGastosClassificacaoPorFornecedor(gastos, ['Vivo']).map((g) => g.id)).toEqual([
      'a',
    ]);
  });
});

describe('rotuloFiltroFornecedorClassificacao', () => {
  it('rótulo com 1 fornecedor', () => {
    expect(rotuloFiltroFornecedorClassificacao(['Robinho Bar'])).toBe(
      'Fornecedor: Robinho Bar'
    );
  });

  it('rótulo com vários fornecedores', () => {
    expect(rotuloFiltroFornecedorClassificacao(['A', 'B', 'C'])).toBe(
      'Fornecedor: 3 selecionados'
    );
  });

  it('sem seleção retorna null', () => {
    expect(rotuloFiltroFornecedorClassificacao([])).toBeNull();
  });
});

describe('dataCompraTabelaClassificacao', () => {
  it('formata dd/mm/aaaa a partir da ISO', () => {
    expect(dataCompraTabelaClassificacao('2026-05-25')).toBe('25/05/2026');
    expect(dataCompraTabelaClassificacao('2026-05-23')).toBe('23/05/2026');
  });
});

describe('badgePagamentoClassificacao', () => {
  it('à vista com instituição', () => {
    expect(
      badgePagamentoClassificacao({
        formaPagamento: 'À Vista',
        instituicaoFinanceira: 'Nubank',
      })
    ).toBe('À Vista · Nubank');
  });

  it('parcelado com parcelas', () => {
    expect(
      badgePagamentoClassificacao({
        formaPagamento: 'Parcelado',
        parcelas: 3,
        instituicaoFinanceira: 'Nubank PJ',
      })
    ).toBe('Parc. 3x · Nubank PJ');
  });
});

describe('formaPagamentoTabelaClassificacao', () => {
  it('à vista sem 1x', () => {
    expect(formaPagamentoTabelaClassificacao({ formaPagamento: 'À Vista' })).toBe('À Vista');
  });

  it('parcelado com parcelas', () => {
    expect(
      formaPagamentoTabelaClassificacao({ formaPagamento: 'Parcelado', parcelas: 3 })
    ).toBe('Parc. 3x');
  });

  it('parcelado sem numero_parcelas', () => {
    expect(formaPagamentoTabelaClassificacao({ formaPagamento: 'Parcelado' })).toBe('Parcelado');
  });
});

describe('meioPagamentoTabelaClassificacao', () => {
  it('abrevia meios longos', () => {
    expect(meioPagamentoTabelaClassificacao('Cartão de Crédito')).toBe('Crédito');
    expect(meioPagamentoTabelaClassificacao('Cartão de Débito')).toBe('Débito');
    expect(meioPagamentoTabelaClassificacao('Transferência Bancária')).toBe('Transf.');
    expect(meioPagamentoTabelaClassificacao('Boleto Parcelado')).toBe('Bol. Parc.');
  });

  it('mantém PIX e Boleto', () => {
    expect(meioPagamentoTabelaClassificacao('PIX')).toBe('PIX');
    expect(meioPagamentoTabelaClassificacao('Boleto')).toBe('Boleto');
  });
});

describe('valorTabelaClassificacao', () => {
  it('formata com prefixo R$', () => {
    expect(valorTabelaClassificacao(1300)).toMatch(/13,00/);
    expect(valorTabelaClassificacao(1300)).toMatch(/R\$/);
    expect(valorTabelaClassificacao(125_000)).toMatch(/1\.250,00/);
    expect(valorTabelaClassificacao(125_000)).toMatch(/R\$/);
  });
});

describe('linhaPagamentoClassificacao', () => {
  it('à vista sem 1x', () => {
    expect(
      linhaPagamentoClassificacao({
        formaPagamento: 'À Vista',
        meioPagamento: 'PIX',
        instituicaoFinanceira: 'Nubank',
      })
    ).toBe('À Vista · PIX · Nubank');
  });
});

const REF_MAY_25_2026 = new Date(2026, 4, 25);

describe('intervaloFiltroDataClassificacao', () => {
  it('hoje usa apenas a data de referência', () => {
    expect(
      intervaloFiltroDataClassificacao({ preset: 'hoje', dataInicial: null, dataFinal: null }, REF_MAY_25_2026)
    ).toEqual({ inicio: '2026-05-25', fim: '2026-05-25' });
  });

  it('ultimos 7 dias inclui 6 dias antes da referência', () => {
    expect(
      intervaloFiltroDataClassificacao(
        { preset: 'ultimos_7', dataInicial: null, dataFinal: null },
        REF_MAY_25_2026
      )
    ).toEqual({ inicio: '2026-05-19', fim: '2026-05-25' });
  });

  it('este mês cobre o mês civil da referência', () => {
    expect(
      intervaloFiltroDataClassificacao(
        { preset: 'este_mes', dataInicial: null, dataFinal: null },
        REF_MAY_25_2026
      )
    ).toEqual({ inicio: '2026-05-01', fim: '2026-05-31' });
  });
});

describe('gastoPassaFiltroDataClassificacao', () => {
  it('inclui gasto dentro do intervalo do preset', () => {
    expect(
      gastoPassaFiltroDataClassificacao(
        row({ id: '1', dataCompra: '2026-05-25' }),
        { preset: 'hoje', dataInicial: null, dataFinal: null },
        REF_MAY_25_2026
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroDataClassificacao(
        row({ id: '2', dataCompra: '2026-04-01' }),
        { preset: 'hoje', dataInicial: null, dataFinal: null },
        REF_MAY_25_2026
      )
    ).toBe(false);
  });
});

describe('filtrarGastosClassificacaoPorData', () => {
  it('retorna todos quando filtro vazio', () => {
    const gastos = [
      row({ id: 'a', dataCompra: '2026-05-01' }),
      row({ id: 'b', dataCompra: '2026-05-25' }),
    ];
    expect(
      filtrarGastosClassificacaoPorData(gastos, {
        preset: null,
        dataInicial: null,
        dataFinal: null,
      })
    ).toHaveLength(2);
  });
});

describe('sortGastosClassificacaoValor', () => {
  it('ordena por centavos asc com desempate por data desc', () => {
    const sorted = sortGastosClassificacaoValor(
      [
        row({ id: 'a', dataCompra: '2026-05-20', total: 5000 }),
        row({ id: 'b', dataCompra: '2026-05-25', total: 1000 }),
        row({ id: 'c', dataCompra: '2026-05-10', total: 1000 }),
      ],
      'asc'
    );
    expect(sorted.map((g) => g.id)).toEqual(['b', 'c', 'a']);
  });

  it('ordena por centavos desc', () => {
    const sorted = sortGastosClassificacaoValor(
      [
        row({ id: 'a', total: 1000 }),
        row({ id: 'b', total: 9000 }),
      ],
      'desc'
    );
    expect(sorted.map((g) => g.id)).toEqual(['b', 'a']);
  });
});

describe('gastoPassaFiltroPagamentoClassificacao', () => {
  it('filtro vazio deixa todos passarem', () => {
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({ id: '1', formaPagamento: 'À Vista', meioPagamento: 'PIX' }),
        CLASSIFICAR_FILTRO_PAGAMENTO_VAZIO
      )
    ).toBe(true);
  });

  it('forma À Vista retorna apenas gastos à vista', () => {
    const filtro = { formas: ['a_vista' as const], meios: [], instituicoes: [] };
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({ id: '1', formaPagamento: 'À Vista' }),
        filtro
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({ id: '2', formaPagamento: 'Parcelado' }),
        filtro
      )
    ).toBe(false);
  });

  it('forma Parcelado retorna apenas gastos parcelados', () => {
    const filtro = { formas: ['parcelado' as const], meios: [], instituicoes: [] };
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({ id: '1', formaPagamento: 'Parcelado' }),
        filtro
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({ id: '2', formaPagamento: 'À Vista' }),
        filtro
      )
    ).toBe(false);
  });

  it('meio Crédito retorna Cartão de Crédito', () => {
    const filtro = {
      formas: [],
      meios: ['Cartão de Crédito'],
      instituicoes: [],
    };
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({ id: '1', meioPagamento: 'Cartão de Crédito' }),
        filtro
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({ id: '2', meioPagamento: 'PIX' }),
        filtro
      )
    ).toBe(false);
  });

  it('meio PIX retorna gastos com PIX', () => {
    const filtro = { formas: [], meios: ['PIX'], instituicoes: [] };
    expect(
      gastoPassaFiltroPagamentoClassificacao(row({ id: '1', meioPagamento: 'PIX' }), filtro)
    ).toBe(true);
  });

  it('dois meios usam OR', () => {
    const filtro = {
      formas: [],
      meios: ['PIX', 'Boleto'],
      instituicoes: [],
    };
    expect(
      gastoPassaFiltroPagamentoClassificacao(row({ id: '1', meioPagamento: 'PIX' }), filtro)
    ).toBe(true);
    expect(
      gastoPassaFiltroPagamentoClassificacao(row({ id: '2', meioPagamento: 'Boleto' }), filtro)
    ).toBe(true);
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({ id: '3', meioPagamento: 'Cartão de Débito' }),
        filtro
      )
    ).toBe(false);
  });

  it('instituição Nubank retorna apenas essa instituição', () => {
    const filtro = { formas: [], meios: [], instituicoes: ['Nubank'] };
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({ id: '1', instituicaoFinanceira: 'Nubank' }),
        filtro
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({ id: '2', instituicaoFinanceira: 'Nubank PJ' }),
        filtro
      )
    ).toBe(false);
  });

  it('forma + meio + instituição usam AND entre grupos', () => {
    const filtro = {
      formas: ['parcelado' as const],
      meios: ['Cartão de Crédito', 'Boleto'],
      instituicoes: ['Nubank PJ'],
    };
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({
          id: '1',
          formaPagamento: 'Parcelado',
          meioPagamento: 'Cartão de Crédito',
          instituicaoFinanceira: 'Nubank PJ',
        }),
        filtro
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({
          id: '2',
          formaPagamento: 'Parcelado',
          meioPagamento: 'PIX',
          instituicaoFinanceira: 'Nubank PJ',
        }),
        filtro
      )
    ).toBe(false);
    expect(
      gastoPassaFiltroPagamentoClassificacao(
        row({
          id: '3',
          formaPagamento: 'À Vista',
          meioPagamento: 'Cartão de Crédito',
          instituicaoFinanceira: 'Nubank PJ',
        }),
        filtro
      )
    ).toBe(false);
  });
});

describe('listarInstituicoesClassificacao', () => {
  it('remove duplicados e ordena pt-BR', () => {
    expect(
      listarInstituicoesClassificacao([
        row({ id: '1', instituicaoFinanceira: 'Nubank PJ' }),
        row({ id: '2', instituicaoFinanceira: 'Nubank' }),
        row({ id: '3', instituicaoFinanceira: 'Nubank' }),
        row({ id: '4', instituicaoFinanceira: '' }),
      ])
    ).toEqual(['Nubank', 'Nubank PJ']);
  });
});

describe('listarMeiosPagamentoClassificacao', () => {
  it('lista apenas meios presentes nos gastos', () => {
    const meios = listarMeiosPagamentoClassificacao([
      row({ id: '1', meioPagamento: 'PIX' }),
      row({ id: '2', meioPagamento: 'Cartão de Crédito' }),
    ]);
    expect(meios.map((m) => m.canonico)).toEqual(['PIX', 'Cartão de Crédito']);
    expect(meios.map((m) => m.rotulo)).toEqual(['PIX', 'Crédito']);
  });
});

describe('formaPagamentoChaveClassificacao', () => {
  it('identifica parcelado e à vista', () => {
    expect(formaPagamentoChaveClassificacao('Parcelado')).toBe('parcelado');
    expect(formaPagamentoChaveClassificacao('À Vista')).toBe('a_vista');
  });
});

describe('rotuloFiltroPagamentoClassificacao', () => {
  it('rótulo com 1 critério de forma', () => {
    expect(
      rotuloFiltroPagamentoClassificacao({
        formas: ['a_vista'],
        meios: [],
        instituicoes: [],
      })
    ).toBe('Pagamento: À Vista');
  });

  it('rótulo com vários critérios', () => {
    expect(
      rotuloFiltroPagamentoClassificacao({
        formas: ['parcelado'],
        meios: ['PIX'],
        instituicoes: ['Nubank'],
      })
    ).toBe('Pagamento: 3 critérios');
  });

  it('rótulo com 1 meio', () => {
    expect(
      rotuloFiltroPagamentoClassificacao({
        formas: [],
        meios: ['Cartão de Crédito'],
        instituicoes: [],
      })
    ).toBe('Pagamento: Crédito');
  });
});

describe('proximaOrdenacaoValorClassificacao', () => {
  it('cicla asc, desc e padrão', () => {
    expect(proximaOrdenacaoValorClassificacao(CLASSIFICAR_ORDENACAO_PADRAO)).toEqual({
      modo: 'valor',
      direcao: 'asc',
    });
    expect(
      proximaOrdenacaoValorClassificacao({ modo: 'valor', direcao: 'asc' })
    ).toEqual({ modo: 'valor', direcao: 'desc' });
    expect(
      proximaOrdenacaoValorClassificacao({ modo: 'valor', direcao: 'desc' })
    ).toEqual(CLASSIFICAR_ORDENACAO_PADRAO);
  });
});

describe('gastoPassaFiltroClassificacaoRapida', () => {
  it('todos aceita qualquer gasto', () => {
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: TIPO_GASTO_NAO_CLASSIFICADO, quemGastou: null },
        'todos'
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: 'Pessoal', quemGastou: 'Pedro' },
        'todos'
      )
    ).toBe(true);
  });

  it('não classificados usa gastoEstaClassificado', () => {
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: TIPO_GASTO_NAO_CLASSIFICADO, quemGastou: null },
        'nao_classificados'
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: '', quemGastou: null },
        'nao_classificados'
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: 'Pessoal', quemGastou: 'Pedro' },
        'nao_classificados'
      )
    ).toBe(false);
  });

  it('pessoal exige tipo Pessoal e quem Pedro quando preenchido', () => {
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: 'Pessoal', quemGastou: 'Pedro' },
        'pessoal'
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: 'Pessoal', quemGastou: null },
        'pessoal'
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: 'Pessoal', quemGastou: 'Madrigal' },
        'pessoal'
      )
    ).toBe(false);
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: 'Empresarial', quemGastou: 'Pedro' },
        'pessoal'
      )
    ).toBe(false);
  });

  it('empresa exige tipo Empresarial e quem Madrigal quando preenchido', () => {
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: 'Empresarial', quemGastou: 'Madrigal' },
        'empresa'
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: 'Empresarial', quemGastou: null },
        'empresa'
      )
    ).toBe(true);
    expect(
      gastoPassaFiltroClassificacaoRapida(
        { tipoGasto: 'Empresarial', quemGastou: 'Pedro' },
        'empresa'
      )
    ).toBe(false);
  });
});

describe('filtrarGastosClassificacaoPorClassificacao', () => {
  it('retorna todos quando filtro é todos', () => {
    const gastos = [
      row({ id: 'a', tipoGasto: TIPO_GASTO_NAO_CLASSIFICADO }),
      row({ id: 'b', tipoGasto: 'Pessoal', quemGastou: 'Pedro' }),
    ];
    expect(filtrarGastosClassificacaoPorClassificacao(gastos, 'todos')).toHaveLength(2);
  });

  it('filtra apenas não classificados', () => {
    const gastos = [
      row({ id: 'a', tipoGasto: TIPO_GASTO_NAO_CLASSIFICADO }),
      row({ id: 'b', tipoGasto: 'Pessoal', quemGastou: 'Pedro' }),
    ];
    expect(
      filtrarGastosClassificacaoPorClassificacao(gastos, 'nao_classificados').map((g) => g.id)
    ).toEqual(['a']);
  });
});

describe('aplicarFiltrosEOrdenacaoClassificacao', () => {
  it('aplica filtro de data e ordenação por valor', () => {
    const gastos = [
      row({ id: 'a', dataCompra: '2026-05-25', total: 3000 }),
      row({ id: 'b', dataCompra: '2026-05-25', total: 1000 }),
      row({ id: 'c', dataCompra: '2026-04-01', total: 500 }),
    ];
    const result = aplicarFiltrosEOrdenacaoClassificacao(
      gastos,
      {
        data: { preset: 'hoje', dataInicial: null, dataFinal: null },
        fornecedores: [],
        pagamento: CLASSIFICAR_FILTRO_PAGAMENTO_VAZIO,
        classificacao: 'todos',
      },
      { modo: 'valor', direcao: 'asc' },
      REF_MAY_25_2026
    );
    expect(result.map((g) => g.id)).toEqual(['b', 'a']);
  });

  it('combina filtro de data e fornecedor', () => {
    const gastos = [
      row({ id: 'a', dataCompra: '2026-05-25', fornecedor: 'Vivo' }),
      row({ id: 'b', dataCompra: '2026-05-25', fornecedor: 'Robinho Bar' }),
      row({ id: 'c', dataCompra: '2026-04-01', fornecedor: 'Vivo' }),
    ];
    const result = aplicarFiltrosEOrdenacaoClassificacao(
      gastos,
      {
        data: { preset: 'hoje', dataInicial: null, dataFinal: null },
        fornecedores: ['Vivo'],
        pagamento: CLASSIFICAR_FILTRO_PAGAMENTO_VAZIO,
        classificacao: 'todos',
      },
      CLASSIFICAR_ORDENACAO_PADRAO,
      REF_MAY_25_2026
    );
    expect(result.map((g) => g.id)).toEqual(['a']);
  });

  it('combina data + fornecedor + pagamento + ordenação', () => {
    const gastos = [
      row({
        id: 'a',
        dataCompra: '2026-05-25',
        fornecedor: 'Vivo',
        formaPagamento: 'Parcelado',
        meioPagamento: 'Cartão de Crédito',
        instituicaoFinanceira: 'Nubank PJ',
        total: 5000,
      }),
      row({
        id: 'b',
        dataCompra: '2026-05-25',
        fornecedor: 'Vivo',
        formaPagamento: 'Parcelado',
        meioPagamento: 'PIX',
        instituicaoFinanceira: 'Nubank PJ',
        total: 1000,
      }),
      row({
        id: 'c',
        dataCompra: '2026-05-25',
        fornecedor: 'Robinho Bar',
        formaPagamento: 'Parcelado',
        meioPagamento: 'Cartão de Crédito',
        instituicaoFinanceira: 'Nubank PJ',
      }),
    ];
    const result = aplicarFiltrosEOrdenacaoClassificacao(
      gastos,
      {
        data: { preset: 'hoje', dataInicial: null, dataFinal: null },
        fornecedores: ['Vivo'],
        pagamento: {
          formas: ['parcelado'],
          meios: ['Cartão de Crédito'],
          instituicoes: ['Nubank PJ'],
        },
        classificacao: 'todos',
      },
      { modo: 'valor', direcao: 'asc' },
      REF_MAY_25_2026
    );
    expect(result.map((g) => g.id)).toEqual(['a']);
  });

  it('aplica filtro rápido de classificação pessoal', () => {
    const gastos = [
      row({ id: 'a', tipoGasto: TIPO_GASTO_NAO_CLASSIFICADO }),
      row({ id: 'b', tipoGasto: 'Pessoal', quemGastou: 'Pedro' }),
      row({ id: 'c', tipoGasto: 'Empresarial', quemGastou: 'Madrigal' }),
    ];
    const result = aplicarFiltrosEOrdenacaoClassificacao(
      gastos,
      { ...CLASSIFICAR_FILTROS_VAZIO, classificacao: 'pessoal' },
      CLASSIFICAR_ORDENACAO_PADRAO
    );
    expect(result.map((g) => g.id)).toEqual(['b']);
  });

  it('sem filtro usa ordenação padrão por data', () => {
    const gastos = [
      row({ id: 'a', dataCompra: '2026-05-01' }),
      row({ id: 'b', dataCompra: '2026-06-01' }),
    ];
    const result = aplicarFiltrosEOrdenacaoClassificacao(
      gastos,
      CLASSIFICAR_FILTROS_VAZIO,
      CLASSIFICAR_ORDENACAO_PADRAO
    );
    expect(result.map((g) => g.id)).toEqual(['b', 'a']);
  });
});

describe('sortGastosClassificacaoDesc', () => {
  it('ordena por data ISO desc e created_at desc', () => {
    const sorted = sortGastosClassificacaoDesc([
      row({ id: 'a', dataCompra: '2026-05-01', createdAt: '2026-05-02T10:00:00Z' }),
      row({ id: 'b', dataCompra: '2026-06-05', createdAt: '2026-06-05T08:00:00Z' }),
      row({ id: 'c', dataCompra: '2026-06-05', createdAt: '2026-06-05T12:00:00Z' }),
    ]);
    expect(sorted.map((g) => g.id)).toEqual(['c', 'b', 'a']);
  });

  it('compare usa ISO não BR', () => {
    const a = row({ id: '1', dataCompra: '2026-12-01', dataCompraBR: '01/12/2026' });
    const b = row({ id: '2', dataCompra: '2026-05-23', dataCompraBR: '23/05/2026' });
    expect(compareGastoClassificacaoDesc(a, b)).toBeLessThan(0);
  });
});

describe('validarClassificacaoMassa', () => {
  const base = {
    ids: ['g1'],
    responsavelClassificacao: 'user-uuid',
  };

  it('rejeita sem IDs', () => {
    expect(
      validarClassificacaoMassa({ ...base, ids: [], classificacao: 'Pessoal' })
    ).toEqual({ ok: false, mensagem: 'Não é possível classificar sem seleção.' });
  });

  it('rejeita sem classificação escolhida', () => {
    expect(validarClassificacaoMassa({ ...base, classificacao: '' })).toEqual({
      ok: false,
      mensagem: 'Escolha uma classificação.',
    });
  });

  it('aceita Pessoal com payload fixo', () => {
    expect(validarClassificacaoMassa({ ...base, classificacao: 'Pessoal' })).toEqual({
      ok: true,
      payload: { tipoGasto: 'Pessoal', quemGastou: 'Pedro', setor: null },
    });
  });

  it('aceita Empresa com payload fixo', () => {
    expect(validarClassificacaoMassa({ ...base, classificacao: 'Empresa' })).toEqual({
      ok: true,
      payload: { tipoGasto: 'Empresarial', quemGastou: 'Madrigal', setor: null },
    });
  });

  it('opções do modal são apenas Pessoal e Empresa', () => {
    expect(CLASSIFICACAO_GASTO_OPCOES).toEqual(['Pessoal', 'Empresa']);
  });
});

describe('validarClassificacaoMassaComAuth', () => {
  it('exige usuário autenticado', () => {
    expect(
      validarClassificacaoMassaComAuth({
        ids: ['g1'],
        classificacao: 'Empresa',
        responsavelClassificacao: null,
      })
    ).toEqual({ ok: false, mensagem: 'Faça login para classificar gastos.' });
  });
});

describe('idsVisiveisParaClassificacao', () => {
  it('retorna interseção com gastos visíveis', () => {
    const visiveis = [row({ id: 'a' }), row({ id: 'b' }), row({ id: 'c' })];
    expect(idsVisiveisParaClassificacao(new Set(['a', 'c', 'x']), visiveis)).toEqual(['a', 'c']);
  });
});
