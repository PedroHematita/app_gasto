import { describe, expect, it } from 'vitest';
import {
  avisosDeDesviosPreco,
  chaveHistoricoPreco,
  coletarDesviosPrecoLote,
} from './precoHistoricoLote';
import { criarGastoRascunho, criarItemRascunho } from './modelo';

describe('precoHistoricoLote', () => {
  it('chave normaliza descrição', () => {
    expect(chaveHistoricoPreco('  Gasolina  ', 'Litro')).toBe(
      chaveHistoricoPreco('gasolina', 'Litro')
    );
  });

  it('detecta item fora da média e gera aviso', () => {
    const item = criarItemRascunho({
      descricao: 'Gasolina',
      quantidade: '1',
      unidade: 'Litro',
      valorCentavos: 30000,
    });
    const gasto = { ...criarGastoRascunho(), fornecedor: 'Posto', itens: [item] };
    const hist = new Map([
      [
        chaveHistoricoPreco('Gasolina', 'Litro'),
        [{ valorCentavos: 6000, quantidade: 10 }],
      ],
    ]);
    const desvios = coletarDesviosPrecoLote([gasto], { [gasto.id]: 1 }, hist);
    expect(desvios).toHaveLength(1);
    expect(desvios[0].desvio.foraDaFaixa).toBe(true);

    const avisos = avisosDeDesviosPreco(desvios);
    expect(avisos[0].tipo).toBe('preco_fora_media');
    expect(avisos[0].mensagem).toMatch(/média histórica/i);
  });

  it('não avisa quando está na faixa', () => {
    const item = criarItemRascunho({
      descricao: 'Gasolina',
      quantidade: '10',
      unidade: 'Litro',
      valorCentavos: 6000,
    });
    const gasto = { ...criarGastoRascunho(), fornecedor: 'Posto', itens: [item] };
    const hist = new Map([
      [
        chaveHistoricoPreco('Gasolina', 'Litro'),
        [{ valorCentavos: 6000, quantidade: 10 }],
      ],
    ]);
    expect(coletarDesviosPrecoLote([gasto], { [gasto.id]: 1 }, hist)).toHaveLength(0);
  });
});
