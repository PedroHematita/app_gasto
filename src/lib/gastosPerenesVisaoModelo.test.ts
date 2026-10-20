import { describe, expect, it } from 'vitest';
import type { CompromissoRecord, GastoPereneRecord, GastoRecord } from '../types';
import { montarLinhasPerenesVisao } from './gastosPerenesVisaoModelo';
import { colunasPerenes, composicaoDoMes, filtrarLinhasPerenes, totalDoMes } from './gastosPerenesVisaoConsulta';

function gasto(partial: Partial<GastoRecord> & Pick<GastoRecord, 'id' | 'dataCompra' | 'total'>): GastoRecord {
  return {
    seq: 1,
    fornecedor: 'Aluguel',
    formaPagamento: 'À Vista',
    meioPagamento: 'PIX',
    instituicaoFinanceira: 'Nubank',
    observacoes: '',
    comprovanteUrl: '',
    items: [],
    createdAt: '2026-01-01',
    ...partial,
  };
}

function perene(partial: Partial<GastoPereneRecord> & Pick<GastoPereneRecord, 'id' | 'fornecedor' | 'valorPrevistoCents'>): GastoPereneRecord {
  return {
    periodicidade: 'mensal',
    diaVencimento: 10,
    mesVencimento: null,
    dataInicio: '01/01/2026',
    dataTermino: null,
    observacoes: '',
    status: 'ativo',
    createdAt: '2026-01-01',
    ...partial,
  };
}

function compromisso(partial: Partial<CompromissoRecord> & Pick<CompromissoRecord, 'id' | 'dataPrevistaPagamento' | 'total'>): CompromissoRecord {
  return {
    dataCompra: '01/10/2026',
    fornecedor: 'Internet',
    status: 'pendente',
    tipo: 'unico',
    createdAt: '2026-01-01',
    gastoId: null,
    gastoPereneId: 'p1',
    competenciaChave: '2026-10',
    items: [],
    ...partial,
  };
}

const HOJE = new Date(2026, 9, 20);

describe('montarLinhasPerenesVisao', () => {
  it('não duplica quitação e compromisso da mesma competência', () => {
    const linhas = montarLinhasPerenesVisao({
      hoje: HOJE,
      gastos: [gasto({ id: 'g1', dataCompra: '10/10/2026', total: 12000, fornecedor: 'Internet' })],
      tipoGastoPorId: new Map([['g1', 'Pessoal']]),
      gastoIdsPerene: new Set(['g1']),
      gastoPereneIdPorGastoId: new Map([['g1', 'p1']]),
      compromissos: [
        compromisso({
          id: 'c1',
          dataPrevistaPagamento: '10/10/2026',
          total: 12000,
          status: 'quitado',
          gastoId: 'g1',
          gastoPereneId: 'p1',
        }),
      ],
      perenes: [perene({ id: 'p1', fornecedor: 'Internet', valorPrevistoCents: 12000 })],
    });
    expect(linhas.filter((l) => l.monthKey === '2026-10')).toHaveLength(1);
    expect(linhas[0].situacao).toBe('realizado');
    expect(linhas[0].natureza).toBe('pessoal');
    expect(linhas[0].periodicidade).toBe('mensal');
  });

  it('omite previsão quando já existe compromisso na data', () => {
    const linhas = montarLinhasPerenesVisao({
      hoje: HOJE,
      gastos: [],
      tipoGastoPorId: new Map(),
      gastoIdsPerene: new Set(),
      gastoPereneIdPorGastoId: new Map(),
      compromissos: [
        compromisso({
          id: 'c1',
          dataPrevistaPagamento: '10/11/2026',
          total: 12000,
          gastoPereneId: 'p1',
        }),
      ],
      perenes: [perene({ id: 'p1', fornecedor: 'Internet', valorPrevistoCents: 12000 })],
    });
    const nov = linhas.filter((l) => l.monthKey === '2026-11');
    expect(nov).toHaveLength(1);
    expect(nov[0].id.startsWith('comp-perene:')).toBe(true);
    expect(nov[0].situacao).toBe('pendente');
  });

  it('respeita periodicidade anual (não soma em todos os meses)', () => {
    const linhas = montarLinhasPerenesVisao({
      hoje: new Date(2026, 0, 15),
      gastos: [],
      tipoGastoPorId: new Map(),
      gastoIdsPerene: new Set(),
      gastoPereneIdPorGastoId: new Map(),
      compromissos: [],
      perenes: [
        perene({
          id: 'anual',
          fornecedor: 'Seguro',
          valorPrevistoCents: 240000,
          periodicidade: 'anual',
          diaVencimento: 5,
          mesVencimento: 3,
          dataInicio: '01/01/2025',
        }),
      ],
    });
    const meses = [...new Set(linhas.map((l) => l.monthKey))];
    expect(meses.every((m) => m.endsWith('-03'))).toBe(true);
    expect(linhas.every((l) => l.situacao === 'projecao')).toBe(true);
  });

  it('filtra natureza e mantém soma da composição igual à coluna', () => {
    const linhas = montarLinhasPerenesVisao({
      hoje: HOJE,
      gastos: [
        gasto({ id: 'g1', dataCompra: '05/10/2026', total: 60000, fornecedor: 'Aluguel' }),
        gasto({ id: 'g2', dataCompra: '08/10/2026', total: 15000, fornecedor: 'Cowork' }),
      ],
      tipoGastoPorId: new Map([['g1', 'Pessoal'], ['g2', 'Empresa']]),
      gastoIdsPerene: new Set(['g1', 'g2']),
      gastoPereneIdPorGastoId: new Map([['g1', 'p1'], ['g2', 'p2']]),
      compromissos: [],
      perenes: [
        perene({ id: 'p1', fornecedor: 'Aluguel', valorPrevistoCents: 60000 }),
        perene({ id: 'p2', fornecedor: 'Cowork', valorPrevistoCents: 15000 }),
      ],
    });
    const pessoais = filtrarLinhasPerenes(linhas, 'pessoal');
    expect(pessoais).toHaveLength(1);
    const colunas = colunasPerenes(pessoais, HOJE);
    const out = colunas.find((c) => c.monthKey === '2026-10');
    expect(out?.totalCents).toBe(60000);
    expect(totalDoMes(pessoais, '2026-10')).toBe(60000);
    expect(composicaoDoMes(pessoais, '2026-10').reduce((s, l) => s + l.valorCents, 0)).toBe(60000);
  });
});
