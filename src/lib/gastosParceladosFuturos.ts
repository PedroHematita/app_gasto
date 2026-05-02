/**
 * Parcelas futuras de gastos no cartão do fluxo atual.
 *
 * forma_pagamento no Supabase (save via App.tsx): 'À Vista' | 'Parcelado' — verificar com
 * `isFormaPagamentoParcelado` case-insensitive para registros antigos ou variações.
 */

import { parseDateBR, startOfDayLocal } from '../utils';

export interface ParcelaFutura {
  parcela: number;
  dataVencimento: Date;
  valorCents: number;
}

/** Normaliza e reconhece parcelado independente de 'Parcelado' / 'parcelado' no banco. */
export function isFormaPagamentoParcelado(formaPagamento: string): boolean {
  return formaPagamento.trim().toLowerCase() === 'parcelado';
}

/**
 * Dia 6 do mês que está k meses à frente do mês da data da compra (k = 1 → mês seguinte ao da compra).
 */
export function dataVencimentoParcela(dataCompraBR: string, parcela1Based: number): Date | null {
  const compra = parseDateBR(dataCompraBR);
  if (!compra || parcela1Based < 1) return null;
  const y = compra.getFullYear();
  const m0 = compra.getMonth();
  return startOfDayLocal(new Date(y, m0 + parcela1Based, 6));
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
    const due = dataVencimentoParcela(input.dataCompraBR, k);
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
