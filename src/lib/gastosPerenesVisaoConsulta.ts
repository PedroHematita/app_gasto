/**
 * Filtro, eixo e composição da aba Gastos Perenes.
 */

import type { NaturezaFiltroVisao } from './visaoFinanceiraModelo';
import { faseDoMes, monthKeyFromDate } from './visaoFinanceiraConsulta';
import type { ColunaDivida } from './dividaParceladaConsulta';
import type { LinhaPereneVisao } from './gastosPerenesVisaoModelo';

function shiftMonthKey(monthKey: string, delta: number): string {
  const [ys, ms] = monthKey.split('-').map(Number);
  return monthKeyFromDate(new Date(ys, ms - 1 + delta, 1));
}

function iterMonthKeys(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  let cursor = fromKey;
  let guard = 0;
  while (cursor <= toKey && guard++ < 360) {
    keys.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
  }
  return keys;
}

export function filtrarLinhasPerenes(
  linhas: readonly LinhaPereneVisao[],
  natureza: NaturezaFiltroVisao,
): LinhaPereneVisao[] {
  if (natureza === 'todas') return [...linhas];
  return linhas.filter((l) => l.natureza === natureza);
}

export function colunasPerenes(
  linhas: readonly LinhaPereneVisao[],
  hoje: Date,
): ColunaDivida[] {
  if (linhas.length === 0) return [];
  const keys = linhas.map((l) => l.monthKey).sort();
  const eixo = iterMonthKeys(keys[0], keys[keys.length - 1]);
  const porMes = new Map<string, number>();
  for (const l of linhas) {
    porMes.set(l.monthKey, (porMes.get(l.monthKey) ?? 0) + l.valorCents);
  }
  return eixo.map((monthKey) => ({
    monthKey,
    fase: faseDoMes(monthKey, hoje),
    totalCents: porMes.get(monthKey) ?? 0,
  }));
}

export function composicaoDoMes(
  linhas: readonly LinhaPereneVisao[],
  monthKey: string,
): LinhaPereneVisao[] {
  return linhas.filter((l) => l.monthKey === monthKey);
}

export function totalDoMes(linhas: readonly LinhaPereneVisao[], monthKey: string): number {
  return composicaoDoMes(linhas, monthKey).reduce((s, l) => s + l.valorCents, 0);
}
