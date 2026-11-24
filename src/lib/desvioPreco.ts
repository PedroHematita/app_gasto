/** Tolerância relativa em torno da média ponderada (igual ao cadastro individual). */
export const TOLERANCIA_RELATIVA_DESVIO_PRECO = 0.1;

export interface RegistroPrecoHistorico {
  valorCentavos: number;
  quantidade: number;
}

export interface DesvioPrecoUnitario {
  mediaPonderadaCentavos: number;
  limiteInferiorCentavos: number;
  limiteSuperiorCentavos: number;
  valorUnitarioCentavos: number;
  foraDaFaixa: boolean;
}

/** Média ponderada = soma(valor_total) / soma(quantidade), em centavos/unidade. */
export function mediaPonderadaCentavos(
  registros: ReadonlyArray<RegistroPrecoHistorico>
): number {
  const totalCents = registros.reduce((s, r) => s + r.valorCentavos, 0);
  const totalQty = registros.reduce((s, r) => s + r.quantidade, 0);
  return totalQty > 0 ? Math.round(totalCents / totalQty) : 0;
}

/**
 * Avalia se o valor unitário foge da média histórica.
 * Retorna `null` quando não há como avaliar (qtd/média/valor inválidos).
 */
export function avaliarDesvioPrecoUnitario(
  valorTotalCentavos: number,
  quantidade: number,
  mediaHistoricaCentavos: number,
  toleranciaRelativa = TOLERANCIA_RELATIVA_DESVIO_PRECO
): DesvioPrecoUnitario | null {
  if (
    !(quantidade > 0) ||
    !(valorTotalCentavos > 0) ||
    !(mediaHistoricaCentavos > 0) ||
    !(toleranciaRelativa >= 0)
  ) {
    return null;
  }

  const limInf = Math.round(mediaHistoricaCentavos * (1 - toleranciaRelativa));
  const limSup = Math.round(mediaHistoricaCentavos * (1 + toleranciaRelativa));
  const valorUnitarioCentavos = Math.round(valorTotalCentavos / quantidade);

  return {
    mediaPonderadaCentavos: mediaHistoricaCentavos,
    limiteInferiorCentavos: limInf,
    limiteSuperiorCentavos: limSup,
    valorUnitarioCentavos,
    foraDaFaixa: valorUnitarioCentavos < limInf || valorUnitarioCentavos > limSup,
  };
}

export function avaliarDesvioComHistorico(
  valorTotalCentavos: number,
  quantidade: number,
  historico: ReadonlyArray<RegistroPrecoHistorico>,
  toleranciaRelativa = TOLERANCIA_RELATIVA_DESVIO_PRECO
): DesvioPrecoUnitario | null {
  const media = mediaPonderadaCentavos(historico);
  return avaliarDesvioPrecoUnitario(
    valorTotalCentavos,
    quantidade,
    media,
    toleranciaRelativa
  );
}
