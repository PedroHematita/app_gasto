import { describe, expect, it } from 'vitest';
import type { GastoRecord } from '../types';
import {
  agruparGastosPorDataCompra,
  compareGastosPorDataCompraDesc,
  isoCalendarioDeDataCompraBR,
} from './meusGastosAgrupamento';

function gasto(partial: {
  id: string;
  dataCompra: string;
  createdAt: string;
  total?: number;
  fornecedor?: string;
}): GastoRecord {
  return {
    id: partial.id,
    seq: 0,
    dataCompra: partial.dataCompra,
    fornecedor: partial.fornecedor ?? partial.id,
    formaPagamento: '',
    meioPagamento: '',
    instituicaoFinanceira: '',
    observacoes: '',
    total: partial.total ?? 100,
    comprovanteUrl: '',
    createdAt: partial.createdAt,
    items: [],
  };
}

describe('isoCalendarioDeDataCompraBR', () => {
  it('não usa Date — 31/12 e 01/01 permanecem no calendário informado', () => {
    expect(isoCalendarioDeDataCompraBR('31/12/2025')).toBe('2025-12-31');
    expect(isoCalendarioDeDataCompraBR('01/01/2026')).toBe('2026-01-01');
  });
});

describe('compareGastosPorDataCompraDesc', () => {
  it('ordena pela data_compra, ignorando createdAt mais recente', () => {
    const a = gasto({ id: 'a', dataCompra: '05/10/2026', createdAt: '2026-11-13T10:00:00.000Z' });
    const b = gasto({ id: 'b', dataCompra: '10/11/2026', createdAt: '2026-11-01T10:00:00.000Z' });
    expect(compareGastosPorDataCompraDesc(b, a)).toBeLessThan(0);
    expect(compareGastosPorDataCompraDesc(a, b)).toBeGreaterThan(0);
  });

  it('empate de data_compra usa createdAt e depois id, sem mudar o mês', () => {
    const x = gasto({ id: 'x', dataCompra: '10/11/2026', createdAt: '2026-11-10T08:00:00.000Z' });
    const y = gasto({ id: 'y', dataCompra: '10/11/2026', createdAt: '2026-11-10T12:00:00.000Z' });
    expect(compareGastosPorDataCompraDesc(y, x)).toBeLessThan(0);
    const same = [
      gasto({ id: 'b', dataCompra: '10/11/2026', createdAt: '2026-11-10T12:00:00.000Z' }),
      gasto({ id: 'a', dataCompra: '10/11/2026', createdAt: '2026-11-10T12:00:00.000Z' }),
    ].sort(compareGastosPorDataCompraDesc);
    expect(same.map((g) => g.id)).toEqual(['b', 'a']);
  });
});

describe('agruparGastosPorDataCompra', () => {
  it('coloca cada gasto no mês da data_compra e ordena anos/meses/itens', () => {
    const a = gasto({
      id: 'A',
      dataCompra: '05/10/2026',
      createdAt: '2026-11-13T18:00:00.000Z',
      total: 10,
    });
    const b = gasto({
      id: 'B',
      dataCompra: '10/11/2026',
      createdAt: '2026-11-01T10:00:00.000Z',
      total: 20,
    });
    const c = gasto({
      id: 'C',
      dataCompra: '02/11/2026',
      createdAt: '2026-11-13T18:00:00.000Z',
      total: 30,
    });
    const d = gasto({
      id: 'D',
      dataCompra: '15/12/2025',
      createdAt: '2026-11-13T20:00:00.000Z',
      total: 40,
    });

    const anos = agruparGastosPorDataCompra([a, b, c, d]);

    expect(anos.map((y) => y.year)).toEqual([2026, 2025]);
    expect(anos[0].months.map((m) => m.key)).toEqual(['2026-11', '2026-10']);
    expect(anos[0].months[0].gastos.map((g) => g.id)).toEqual(['B', 'C']);
    expect(anos[0].months[1].gastos.map((g) => g.id)).toEqual(['A']);
    expect(anos[1].months[0].gastos.map((g) => g.id)).toEqual(['D']);

    expect(anos[0].months[0].total).toBe(50);
    expect(anos[0].months[0].count).toBe(2);
    expect(anos[0].months[1].total).toBe(10);
    expect(anos[0].total).toBe(60);
    expect(anos[1].total).toBe(40);
  });

  it('editar data_compra move o gasto de mês sem alterar os demais totais', () => {
    const a = gasto({ id: 'A', dataCompra: '05/10/2026', createdAt: '2026-11-13T18:00:00.000Z', total: 10 });
    const b = gasto({ id: 'B', dataCompra: '10/11/2026', createdAt: '2026-11-01T10:00:00.000Z', total: 20 });
    const antes = agruparGastosPorDataCompra([a, b]);
    expect(antes[0].months.map((m) => m.key)).toEqual(['2026-11', '2026-10']);

    const aEditado = { ...a, dataCompra: '20/11/2026' };
    const depois = agruparGastosPorDataCompra([aEditado, b]);
    expect(depois).toHaveLength(1);
    expect(depois[0].months).toHaveLength(1);
    expect(depois[0].months[0].key).toBe('2026-11');
    expect(depois[0].months[0].gastos.map((g) => g.id)).toEqual(['A', 'B']);
    expect(depois[0].months[0].total).toBe(30);
    expect(depois[0].total).toBe(30);
  });
});
