import { describe, expect, it } from 'vitest';
import {
  appendObservacaoDiferencaValor,
  observacaoAutomaticaDiferencaValor,
  scaleItemsValorToTotal,
} from './utils';

describe('observacaoAutomaticaDiferencaValor', () => {
  it('retorna null quando valores iguais', () => {
    expect(observacaoAutomaticaDiferencaValor(30_000, 30_000)).toBeNull();
  });

  it('mensagem quando realizado menor', () => {
    const msg = observacaoAutomaticaDiferencaValor(30_000, 28_000)!;
    expect(msg).toContain('menor que o planejado');
    expect(msg).toContain('300,00');
    expect(msg).toContain('280,00');
    expect(msg).toMatch(/-R\$\s*20,00/);
  });

  it('mensagem quando realizado maior', () => {
    const msg = observacaoAutomaticaDiferencaValor(30_000, 33_000)!;
    expect(msg).toContain('maior que o planejado');
    expect(msg).toContain('+R$');
  });
});

describe('appendObservacaoDiferencaValor', () => {
  it('preserva observação do usuário e acrescenta automática', () => {
    const out = appendObservacaoDiferencaValor(
      'Pagamento com desconto negociado.',
      30_000,
      28_000
    );
    expect(out).toMatch(/^Pagamento com desconto negociado\./);
    expect(out).toContain('Valor realizado menor');
  });

  it('retorna só observação do usuário quando iguais', () => {
    expect(appendObservacaoDiferencaValor('Só manual', 30_000, 30_000)).toBe('Só manual');
  });
});

describe('scaleItemsValorToTotal', () => {
  it('item único recebe valor realizado integral', () => {
    const items = scaleItemsValorToTotal(
      [{ ordem: 1, descricao: 'Mensalidade', quantidade: 1, unidade: 'Contrato', valorCentavos: 30_000 }],
      28_000
    );
    expect(items[0].valorCentavos).toBe(28_000);
  });

  it('vários itens somam o valor realizado', () => {
    const items = scaleItemsValorToTotal(
      [
        { ordem: 1, descricao: 'A', quantidade: 1, unidade: 'Unidade', valorCentavos: 20_000 },
        { ordem: 2, descricao: 'B', quantidade: 1, unidade: 'Unidade', valorCentavos: 10_000 },
      ],
      28_000
    );
    expect(items.reduce((s, i) => s + i.valorCentavos, 0)).toBe(28_000);
  });
});
