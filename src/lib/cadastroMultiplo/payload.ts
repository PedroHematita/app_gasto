import {
  itemLinhaCompleta,
  ordenarGastosNaTela,
  type GastoRascunhoLote,
  type ItemRascunhoLote,
} from './modelo';

export interface ItemPayloadLote {
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_centavos: number;
}

export interface GastoPayloadLote {
  id: string;
  data_compra: string;
  fornecedor: string;
  forma_pagamento: 'À Vista' | 'Parcelado';
  meio_pagamento: string;
  instituicao_financeira: string;
  observacoes: string;
  numero_parcelas: number | null;
  itens: ItemPayloadLote[];
}

export interface PayloadSalvarGastosLote {
  p_org_id: string;
  p_gastos: GastoPayloadLote[];
}

export interface MapeamentoPosicaoLote {
  /** Posição 1-based → id do gasto. */
  gastoIdPorPosicao: Record<number, string>;
  /** id do gasto → posição 1-based. */
  posicaoPorGastoId: Record<string, number>;
}

function dataBRParaISO(dataBR: string): string {
  const [d, m, y] = dataBR.split('/');
  return `${y}-${m}-${d}`;
}

function parseQuantidadePayload(texto: string): number {
  const n = Number(texto.trim().replace(/\s+/g, '').replace(',', '.'));
  return n;
}

function itemParaPayload(item: ItemRascunhoLote): ItemPayloadLote {
  return {
    descricao: item.descricao.trim().replace(/\s+/g, ' '),
    quantidade: parseQuantidadePayload(item.quantidade),
    unidade: item.unidade.trim(),
    valor_centavos: item.valorCentavos ?? 0,
  };
}

export function montarPayloadSalvarGastosLote(
  orgId: string,
  gastos: GastoRascunhoLote[]
): { payload: PayloadSalvarGastosLote; mapeamento: MapeamentoPosicaoLote } {
  const ordenados = ordenarGastosNaTela(gastos);
  const gastoIdPorPosicao: Record<number, string> = {};
  const posicaoPorGastoId: Record<string, number> = {};

  const p_gastos = ordenados.map((gasto, idx) => {
    const posicao = idx + 1;
    gastoIdPorPosicao[posicao] = gasto.id;
    posicaoPorGastoId[gasto.id] = posicao;
    const parcelado = gasto.pagamento.formaPagamento === 'parcelado';
    return {
      id: gasto.id,
      data_compra: dataBRParaISO(gasto.dataCompraBR),
      fornecedor: gasto.fornecedor.trim(),
      forma_pagamento: (parcelado ? 'Parcelado' : 'À Vista') as 'À Vista' | 'Parcelado',
      meio_pagamento: gasto.pagamento.meioPagamento,
      instituicao_financeira: gasto.pagamento.instituicaoFinanceira,
      observacoes: gasto.pagamento.observacoes.trim(),
      numero_parcelas: parcelado ? gasto.pagamento.parcelas : null,
      itens: gasto.itens.filter(itemLinhaCompleta).map(itemParaPayload),
    };
  });

  return {
    payload: { p_org_id: orgId, p_gastos },
    mapeamento: { gastoIdPorPosicao, posicaoPorGastoId },
  };
}
