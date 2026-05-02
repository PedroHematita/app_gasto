import { describe, expect, it } from 'vitest';
import type { CompromissoRecord, GastoRecord, GastoPereneRecord } from '../types';
import {
  consolidarGastosFuturos,
  mesCalendarioSobrepoeJanela,
} from './gastosFuturosConsolidacao';

const refHoje = new Date(2026, 4, 2);

describe('mesCalendarioSobrepoeJanela', () => {
  const start = new Date(2026, 4, 2);
  const end = new Date(2027, 4, 2);

  it('junho/2026 intersecta [mai/2026, mai/2027]', () => {
    expect(mesCalendarioSobrepoeJanela(2026, 6, start, end)).toBe(true);
  });

  it('maio/2027 intersecta', () => {
    expect(mesCalendarioSobrepoeJanela(2027, 5, start, end)).toBe(true);
  });

  it('abril/2026 antes da janela — não intersecta', () => {
    expect(mesCalendarioSobrepoeJanela(2026, 4, start, end)).toBe(false);
  });

  it('junho/2027 depois da janela — não intersecta', () => {
    expect(mesCalendarioSobrepoeJanela(2027, 6, start, end)).toBe(false);
  });
});

function gpBase(over: Partial<GastoPereneRecord>): GastoPereneRecord {
  return {
    id: 'gp1',
    fornecedor: 'Perene X',
    valorPrevistoCents: 100_00,
    periodicidade: 'mensal',
    diaVencimento: 10,
    mesVencimento: null,
    dataInicio: '01/01/2020',
    dataTermino: null,
    observacoes: '',
    status: 'ativo',
    createdAt: '',
    ...over,
  };
}

describe('consolidarGastosFuturos', () => {
  it('lista vazia quando não há dados', () => {
    expect(
      consolidarGastosFuturos({
        hoje: refHoje,
        gastosPerenes: [],
        compromissos: [],
        gastos: [],
        incluirRealizados: false,
      })
    ).toEqual([]);
  });

  it('inclui compromisso com data prevista igual a hoje (limite inferior inclusivo)', () => {
    const hoje = new Date(2026, 4, 2);
    const c: CompromissoRecord = {
      id: 'c-hoje',
      dataCompra: '01/05/2026',
      dataPrevistaPagamento: '02/05/2026',
      fornecedor: 'Vence hoje',
      status: 'pendente',
      total: 10_00,
      createdAt: '',
      gastoId: null,
      gastoPereneId: null,
      competenciaChave: null,
      items: [],
    };
    const anos = consolidarGastosFuturos({
      hoje,
      gastosPerenes: [],
      compromissos: [c],
      gastos: [],
      incluirRealizados: false,
    });
    const mai = anos.flatMap((a) => a.months).find((m) => m.key === '2026-05');
    expect(mai?.itens.some((i) => i.compromissoId === 'c-hoje')).toBe(true);
  });

  it('coloca compromisso no mês da data prevista', () => {
    const c: CompromissoRecord = {
      id: 'c1',
      dataCompra: '01/05/2026',
      dataPrevistaPagamento: '15/06/2026',
      fornecedor: 'Fornecedor C',
      status: 'pendente',
      total: 50_00,
      createdAt: '',
      gastoId: null,
      gastoPereneId: null,
      competenciaChave: null,
      items: [],
    };
    const anos = consolidarGastosFuturos({
      hoje: refHoje,
      gastosPerenes: [],
      compromissos: [c],
      gastos: [],
      incluirRealizados: false,
    });
    expect(anos.length).toBe(1);
    expect(anos[0].year).toBe(2026);
    expect(anos[0].months.length).toBe(1);
    expect(anos[0].months[0].key).toBe('2026-06');
    expect(anos[0].months[0].itens[0].origem).toBe('rascunho');
    expect(anos[0].months[0].itens[0].valorCents).toBe(50_00);
    expect(anos[0].months[0].totalCents).toBe(50_00);
  });

  it('com incluirRealizados adiciona linha realizada no mês da compra', () => {
    const g: GastoRecord = {
      id: 'g1',
      seq: 1,
      dataCompra: '20/06/2026',
      fornecedor: 'Loja',
      formaPagamento: 'À Vista',
      meioPagamento: 'PIX',
      instituicaoFinanceira: '',
      observacoes: '',
      total: 80_00,
      comprovanteUrl: '',
      createdAt: '',
      items: [],
    };
    const anos = consolidarGastosFuturos({
      hoje: refHoje,
      gastosPerenes: [],
      compromissos: [],
      gastos: [g],
      incluirRealizados: true,
    });
    const junho = anos.flatMap((a) => a.months).find((m) => m.key === '2026-06');
    expect(junho?.itens.some((i) => i.origem === 'realizado' && i.gastoId === 'g1')).toBe(true);
  });

  it('parcelado gera linhas parcelado no mês do vencimento', () => {
    const g: GastoRecord = {
      id: 'g2',
      seq: 1,
      dataCompra: '01/05/2026',
      fornecedor: 'Cartão',
      formaPagamento: 'Parcelado',
      meioPagamento: 'Crédito',
      instituicaoFinanceira: '',
      observacoes: '',
      total: 300_00,
      parcelas: 3,
      comprovanteUrl: '',
      createdAt: '',
      items: [],
    };
    const anos = consolidarGastosFuturos({
      hoje: refHoje,
      gastosPerenes: [],
      compromissos: [],
      gastos: [g],
      incluirRealizados: false,
    });
    const meses = anos.flatMap((a) => a.months);
    const keys = meses.map((m) => m.key).sort();
    expect(keys).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(meses.every((m) => m.itens.every((i) => i.origem === 'parcelado'))).toBe(true);
  });

  it('perene mensal gera um item por vencimento no período', () => {
    const gp = gpBase({ diaVencimento: 6 });
    const anos = consolidarGastosFuturos({
      hoje: refHoje,
      gastosPerenes: [gp],
      compromissos: [],
      gastos: [],
      incluirRealizados: false,
    });
    const jun = anos.flatMap((a) => a.months).find((m) => m.key === '2026-06');
    expect(jun?.itens.length).toBeGreaterThanOrEqual(1);
    expect(jun?.itens[0].origem).toBe('perene');
  });
});
