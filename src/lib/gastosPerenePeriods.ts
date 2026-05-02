/**
 * Calcula competências de gasto perene: primeiro dia da competência (data compra)
 * e data exata de vencimento, com chave idempotente para compromissos.
 */

import type { PeriodicidadePerene } from '../types';

export interface PerenePeriodInput {
  periodicidade: PeriodicidadePerene;
  diaVencimento: number;
  /** Obrigatório quando periodicidade === 'anual' (1–12). */
  mesVencimento: number | null;
  dataInicio: Date;
  dataTermino: Date | null;
}

export interface GeneratedPeriod {
  competenciaChave: string;
  dataCompraISO: string;
  dataPrevistaISO: string;
}

function sod(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function clampDay(year: number, monthIndex0: number, day: number): Date {
  const last = new Date(year, monthIndex0 + 1, 0).getDate();
  const d = Math.min(day, last);
  return sod(new Date(year, monthIndex0, d));
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthKey(y: number, month1to12: number): string {
  return `${y}-${String(month1to12).padStart(2, '0')}`;
}

function addOneMonthFirstDay(cursor: Date): Date {
  return new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
}

/** Lista períodos com vencimento ≤ hoje, desde data_inicio, respeitando data_termino. */
export function listPeriodsDueThroughToday(input: PerenePeriodInput, todayInput: Date = new Date()): GeneratedPeriod[] {
  const today = sod(todayInput);
  const inicio = sod(input.dataInicio);
  const termino = input.dataTermino ? sod(input.dataTermino) : null;
  const dia = input.diaVencimento;
  const out: GeneratedPeriod[] = [];
  let guard = 0;

  const pushIfOk = (competenciaChave: string, compra: Date, prevista: Date) => {
    if (termino && sod(prevista) > termino) return;
    if (sod(prevista) < inicio) return;
    if (sod(prevista) > today) return;
    out.push({
      competenciaChave,
      dataCompraISO: toISO(sod(compra)),
      dataPrevistaISO: toISO(sod(prevista)),
    });
  };

  if (input.periodicidade === 'mensal') {
    let cursor = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    while (guard++ < 2400) {
      const y = cursor.getFullYear();
      const mi = cursor.getMonth();
      if (termino && new Date(y, mi, 1) > termino) break;
      const due = clampDay(y, mi, dia);
      if (termino && due > termino) break;
      if (due < inicio) {
        cursor = addOneMonthFirstDay(cursor);
        continue;
      }
      if (due > today) break;
      pushIfOk(monthKey(y, mi + 1), new Date(y, mi, 1), due);
      cursor = addOneMonthFirstDay(cursor);
    }
    return out;
  }

  if (input.periodicidade === 'trimestral') {
    const yMin = inicio.getFullYear() - 1;
    const yMax = today.getFullYear() + 1;
    for (let y = yMin; y <= yMax; y++) {
      for (let q = 0; q < 4; q++) {
        guard++;
        if (guard > 500) break;
        const firstMonth = q * 3;
        const lastMonth = q * 3 + 2;
        const compra = new Date(y, firstMonth, 1);
        const due = clampDay(y, lastMonth, dia);
        pushIfOk(`${y}-Q${q + 1}`, compra, due);
      }
    }
    return out;
  }

  if (input.periodicidade === 'semestral') {
    const yMin = inicio.getFullYear() - 1;
    const yMax = today.getFullYear() + 1;
    for (let y = yMin; y <= yMax; y++) {
      for (const s of [0, 1] as const) {
        guard++;
        if (guard > 500) break;
        const compra = s === 0 ? new Date(y, 0, 1) : new Date(y, 6, 1);
        const due = s === 0 ? clampDay(y, 5, dia) : clampDay(y, 11, dia);
        pushIfOk(`${y}-S${s + 1}`, compra, due);
      }
    }
    return out;
  }

  // anual
  const mes = input.mesVencimento;
  if (!mes || mes < 1 || mes > 12) return [];
  const yMin = inicio.getFullYear() - 1;
  const yMax = today.getFullYear() + 1;
  for (let y = yMin; y <= yMax; y++) {
    guard++;
    if (guard > 200) break;
    const compra = new Date(y, 0, 1);
    const due = clampDay(y, mes - 1, dia);
    pushIfOk(String(y), compra, due);
  }
  return out;
}
