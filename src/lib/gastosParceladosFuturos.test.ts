import { describe, expect, it } from 'vitest';
import {
  dataVencimentoParcela,
  distribuirValorParcelas,
  fimJanelaDozeMeses,
  isFormaPagamentoParcelado,
  parcelasFuturasDoGasto,
} from './gastosParceladosFuturos';

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('isFormaPagamentoParcelado', () => {
  it('aceita valor gravado pelo App (Parcelado)', () => {
    expect(isFormaPagamentoParcelado('Parcelado')).toBe(true);
  });

  it('aceita minúsculas (legado / outras origens)', () => {
    expect(isFormaPagamentoParcelado('parcelado')).toBe(true);
  });

  it('rejeita À Vista', () => {
    expect(isFormaPagamentoParcelado('À Vista')).toBe(false);
  });
});

describe('dataVencimentoParcela', () => {
  it('compra em 31/01 — parcela 1 é 06/02 (dia 6 fixo, sem overflow do dia da compra)', () => {
    const d = dataVencimentoParcela('31/01/2026', 1)!;
    expect(toYmd(d)).toBe('2026-02-06');
  });

  it('parcela 1 → dia 6 do mês seguinte à compra', () => {
    const d = dataVencimentoParcela('01/05/2026', 1)!;
    expect(toYmd(d)).toBe('2026-06-06');
  });

  it('parcela 2 → +2 meses em relação ao mês da compra, dia 6', () => {
    const d = dataVencimentoParcela('01/05/2026', 2)!;
    expect(toYmd(d)).toBe('2026-07-06');
  });

  it('parcela 3 após compra em maio → agosto dia 6', () => {
    const d = dataVencimentoParcela('15/05/2026', 3)!;
    expect(toYmd(d)).toBe('2026-08-06');
  });
});

describe('distribuirValorParcelas', () => {
  it('divide igualmente e coloca resto na última parcela', () => {
    expect(distribuirValorParcelas(10_001, 3)).toEqual([3333, 3333, 3335]);
  });

  it('valor divisível', () => {
    expect(distribuirValorParcelas(300, 3)).toEqual([100, 100, 100]);
  });
});

describe('fimJanelaDozeMeses', () => {
  it('mesmo dia + 12 meses', () => {
    const hoje = new Date(2026, 4, 2);
    expect(toYmd(fimJanelaDozeMeses(hoje))).toBe('2027-05-02');
  });
});

describe('parcelasFuturasDoGasto', () => {
  const refHoje = new Date(2026, 4, 2);

  it('À vista não gera parcelas futuras', () => {
    expect(
      parcelasFuturasDoGasto(
        {
          dataCompraBR: '01/05/2026',
          totalCents: 60_000,
          formaPagamento: 'À Vista',
          numeroParcelas: 1,
        },
        refHoje
      )
    ).toEqual([]);
  });

  it('parcelado com 1 parcela não entra (filtro n > 1)', () => {
    expect(
      parcelasFuturasDoGasto(
        {
          dataCompraBR: '01/05/2026',
          totalCents: 60_000,
          formaPagamento: 'Parcelado',
          numeroParcelas: 1,
        },
        refHoje
      )
    ).toEqual([]);
  });

  it('três parcelas maio/2026 — jun, jul, ago dentro da janela até mai/2027', () => {
    const list = parcelasFuturasDoGasto(
      {
        dataCompraBR: '01/05/2026',
        totalCents: 300_00,
        formaPagamento: 'Parcelado',
        numeroParcelas: 3,
      },
      refHoje
    );
    expect(list.map((p) => toYmd(p.dataVencimento))).toEqual([
      '2026-06-06',
      '2026-07-06',
      '2026-08-06',
    ]);
    expect(list.map((p) => p.valorCents)).toEqual([100_00, 100_00, 100_00]);
  });

  it('exclui parcela com vencimento <= hoje', () => {
    const hoje = new Date(2026, 5, 10);
    const list = parcelasFuturasDoGasto(
      {
        dataCompraBR: '01/05/2026',
        totalCents: 200_00,
        formaPagamento: 'Parcelado',
        numeroParcelas: 3,
      },
      hoje
    );
    expect(list.map((p) => toYmd(p.dataVencimento))).toEqual(['2026-07-06', '2026-08-06']);
  });

  it('exclui parcelas além do fim da janela 12 meses (fim = mesmo dia + 12 meses)', () => {
    const hoje = new Date(2026, 4, 2);
    const list = parcelasFuturasDoGasto(
      {
        dataCompraBR: '01/05/2026',
        totalCents: 500_00,
        formaPagamento: 'Parcelado',
        numeroParcelas: 24,
      },
      hoje
    );
    const last = list[list.length - 1];
    expect(last && toYmd(last.dataVencimento)).toBe('2027-04-06');
    expect(list.every((p) => p.dataVencimento.getTime() <= fimJanelaDozeMeses(hoje).getTime())).toBe(
      true
    );
  });
});
