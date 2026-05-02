import { describe, expect, it } from 'vitest';
import {
  proximoVencimentoEmOuDepoisDeHoje,
  vencimentosPereneNaJanela,
  type PerenePeriodInput,
} from './gastosPerenePeriods';

/** Referência dos exemplos: 02/05/2026 */
const refDia = new Date(2026, 4, 2);

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const inicio2020: Pick<PerenePeriodInput, 'dataInicio' | 'dataTermino'> = {
  dataInicio: new Date(2020, 0, 1),
  dataTermino: null,
};

describe('vencimentosPereneNaJanela', () => {
  it('mensal dia 6: 1 vencimento em 30 dias (06/05)', () => {
    const input: PerenePeriodInput = {
      ...inicio2020,
      periodicidade: 'mensal',
      diaVencimento: 6,
      mesVencimento: null,
    };
    const v = vencimentosPereneNaJanela(input, refDia, 30);
    expect(v.map(toYmd)).toEqual(['2026-05-06']);
  });

  it('mensal dia 6: 3 vencimentos em 90 dias (jun/jul)', () => {
    const input: PerenePeriodInput = {
      ...inicio2020,
      periodicidade: 'mensal',
      diaVencimento: 6,
      mesVencimento: null,
    };
    const v = vencimentosPereneNaJanela(input, refDia, 90);
    expect(v.map(toYmd)).toEqual(['2026-05-06', '2026-06-06', '2026-07-06']);
  });

  it('trimestral dia 15: 1 vencimento em 90 dias (jun)', () => {
    const input: PerenePeriodInput = {
      ...inicio2020,
      periodicidade: 'trimestral',
      diaVencimento: 15,
      mesVencimento: null,
    };
    const v = vencimentosPereneNaJanela(input, refDia, 90);
    expect(v.map(toYmd)).toEqual(['2026-06-15']);
  });

  it('anual março: 0 vencimentos em 90 dias (próximo só em 2027)', () => {
    const input: PerenePeriodInput = {
      ...inicio2020,
      periodicidade: 'anual',
      diaVencimento: 1,
      mesVencimento: 3,
    };
    expect(vencimentosPereneNaJanela(input, refDia, 90)).toEqual([]);
  });
});

describe('proximoVencimentoEmOuDepoisDeHoje', () => {
  it('mensal dia 6 → 06/05/2026 quando hoje é 02/05/2026', () => {
    const input: PerenePeriodInput = {
      ...inicio2020,
      periodicidade: 'mensal',
      diaVencimento: 6,
      mesVencimento: null,
    };
    expect(toYmd(proximoVencimentoEmOuDepoisDeHoje(input, refDia)!)).toBe('2026-05-06');
  });

  it('mensal dia 10 → 10/05/2026 quando hoje é 02/05/2026', () => {
    const input: PerenePeriodInput = {
      ...inicio2020,
      periodicidade: 'mensal',
      diaVencimento: 10,
      mesVencimento: null,
    };
    expect(toYmd(proximoVencimentoEmOuDepoisDeHoje(input, refDia)!)).toBe('2026-05-10');
  });

  it('anual em janeiro → jan/2027 (01/01/2027) quando hoje é 02/05/2026', () => {
    const input: PerenePeriodInput = {
      ...inicio2020,
      periodicidade: 'anual',
      diaVencimento: 1,
      mesVencimento: 1,
    };
    expect(toYmd(proximoVencimentoEmOuDepoisDeHoje(input, refDia)!)).toBe('2027-01-01');
  });

  it('anual em março → mar/2027 quando hoje é 02/05/2026 (mar/2026 já passou)', () => {
    const input: PerenePeriodInput = {
      ...inicio2020,
      periodicidade: 'anual',
      diaVencimento: 1,
      mesVencimento: 3,
    };
    expect(toYmd(proximoVencimentoEmOuDepoisDeHoje(input, refDia)!)).toBe('2027-03-01');
  });

  it('vencimento no próprio dia de hoje conta (mensal)', () => {
    const hoje = new Date(2026, 4, 6);
    const input: PerenePeriodInput = {
      ...inicio2020,
      periodicidade: 'mensal',
      diaVencimento: 6,
      mesVencimento: null,
    };
    expect(toYmd(proximoVencimentoEmOuDepoisDeHoje(input, hoje)!)).toBe('2026-05-06');
  });

  it('retorna null se próximo vencimento seria após data de término', () => {
    const input: PerenePeriodInput = {
      dataInicio: new Date(2020, 0, 1),
      dataTermino: new Date(2026, 4, 5),
      periodicidade: 'mensal',
      diaVencimento: 10,
      mesVencimento: null,
    };
    expect(proximoVencimentoEmOuDepoisDeHoje(input, refDia)).toBeNull();
  });
});
