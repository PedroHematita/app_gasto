import { describe, it, expect } from 'vitest';
import { statsPrecosUnitarios, valorUnitarioCentavos } from './cotacoesDb';

describe('valorUnitarioCentavos', () => {
  it('divide total em centavos pela quantidade da cotação', () => {
    expect(valorUnitarioCentavos(1000, 2)).toBe(500);
  });
});

describe('statsPrecosUnitarios', () => {
  it('calcula min, média simples e diferença', () => {
    const s = statsPrecosUnitarios([500, 700, 600]);
    expect(s.min).toBe(500);
    expect(s.max).toBe(700);
    expect(s.avg).toBe(600);
    expect(s.diff).toBe(200);
  });
});
