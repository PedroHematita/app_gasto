import { describe, expect, it } from 'vitest';
import {
  avaliarDesvioComHistorico,
  avaliarDesvioPrecoUnitario,
  mediaPonderadaCentavos,
} from './desvioPreco';

describe('desvioPreco', () => {
  it('calcula média ponderada', () => {
    expect(
      mediaPonderadaCentavos([
        { valorCentavos: 1000, quantidade: 2 },
        { valorCentavos: 1500, quantidade: 1 },
      ])
    ).toBe(Math.round(2500 / 3));
  });

  it('retorna null sem histórico útil', () => {
    expect(avaliarDesvioComHistorico(600, 1, [])).toBeNull();
    expect(avaliarDesvioPrecoUnitario(600, 1, 0)).toBeNull();
    expect(avaliarDesvioPrecoUnitario(600, 0, 500)).toBeNull();
  });

  it('dentro de ±10% não marca fora', () => {
    const r = avaliarDesvioPrecoUnitario(550, 1, 500);
    expect(r).toMatchObject({
      mediaPonderadaCentavos: 500,
      limiteInferiorCentavos: 450,
      limiteSuperiorCentavos: 550,
      valorUnitarioCentavos: 550,
      foraDaFaixa: false,
    });
  });

  it('fora da faixa (ex.: gasolina com unidade esquecida)', () => {
    // média R$ 6,00/L; informado R$ 300,00 no total com qtd 1
    const r = avaliarDesvioPrecoUnitario(30000, 1, 600);
    expect(r?.foraDaFaixa).toBe(true);
    expect(r?.valorUnitarioCentavos).toBe(30000);
  });

  it('respeita quantidade no valor unitário', () => {
    const r = avaliarDesvioPrecoUnitario(30000, 50, 600);
    expect(r?.valorUnitarioCentavos).toBe(600);
    expect(r?.foraDaFaixa).toBe(false);
  });
});
