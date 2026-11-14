import { describe, expect, it } from 'vitest';
import {
  filtrarOpcoesSelect,
  selectDeveExibirPesquisa,
  toSelectOptionItems,
} from './selectOptions';

describe('selectOptions', () => {
  it('filtra pelo rótulo sem alterar o value', () => {
    const opts = toSelectOptionItems(['PIX', 'Dinheiro', 'Cartão de Crédito']);
    expect(filtrarOpcoesSelect(opts, 'pix').map((o) => o.value)).toEqual(['PIX']);
    expect(filtrarOpcoesSelect(opts, '  CARTÃO ').map((o) => o.label)).toEqual(['Cartão de Crédito']);
  });

  it('query vazia devolve todas as opções', () => {
    const opts = toSelectOptionItems(['A', 'B']);
    expect(filtrarOpcoesSelect(opts, '   ')).toHaveLength(2);
  });

  it('pesquisa só em listas longas', () => {
    expect(selectDeveExibirPesquisa(7)).toBe(false);
    expect(selectDeveExibirPesquisa(8)).toBe(true);
  });
});
