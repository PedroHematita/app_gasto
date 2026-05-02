/**
 * Calcula competências de gasto perene: primeiro dia da competência (data compra)
 * e data exata de vencimento, com chave idempotente para compromissos.
 */

import type { PeriodicidadePerene } from '../types';
import { endOfForecastWindowInclusive } from './forecastWindow';

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

function sortDatesAsc(dates: Date[]): Date[] {
  return [...dates].sort((a, b) => sod(a).getTime() - sod(b).getTime());
}

/** Vencimentos em [rangeStart, rangeEnd], inclusivos (só data local). */
function vencimentosPereneEntreFechado(
  input: PerenePeriodInput,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const inicio = sod(input.dataInicio);
  const termino = input.dataTermino ? sod(input.dataTermino) : null;
  const dia = input.diaVencimento;
  const rs = sod(rangeStart);
  const re = sod(rangeEnd);
  const out: Date[] = [];

  if (input.periodicidade === 'mensal') {
    const inicioMonthStart = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const rangeMonthStart = new Date(rs.getFullYear(), rs.getMonth(), 1);
    let cursor =
      rangeMonthStart.getTime() < inicioMonthStart.getTime()
        ? new Date(inicioMonthStart)
        : new Date(rangeMonthStart);
    let guard = 0;
    while (guard++ < 2400) {
      const y = cursor.getFullYear();
      const mi = cursor.getMonth();
      if (termino && new Date(y, mi, 1) > termino) break;
      const due = clampDay(y, mi, dia);
      if (termino && sod(due) > termino) {
        cursor = addOneMonthFirstDay(cursor);
        continue;
      }
      if (sod(due) < inicio) {
        cursor = addOneMonthFirstDay(cursor);
        continue;
      }
      if (sod(due) > re) break;
      if (sod(due) >= rs) out.push(due);
      cursor = addOneMonthFirstDay(cursor);
    }
    return out;
  }

  const yMin = inicio.getFullYear() - 1;
  const yMax = Math.max(re.getFullYear(), rs.getFullYear()) + 1;
  let guard = 0;

  const inRange = (due: Date) =>
    sod(due) >= inicio &&
    (!termino || sod(due) <= termino) &&
    sod(due) >= rs &&
    sod(due) <= re;

  if (input.periodicidade === 'trimestral') {
    for (let y = yMin; y <= yMax; y++) {
      for (let q = 0; q < 4; q++) {
        guard++;
        if (guard > 500) return sortDatesAsc(out);
        const lastMonth = q * 3 + 2;
        const due = clampDay(y, lastMonth, dia);
        if (inRange(due)) out.push(due);
      }
    }
    return sortDatesAsc(out);
  }

  if (input.periodicidade === 'semestral') {
    for (let y = yMin; y <= yMax; y++) {
      for (const s of [0, 1] as const) {
        guard++;
        if (guard > 500) return sortDatesAsc(out);
        const due = s === 0 ? clampDay(y, 5, dia) : clampDay(y, 11, dia);
        if (inRange(due)) out.push(due);
      }
    }
    return sortDatesAsc(out);
  }

  const mes = input.mesVencimento;
  if (!mes || mes < 1 || mes > 12) return [];
  for (let y = yMin; y <= yMax; y++) {
    guard++;
    if (guard > 200) return sortDatesAsc(out);
    const due = clampDay(y, mes - 1, dia);
    if (inRange(due)) out.push(due);
  }
  return sortDatesAsc(out);
}

/**
 * Vencimentos no intervalo fechado [rangeStart, rangeEnd] (só data local).
 * Útil para janelas em calendário (ex.: 12 meses) sem converter para contagem de dias.
 */
export function vencimentosPereneNoIntervalo(
  input: PerenePeriodInput,
  rangeStart: Date,
  rangeEndInclusive: Date
): Date[] {
  return vencimentosPereneEntreFechado(input, sod(rangeStart), sod(rangeEndInclusive));
}

/**
 * Todos os vencimentos do perene na janela de N dias a partir de hoje (incluindo hoje),
 * alinhada a `endOfForecastWindowInclusive` / `isDateInForecastWindow`.
 */
export function vencimentosPereneNaJanela(
  input: PerenePeriodInput,
  todayInput: Date = new Date(),
  windowDays: number
): Date[] {
  const today = sod(todayInput);
  const fim = endOfForecastWindowInclusive(today, windowDays);
  return vencimentosPereneEntreFechado(input, today, fim);
}

const PROXIMO_VIA_JANELA_DIAS = 365 * 50;

/**
 * Primeiro vencimento >= hoje (via janela longa; uma única fonte de regras).
 */
export function proximoVencimentoEmOuDepoisDeHoje(
  input: PerenePeriodInput,
  todayInput: Date = new Date()
): Date | null {
  return vencimentosPereneNaJanela(input, todayInput, PROXIMO_VIA_JANELA_DIAS)[0] ?? null;
}
