/**
 * Filtros, totais e eixo do gráfico da Visão Financeira.
 * A montagem das linhas fica em visaoFinanceiraModelo.ts.
 */

import { fimJanelaDozeMeses } from './gastosParceladosFuturos';
import type {
  ColunaVisao,
  EvolucaoVisao,
  FaseMesVisao,
  LinhaVisao,
  ModalidadeVisao,
  NaturezaFiltroVisao,
  PeriodoVisao,
  ResumoVisao,
} from './visaoFinanceiraModelo';

export function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function faseDoMes(monthKey: string, hoje: Date): FaseMesVisao {
  const atual = monthKeyFromDate(hoje);
  if (monthKey < atual) return 'historico';
  if (monthKey > atual) return 'futuro';
  return 'atual';
}

export function filtrarLinhasVisao(
  linhas: LinhaVisao[],
  natureza: NaturezaFiltroVisao,
  modalidades: readonly ModalidadeVisao[],
  periodo: PeriodoVisao,
  hoje: Date
): LinhaVisao[] {
  const permitidas = new Set(modalidades);
  return linhas.filter((linhaItem) => {
    if (natureza !== 'todas' && linhaItem.natureza !== natureza) return false;
    if (!permitidas.has(linhaItem.modalidade)) return false;
    const fase = faseDoMes(linhaItem.monthKey, hoje);
    if (periodo === 'historico') return fase === 'historico';
    if (periodo === 'mes_atual') return fase === 'atual';
    if (periodo === 'futuro') return fase === 'futuro';
    return true;
  });
}

export function resumirLinhasVisao(linhas: LinhaVisao[]): ResumoVisao {
  const porModalidade: Record<ModalidadeVisao, number> = { perene: 0, parcelado: 0, demais: 0 };
  for (const item of linhas) porModalidade[item.modalidade] += item.valorCents;
  const totalCents = porModalidade.perene + porModalidade.parcelado + porModalidade.demais;
  const participacao = {
    perene: totalCents > 0 ? porModalidade.perene / totalCents : null,
    parcelado: totalCents > 0 ? porModalidade.parcelado / totalCents : null,
    demais: totalCents > 0 ? porModalidade.demais / totalCents : null,
  };
  return { totalCents, porModalidade, participacao };
}

function somaNoMes(linhas: LinhaVisao[], monthKey: string): number {
  return linhas.filter((item) => item.monthKey === monthKey).reduce((s, item) => s + item.valorCents, 0);
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [ys, ms] = monthKey.split('-').map(Number);
  const d = new Date(ys, ms - 1 + delta, 1);
  return monthKeyFromDate(d);
}

export function calcularEvolucao(
  linhas: LinhaVisao[],
  periodo: PeriodoVisao,
  hoje: Date
): EvolucaoVisao {
  const atualKey = monthKeyFromDate(hoje);
  let mesReferencia = atualKey;
  if (periodo === 'historico') {
    const anteriores = [...new Set(linhas.map((item) => item.monthKey))]
      .filter((key) => key < atualKey)
      .sort();
    mesReferencia = anteriores[anteriores.length - 1] ?? shiftMonthKey(atualKey, -1);
  } else if (periodo === 'futuro') {
    mesReferencia = shiftMonthKey(atualKey, 1);
  }
  const mesBase = shiftMonthKey(mesReferencia, -1);
  const atualCents = somaNoMes(linhas, mesReferencia);
  const anteriorCents = somaNoMes(linhas, mesBase);
  return {
    mesReferencia,
    mesBase,
    atualCents,
    anteriorCents,
    variacao: anteriorCents > 0 ? (atualCents - anteriorCents) / anteriorCents : null,
  };
}

function iterMonthKeys(fromKey: string, toKey: string): string[] {
  const keys: string[] = [];
  let cursor = fromKey;
  let guard = 0;
  while (cursor <= toKey && guard++ < 240) {
    keys.push(cursor);
    cursor = shiftMonthKey(cursor, 1);
  }
  return keys;
}

export function colunasDoGrafico(
  linhas: LinhaVisao[],
  periodo: PeriodoVisao,
  hoje: Date
): ColunaVisao[] {
  const atual = monthKeyFromDate(hoje);
  const fim = monthKeyFromDate(fimJanelaDozeMeses(hoje));
  const presentes = [...new Set(linhas.map((item) => item.monthKey))].sort();
  let keys: string[] = [];

  if (periodo === 'mes_atual') {
    keys = [atual];
  } else if (periodo === 'futuro') {
    const ultimo = presentes.filter((key) => key > atual).at(-1);
    keys = iterMonthKeys(shiftMonthKey(atual, 1), ultimo && ultimo > fim ? ultimo : fim);
  } else if (periodo === 'historico') {
    const historicos = presentes.filter((key) => key < atual);
    if (historicos.length > 0) keys = iterMonthKeys(historicos[0], historicos[historicos.length - 1]);
  } else {
    const inicio = presentes[0] && presentes[0] < atual ? presentes[0] : atual;
    const ultimoDado = presentes.at(-1);
    const fimEixo = ultimoDado && ultimoDado > fim ? ultimoDado : fim;
    keys = iterMonthKeys(inicio, fimEixo);
  }

  return keys.map((monthKey) => {
    const porModalidade: Record<ModalidadeVisao, number> = { perene: 0, parcelado: 0, demais: 0 };
    for (const item of linhas) {
      if (item.monthKey !== monthKey) continue;
      porModalidade[item.modalidade] += item.valorCents;
    }
    return {
      monthKey,
      fase: faseDoMes(monthKey, hoje),
      porModalidade,
      totalCents: porModalidade.perene + porModalidade.parcelado + porModalidade.demais,
    };
  });
}

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function rotuloMesCurto(monthKey: string): string {
  const [ys, ms] = monthKey.split('-').map(Number);
  return `${MESES_CURTOS[ms - 1]}/${String(ys).slice(2)}`;
}

export function rotuloMesLongo(monthKey: string): string {
  const [ys, ms] = monthKey.split('-').map(Number);
  return `${MESES_LONGOS[ms - 1]} ${ys}`;
}
