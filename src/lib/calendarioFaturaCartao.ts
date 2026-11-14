/**
 * Calendário informado das faturas de cartão de crédito.
 * Projeção interna — não é fatura bancária confirmada nem conciliação.
 *
 * Compra no dia do fechamento entra nesta fatura (limite inclusivo).
 * O banco pode postar no ciclo seguinte; esta convenção não garante correspondência.
 */

import { parseDateBR, startOfDayLocal } from '../utils';
import { monthKeyFromDate } from './visaoFinanceiraConsulta';

export interface CalendarioFaturaCartao {
  diaFechamento: number;
  /** Vencimento nominal usado na agenda. */
  diaVencimento: number;
  /**
   * Dia informado como referência de pagamento.
   * Não altera vencimento, mês da fatura nem juros.
   */
  diaReferenciaPagamentoInformado: number | null;
}

/** Mesmo calendário inicial para Nubank, Nubank PJ e C6 Madrigal. */
export const CALENDARIO_CARTAO_PADRAO: CalendarioFaturaCartao = {
  diaFechamento: 3,
  diaVencimento: 10,
  diaReferenciaPagamentoInformado: 13,
};

export interface OcorrenciaFaturaCartao {
  parcela: number;
  monthKeyFatura: string;
  dataFechamento: Date;
  dataVencimento: Date;
  dataReferenciaPagamentoInformada: Date | null;
}

export function calendarioCartaoPorInstituicao(_instituicaoFinanceira: string): CalendarioFaturaCartao {
  return CALENDARIO_CARTAO_PADRAO;
}

function deslocarMes(year: number, month0: number, delta: number): { year: number; month0: number } {
  const ancora = new Date(year, month0 + delta, 1);
  return { year: ancora.getFullYear(), month0: ancora.getMonth() };
}

/** Mês da primeira fatura elegível: dia da compra ≤ fechamento permanece no mês. */
export function primeiraFaturaElegivel(
  compra: Date,
  cal: CalendarioFaturaCartao = CALENDARIO_CARTAO_PADRAO,
): { year: number; month0: number } {
  const year = compra.getFullYear();
  const month0 = compra.getMonth();
  if (compra.getDate() <= cal.diaFechamento) return { year, month0 };
  return deslocarMes(year, month0, 1);
}

export function ocorrenciaFaturaCartao(
  dataCompraBR: string,
  parcela1Based: number,
  instituicaoFinanceira = '',
): OcorrenciaFaturaCartao | null {
  const compra = parseDateBR(dataCompraBR);
  if (!compra || parcela1Based < 1) return null;
  const cal = calendarioCartaoPorInstituicao(instituicaoFinanceira);
  const primeira = primeiraFaturaElegivel(compra, cal);
  const fatura = deslocarMes(primeira.year, primeira.month0, parcela1Based - 1);
  const dataVencimento = startOfDayLocal(new Date(fatura.year, fatura.month0, cal.diaVencimento));
  const dataFechamento = startOfDayLocal(new Date(fatura.year, fatura.month0, cal.diaFechamento));
  const dataReferenciaPagamentoInformada = cal.diaReferenciaPagamentoInformado == null
    ? null
    : startOfDayLocal(new Date(fatura.year, fatura.month0, cal.diaReferenciaPagamentoInformado));
  return {
    parcela: parcela1Based,
    monthKeyFatura: monthKeyFromDate(dataVencimento),
    dataFechamento,
    dataVencimento,
    dataReferenciaPagamentoInformada,
  };
}

export function dataVencimentoFaturaCartao(
  dataCompraBR: string,
  parcela1Based: number,
  instituicaoFinanceira = '',
): Date | null {
  return ocorrenciaFaturaCartao(dataCompraBR, parcela1Based, instituicaoFinanceira)?.dataVencimento ?? null;
}
