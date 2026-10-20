/**
 * Filtros, eixo, indicadores, origem e destino da Dívida Parcelada.
 */

import type { FaseMesVisao, NaturezaFiltroVisao, NaturezaVisao } from './visaoFinanceiraModelo';
import { faseDoMes, monthKeyFromDate } from './visaoFinanceiraConsulta';
import {
  INSTITUICAO_NAO_INFORMADA,
  fatiaEmAberto,
  type CompraParceladaNova,
  type FatiaDivida,
} from './dividaParceladaModelo';

export type InstituicaoFiltroDivida = 'todas' | string;

function chaveParcelamento(fatia: FatiaDivida): string {
  if (fatia.gastoId) return `g:${fatia.gastoId}`;
  if (fatia.compromissoId) return `c:${fatia.compromissoId}`;
  return fatia.id;
}

function shiftMonthKey(monthKey: string, delta: number): string {
  const [ys, ms] = monthKey.split('-').map(Number);
  const d = new Date(ys, ms - 1 + delta, 1);
  return monthKeyFromDate(d);
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

function inicioDoMes(monthKey: string): Date {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function fimDoMes(monthKey: string): Date {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0, 23, 59, 59, 999);
}

export function filtrarFatiasDivida(
  fatias: readonly FatiaDivida[],
  natureza: NaturezaFiltroVisao,
  instituicao: InstituicaoFiltroDivida = 'todas',
): FatiaDivida[] {
  return fatias.filter((f) => {
    if (natureza !== 'todas' && f.natureza !== natureza) return false;
    if (instituicao !== 'todas' && f.instituicao !== instituicao) return false;
    return true;
  });
}

export function filtrarComprasNovas(
  compras: readonly CompraParceladaNova[],
  natureza: NaturezaFiltroVisao,
  instituicao: InstituicaoFiltroDivida = 'todas',
): CompraParceladaNova[] {
  return compras.filter((c) => {
    if (natureza !== 'todas' && c.natureza !== natureza) return false;
    if (instituicao !== 'todas' && c.instituicao !== instituicao) return false;
    return true;
  });
}

/** Instituições presentes nos dados já filtrados por natureza (quando aplicável). */
export function opcoesInstituicaoDivida(fatias: readonly FatiaDivida[]): string[] {
  const set = new Set(fatias.map((f) => f.instituicao));
  return [...set].sort((a, b) => {
    if (a === INSTITUICAO_NAO_INFORMADA) return 1;
    if (b === INSTITUICAO_NAO_INFORMADA) return -1;
    return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
  });
}

export interface IndicadoresInstituicaoDivida {
  qtdParcelamentosAtivos: number;
  qtdParcelasRestantes: number;
  parcelasMesCents: number;
  saldoFuturoCents: number;
}

/**
 * Ativos = compras/compromissos distintos com parcela em aberto a partir do início do mês.
 * Parcelas restantes = quantidade dessas fatias em aberto.
 */
export function indicadoresInstituicaoDoMes(
  fatias: readonly FatiaDivida[],
  monthKey: string,
): IndicadoresInstituicaoDivida {
  const inicio = inicioDoMes(monthKey);
  const fim = fimDoMes(monthKey);
  const doMes = fatias.filter((f) => f.monthKeyVencimento === monthKey);
  const restantes = fatias.filter(
    (f) => fatiaEmAberto(f) && f.dataVencimento.getTime() >= inicio.getTime(),
  );
  const ativos = new Set(restantes.map(chaveParcelamento));
  let saldoFuturo = 0;
  for (const f of fatias) {
    if (!fatiaEmAberto(f)) continue;
    if (f.dataVencimento.getTime() > fim.getTime()) saldoFuturo += f.valorCents;
  }
  return {
    qtdParcelamentosAtivos: ativos.size,
    qtdParcelasRestantes: restantes.length,
    parcelasMesCents: doMes.reduce((s, f) => s + f.valorCents, 0),
    saldoFuturoCents: saldoFuturo,
  };
}

export interface ResumoInstituicaoDivida {
  instituicao: string;
  qtdParcelamentosAtivos: number;
  qtdParcelasRestantes: number;
  parcelasMesCents: number;
  saldoFuturoCents: number;
}

export function resumoPorInstituicao(
  fatias: readonly FatiaDivida[],
  monthKey: string,
): ResumoInstituicaoDivida[] {
  const porInst = new Map<string, FatiaDivida[]>();
  for (const f of fatias) {
    const lista = porInst.get(f.instituicao) ?? [];
    lista.push(f);
    porInst.set(f.instituicao, lista);
  }
  return opcoesInstituicaoDivida(fatias).map((instituicao) => {
    const ind = indicadoresInstituicaoDoMes(porInst.get(instituicao) ?? [], monthKey);
    return { instituicao, ...ind };
  });
}

export interface ColunaDivida {
  monthKey: string;
  fase: FaseMesVisao;
  totalCents: number;
}

export function colunasDivida(
  fatias: readonly FatiaDivida[],
  hoje: Date,
): ColunaDivida[] {
  if (fatias.length === 0) return [];
  const keysVen = fatias.map((f) => f.monthKeyVencimento).sort();
  const keysCompra = fatias.map((f) => f.monthKeyCompra).sort();
  const inicio = keysCompra[0] < keysVen[0] ? keysCompra[0] : keysVen[0];
  const fim = keysVen[keysVen.length - 1];
  const keys = iterMonthKeys(inicio, fim);
  const porMes = new Map<string, number>();
  for (const f of fatias) {
    porMes.set(f.monthKeyVencimento, (porMes.get(f.monthKeyVencimento) ?? 0) + f.valorCents);
  }
  return keys.map((monthKey) => ({
    monthKey,
    fase: faseDoMes(monthKey, hoje),
    totalCents: porMes.get(monthKey) ?? 0,
  }));
}

/**
 * Eixo pelo mês da compra; valor = soma integral das compras (não das fatias).
 * Mesmo universo de montarComprasNovas / filtrarComprasNovas.
 */
export function colunasComprasNovas(
  compras: readonly CompraParceladaNova[],
  hoje: Date,
): ColunaDivida[] {
  if (compras.length === 0) return [];
  const keysCompra = compras.map((c) => c.monthKeyCompra).sort();
  const keys = iterMonthKeys(keysCompra[0], keysCompra[keysCompra.length - 1]);
  const porMes = new Map<string, number>();
  for (const c of compras) {
    porMes.set(c.monthKeyCompra, (porMes.get(c.monthKeyCompra) ?? 0) + c.totalCents);
  }
  return keys.map((monthKey) => ({
    monthKey,
    fase: faseDoMes(monthKey, hoje),
    totalCents: porMes.get(monthKey) ?? 0,
  }));
}

export function resumoComprasDoMes(compras: readonly CompraParceladaNova[], monthKey: string): {
  totalCents: number;
  qtd: number;
} {
  const doMes = comprasDoMes(compras, monthKey);
  return {
    totalCents: doMes.reduce((s, c) => s + c.totalCents, 0),
    qtd: doMes.length,
  };
}

export interface IndicadoresDividaMes {
  parcelasMesCents: number;
  novasComprasCents: number;
  qtdNovasCompras: number;
  encerramentosCents: number;
  qtdEncerramentos: number;
  saldoInicioCents: number;
  saldoFimCents: number;
}

export function indicadoresDoMes(
  fatias: readonly FatiaDivida[],
  compras: readonly CompraParceladaNova[],
  monthKey: string,
): IndicadoresDividaMes {
  const inicio = inicioDoMes(monthKey);
  const fim = fimDoMes(monthKey);
  const doMes = fatias.filter((f) => f.monthKeyVencimento === monthKey);
  const encerramentos = doMes.filter((f) => f.parcela === f.totalParcelas);
  const novas = compras.filter((c) => c.monthKeyCompra === monthKey);

  let saldoInicio = 0;
  let saldoFim = 0;
  for (const f of fatias) {
    if (!fatiaEmAberto(f)) continue;
    if (f.dataVencimento.getTime() >= inicio.getTime()) saldoInicio += f.valorCents;
    if (f.dataVencimento.getTime() > fim.getTime()) saldoFim += f.valorCents;
  }

  return {
    parcelasMesCents: doMes.reduce((s, f) => s + f.valorCents, 0),
    novasComprasCents: novas.reduce((s, c) => s + c.totalCents, 0),
    qtdNovasCompras: novas.length,
    encerramentosCents: encerramentos.reduce((s, f) => s + f.valorCents, 0),
    qtdEncerramentos: encerramentos.length,
    saldoInicioCents: saldoInicio,
    saldoFimCents: saldoFim,
  };
}

export interface OrigemMesDivida {
  monthKeyCompra: string;
  valorCents: number;
  participacao: number | null;
}

export function origemDoMes(fatias: readonly FatiaDivida[], monthKey: string): OrigemMesDivida[] {
  const doMes = fatias.filter((f) => f.monthKeyVencimento === monthKey);
  const total = doMes.reduce((s, f) => s + f.valorCents, 0);
  const mapa = new Map<string, number>();
  for (const f of doMes) {
    mapa.set(f.monthKeyCompra, (mapa.get(f.monthKeyCompra) ?? 0) + f.valorCents);
  }
  return [...mapa.entries()]
    .map(([monthKeyCompra, valorCents]) => ({
      monthKeyCompra,
      valorCents,
      participacao: total > 0 ? valorCents / total : null,
    }))
    .sort((a, b) => a.monthKeyCompra.localeCompare(b.monthKeyCompra));
}

export interface DestinoMesDivida {
  monthKeyVencimento: string;
  valorCents: number;
  participacao: number | null;
}

export function destinoDaCompra(
  fatias: readonly FatiaDivida[],
  compraRef: { gastoId?: string | null; compromissoId?: string | null; monthKeyCompra?: string },
): DestinoMesDivida[] {
  let selecionadas = fatias;
  if (compraRef.gastoId) {
    selecionadas = fatias.filter((f) => f.gastoId === compraRef.gastoId);
  } else if (compraRef.compromissoId) {
    selecionadas = fatias.filter((f) => f.compromissoId === compraRef.compromissoId);
  } else if (compraRef.monthKeyCompra) {
    selecionadas = fatias.filter((f) => f.monthKeyCompra === compraRef.monthKeyCompra);
  } else {
    return [];
  }
  const total = selecionadas.reduce((s, f) => s + f.valorCents, 0);
  const mapa = new Map<string, number>();
  for (const f of selecionadas) {
    mapa.set(f.monthKeyVencimento, (mapa.get(f.monthKeyVencimento) ?? 0) + f.valorCents);
  }
  return [...mapa.entries()]
    .map(([monthKeyVencimento, valorCents]) => ({
      monthKeyVencimento,
      valorCents,
      participacao: total > 0 ? valorCents / total : null,
    }))
    .sort((a, b) => a.monthKeyVencimento.localeCompare(b.monthKeyVencimento));
}

export function fatiasDoMes(fatias: readonly FatiaDivida[], monthKey: string): FatiaDivida[] {
  return fatias.filter((f) => f.monthKeyVencimento === monthKey);
}

export function encerramentosDoMes(fatias: readonly FatiaDivida[], monthKey: string): FatiaDivida[] {
  return fatiasDoMes(fatias, monthKey).filter((f) => f.parcela === f.totalParcelas);
}

export function comprasDoMes(
  compras: readonly CompraParceladaNova[],
  monthKey: string,
): CompraParceladaNova[] {
  return compras.filter((c) => c.monthKeyCompra === monthKey);
}

export function naturezasPresentes(fatias: readonly FatiaDivida[]): NaturezaVisao[] {
  const set = new Set(fatias.map((f) => f.natureza));
  const ordem: NaturezaVisao[] = ['pessoal', 'empresa', 'nao_classificado'];
  return ordem.filter((n) => set.has(n));
}
