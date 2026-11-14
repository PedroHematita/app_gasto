import { describe, expect, it } from 'vitest';
import {
  CALENDARIO_CARTAO_PADRAO,
  calendarioCartaoPorInstituicao,
  dataVencimentoFaturaCartao,
  ocorrenciaFaturaCartao,
  primeiraFaturaElegivel,
} from './calendarioFaturaCartao';
import { parseDateBR } from '../utils';

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

describe('calendário informado das faturas', () => {
  it('usa fechamento dia 3, vencimento nominal dia 10 e referência 13 sem virar vencimento', () => {
    expect(CALENDARIO_CARTAO_PADRAO).toEqual({
      diaFechamento: 3,
      diaVencimento: 10,
      diaReferenciaPagamentoInformado: 13,
    });
    const oc = ocorrenciaFaturaCartao('14/11/2026', 1, 'Nubank')!;
    expect(toYmd(oc.dataVencimento)).toBe('2026-12-10');
    expect(toYmd(oc.dataReferenciaPagamentoInformada!)).toBe('2026-12-13');
    expect(oc.dataReferenciaPagamentoInformada!.getTime()).not.toBe(oc.dataVencimento.getTime());
  });

  it('aplica o mesmo calendário inicial às instituições cadastradas', () => {
    for (const nome of ['Nubank', 'Nubank PJ', 'C6 Madrigal', '']) {
      expect(calendarioCartaoPorInstituicao(nome)).toEqual(CALENDARIO_CARTAO_PADRAO);
    }
  });
});

describe('primeira fatura elegível (fechamento inclusivo)', () => {
  it('compra antes e no dia do fechamento permanece no mês', () => {
    expect(primeiraFaturaElegivel(parseDateBR('02/11/2026')!)).toEqual({ year: 2026, month0: 10 });
    expect(primeiraFaturaElegivel(parseDateBR('03/11/2026')!)).toEqual({ year: 2026, month0: 10 });
  });

  it('compra após o fechamento vai para o ciclo seguinte', () => {
    expect(primeiraFaturaElegivel(parseDateBR('04/11/2026')!)).toEqual({ year: 2026, month0: 11 });
    expect(primeiraFaturaElegivel(parseDateBR('14/11/2026')!)).toEqual({ year: 2026, month0: 11 });
  });
});

describe('ocorrenciaFaturaCartao', () => {
  it('à vista: 02/11 e 03/11 vencem em 10/11; 04/11 e 14/11 em 10/12', () => {
    expect(toYmd(dataVencimentoFaturaCartao('02/11/2026', 1)!)).toBe('2026-11-10');
    expect(toYmd(dataVencimentoFaturaCartao('03/11/2026', 1)!)).toBe('2026-11-10');
    expect(toYmd(dataVencimentoFaturaCartao('04/11/2026', 1)!)).toBe('2026-12-10');
    expect(toYmd(dataVencimentoFaturaCartao('14/11/2026', 1)!)).toBe('2026-12-10');
  });

  it('parcelado 3x em 05/11/2026: dez, jan e fev no dia 10', () => {
    expect(toYmd(dataVencimentoFaturaCartao('05/11/2026', 1)!)).toBe('2026-12-10');
    expect(toYmd(dataVencimentoFaturaCartao('05/11/2026', 2)!)).toBe('2027-01-10');
    expect(toYmd(dataVencimentoFaturaCartao('05/11/2026', 3)!)).toBe('2027-02-10');
  });

  it('compra em dezembro após o fechamento muda o ano', () => {
    expect(toYmd(dataVencimentoFaturaCartao('20/12/2026', 1)!)).toBe('2027-01-10');
  });
});
