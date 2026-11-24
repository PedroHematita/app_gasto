import { describe, expect, it } from 'vitest';
import { criarGastoRascunho, criarItemRascunho } from './modelo';
import { montarPayloadSalvarGastosLote } from './payload';

describe('montarPayloadSalvarGastosLote', () => {
  it('monta o payload dos dois gastos de 18/11/2026 na ordem da tela', () => {
    const posto = criarGastoRascunho({ hoje: new Date(2026, 10, 18) });
    posto.fornecedor = 'Posto Y';
    posto.pagamento = {
      formaPagamento: 'a_vista',
      meioPagamento: 'PIX',
      instituicaoFinanceira: 'C6 Madrigal',
      parcelas: 2,
      observacoes: '',
    };
    posto.itens = [
      criarItemRascunho({
        descricao: 'Gasolina',
        quantidade: '38,5',
        unidade: 'Litro',
        valorCentavos: 20000,
      }),
    ];

    const mercado = criarGastoRascunho({ herdarDe: posto });
    mercado.dataHerdadaPendente = false;
    mercado.fornecedor = 'Supermercado';
    mercado.pagamento = {
      formaPagamento: 'a_vista',
      meioPagamento: 'PIX',
      instituicaoFinanceira: 'C6 Madrigal',
      parcelas: 2,
      observacoes: '',
    };
    mercado.itens = [
      criarItemRascunho({
        descricao: 'Arroz',
        quantidade: '1',
        unidade: 'Unidade',
        valorCentavos: 2000,
      }),
      criarItemRascunho({
        descricao: 'Carne',
        quantidade: '1',
        unidade: 'Unidade',
        valorCentavos: 3000,
      }),
    ];

    const { payload, mapeamento } = montarPayloadSalvarGastosLote('org-demo', [posto, mercado]);

    expect(payload.p_org_id).toBe('org-demo');
    expect(payload.p_gastos).toHaveLength(2);
    expect(payload.p_gastos[0]).toMatchObject({
      id: posto.id,
      data_compra: '2026-11-18',
      fornecedor: 'Posto Y',
      forma_pagamento: 'À Vista',
      meio_pagamento: 'PIX',
      instituicao_financeira: 'C6 Madrigal',
      observacoes: '',
      numero_parcelas: null,
      itens: [
        {
          descricao: 'Gasolina',
          quantidade: 38.5,
          unidade: 'Litro',
          valor_centavos: 20000,
        },
      ],
    });
    expect(payload.p_gastos[1]).toMatchObject({
      id: mercado.id,
      data_compra: '2026-11-18',
      fornecedor: 'Supermercado',
      forma_pagamento: 'À Vista',
      numero_parcelas: null,
      itens: [
        { descricao: 'Arroz', quantidade: 1, unidade: 'Unidade', valor_centavos: 2000 },
        { descricao: 'Carne', quantidade: 1, unidade: 'Unidade', valor_centavos: 3000 },
      ],
    });
    expect(mapeamento.posicaoPorGastoId[posto.id]).toBe(1);
    expect(mapeamento.gastoIdPorPosicao[2]).toBe(mercado.id);
  });
});
