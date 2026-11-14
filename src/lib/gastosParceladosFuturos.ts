/**
 * Parcelas futuras de gastos no cartão do fluxo atual.
 *
 * forma_pagamento no Supabase (save via App.tsx): 'À Vista' | 'Parcelado' — verificar com
 * `isFormaPagamentoParcelado` case-insensitive para registros antigos ou variações.
 */

import { parseDateBR, startOfDayLocal } from '../utils';
import { dataVencimentoFaturaCartao } from './calendarioFaturaCartao';

export interface ParcelaFutura {
  parcela: number;
  dataVencimento: Date;
  valorCents: number;
}

/** Normaliza e reconhece parcelado independente de 'Parcelado' / 'parcelado' no banco. */
export function isFormaPagamentoParcelado(formaPagamento: string): boolean {
  return formaPagamento.trim().toLowerCase() === 'parcelado';
}

/** Meio canônico do cadastro — agenda da Visão, não fatura bancária. */
export const MEIO_CARTAO_CREDITO = 'Cartão de Crédito';

export function isMeioCartaoCredito(meioPagamento: string): boolean {
  return meioPagamento.trim() === MEIO_CARTAO_CREDITO;
}

/**
 * Quantas fatias a Visão Geral projeta na agenda.
 * Parcelado N>1: qualquer meio. À vista no crédito: 1 fatia. Não usar na Dívida Parcelada.
 */
export function numeroFatiasAgendaCartaoVisao(
  formaPagamento: string,
  numeroParcelas: number | undefined,
  meioPagamento: string,
): number {
  const n = numeroParcelas ?? 0;
  if (isFormaPagamentoParcelado(formaPagamento) && n > 1) return n;
  if (!isFormaPagamentoParcelado(formaPagamento) && isMeioCartaoCredito(meioPagamento)) return 1;
  return 0;
}

export function gastoEntraNaAgendaCartaoVisao(
  formaPagamento: string,
  numeroParcelas: number | undefined,
  meioPagamento: string,
): boolean {
  return numeroFatiasAgendaCartaoVisao(formaPagamento, numeroParcelas, meioPagamento) > 0;
}

/**
 * Convenção dos parcelamentos que não são fatura de crédito:
 * dia 6 do mês k meses à frente do mês da compra (k = 1 → mês seguinte).
 */
export function dataVencimentoParcela(dataCompraBR: string, parcela1Based: number): Date | null {
  const compra = parseDateBR(dataCompraBR);
  if (!compra || parcela1Based < 1) return null;
  const y = compra.getFullYear();
  const m0 = compra.getMonth();
  return startOfDayLocal(new Date(y, m0 + parcela1Based, 6));
}

/** Crédito: ciclo da fatura. Demais meios: dataVencimentoParcela. */
export function dataVencimentoAgendaGasto(
  dataCompraBR: string,
  parcela1Based: number,
  meioPagamento: string,
  instituicaoFinanceira = '',
): Date | null {
  if (isMeioCartaoCredito(meioPagamento)) {
    return dataVencimentoFaturaCartao(dataCompraBR, parcela1Based, instituicaoFinanceira);
  }
  return dataVencimentoParcela(dataCompraBR, parcela1Based);
}

/** Último centavo na última parcela. */
export function distribuirValorParcelas(totalCents: number, numeroParcelas: number): number[] {
  if (numeroParcelas < 1 || totalCents < 0) return [];
  const base = Math.floor(totalCents / numeroParcelas);
  const resto = totalCents - base * numeroParcelas;
  return Array.from({ length: numeroParcelas }, (_, i) =>
    i === numeroParcelas - 1 ? base + resto : base
  );
}

/** Mesmo dia do mês + 12 meses (calendário), só data local. */
export function fimJanelaDozeMeses(hoje: Date): Date {
  const s = startOfDayLocal(hoje);
  return startOfDayLocal(new Date(s.getFullYear(), s.getMonth() + 12, s.getDate()));
}

export interface GastoParceladoInput {
  dataCompraBR: string;
  totalCents: number;
  formaPagamento: string;
  numeroParcelas: number;
  meioPagamento?: string;
  instituicaoFinanceira?: string;
}

/**
 * Parcelas com vencimento **estritamente depois de hoje** (`> sod(hoje)`) e até o fim da janela.
 * (Compromissos na consolidação usam limite inferior **inclusivo** para `dataPrevista` — regra distinta.)
 */
export function parcelasFuturasDoGasto(
  input: GastoParceladoInput,
  todayInput: Date = new Date()
): ParcelaFutura[] {
  const n = input.numeroParcelas;
  if (!isFormaPagamentoParcelado(input.formaPagamento) || n <= 1) return [];

  const hoje = startOfDayLocal(todayInput);
  const fim = fimJanelaDozeMeses(todayInput);
  const valores = distribuirValorParcelas(input.totalCents, n);
  const out: ParcelaFutura[] = [];

  for (let k = 1; k <= n; k++) {
    const due = dataVencimentoAgendaGasto(
      input.dataCompraBR,
      k,
      input.meioPagamento ?? '',
      input.instituicaoFinanceira ?? '',
    );
    if (!due) continue;
    if (due.getTime() <= hoje.getTime()) continue;
    if (due.getTime() > fim.getTime()) continue;
    out.push({
      parcela: k,
      dataVencimento: due,
      valorCents: valores[k - 1] ?? 0,
    });
  }

  return out;
}
