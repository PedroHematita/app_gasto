/**
 * Consolida perenes, compromissos ativos, parcelas futuras de gastos parcelados
 * e opcionalmente gastos realizados, agrupados por ano/mês (janela: hoje → +12 meses calendário).
 */

import type { CompromissoRecord, GastoPereneRecord, GastoRecord } from '../types';
import {
  compromissoDisplayTitle,
  gastoPereneToPeriodInput,
  isGastoPereneEligibleForForecast,
  parseDateBR,
  startOfDayLocal,
} from '../utils';
import { vencimentosPereneNoIntervalo } from './gastosPerenePeriods';
import { fimJanelaDozeMeses, isFormaPagamentoParcelado, parcelasFuturasDoGasto } from './gastosParceladosFuturos';

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export type OrigemFuturoLinha = 'perene' | 'rascunho' | 'parcelado' | 'realizado';

export interface LinhaGastoFuturo {
  id: string;
  /** Ordenação dentro do mês (vencimento previsto ou data da compra para realizados). */
  dataRef: Date;
  valorCents: number;
  titulo: string;
  origem: OrigemFuturoLinha;
  gastoId?: string;
  compromissoId?: string;
  gastoPereneId?: string;
}

export interface MesFuturoGroup {
  key: string;
  year: number;
  month: number;
  label: string;
  itens: LinhaGastoFuturo[];
  totalCents: number;
}

export interface AnoFuturoGroup {
  year: number;
  months: MesFuturoGroup[];
  totalCents: number;
}

export interface ConsolidarGastosFuturosInput {
  hoje: Date;
  gastosPerenes: GastoPereneRecord[];
  compromissos: CompromissoRecord[];
  gastos: GastoRecord[];
  incluirRealizados: boolean;
}

function monthKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** O mês-calendário [y, m] tem interseção não vazia com o intervalo fechado [start, end] (só datas). */
export function mesCalendarioSobrepoeJanela(
  year: number,
  month1to12: number,
  start: Date,
  end: Date
): boolean {
  const first = startOfDayLocal(new Date(year, month1to12 - 1, 1));
  const last = startOfDayLocal(new Date(year, month1to12, 0));
  return last.getTime() >= start.getTime() && first.getTime() <= end.getTime();
}

function tituloGasto(g: GastoRecord): string {
  const f = g.fornecedor.trim();
  if (f) return f;
  const d = g.items[0]?.descricao?.trim();
  if (d) return d;
  return 'Gasto';
}

function sortLinhas(a: LinhaGastoFuturo, b: LinhaGastoFuturo): number {
  const t = a.dataRef.getTime() - b.dataRef.getTime();
  if (t !== 0) return t;
  return a.titulo.localeCompare(b.titulo, 'pt-BR');
}

/**
 * Agrupa linhas em anos/meses, meses em ordem cronológica, anos em ordem cronológica.
 */
export function consolidarGastosFuturos(input: ConsolidarGastosFuturosInput): AnoFuturoGroup[] {
  const hojeSod = startOfDayLocal(input.hoje);
  const fim = fimJanelaDozeMeses(input.hoje);
  const porMes = new Map<string, LinhaGastoFuturo[]>();

  const push = (key: string, linha: LinhaGastoFuturo) => {
    if (!porMes.has(key)) porMes.set(key, []);
    porMes.get(key)!.push(linha);
  };

  for (const gp of input.gastosPerenes) {
    if (!isGastoPereneEligibleForForecast(gp, hojeSod)) continue;
    const pi = gastoPereneToPeriodInput(gp);
    if (!pi) continue;
    const datas = vencimentosPereneNoIntervalo(pi, hojeSod, fim);
    for (const due of datas) {
      const key = monthKeyFromDate(due);
      const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
      push(key, {
        id: `perene:${gp.id}:${iso}`,
        dataRef: due,
        valorCents: gp.valorPrevistoCents,
        titulo: gp.fornecedor.trim() || '—',
        origem: 'perene',
        gastoPereneId: gp.id,
      });
    }
  }

  /*
   * Compromissos (rascunho): inclui data prevista em [hoje, fim] com **hoje inclusivo**
   * — compromisso que vence hoje ainda é saída futura pendente.
   *
   * Parcelas futuras vêm de `parcelasFuturasDoGasto`, que usa **vencimento > hoje**
   * estrito — parcela no dia de hoje não entra aqui (alinhado à decisão de produto).
   */
  for (const c of input.compromissos) {
    const dp = parseDateBR(c.dataPrevistaPagamento);
    if (!dp) continue;
    const d = startOfDayLocal(dp);
    if (d.getTime() < hojeSod.getTime() || d.getTime() > fim.getTime()) continue;
    const key = monthKeyFromDate(d);
    push(key, {
      id: `comp:${c.id}`,
      dataRef: d,
      valorCents: c.total,
      titulo: compromissoDisplayTitle(c),
      origem: 'rascunho',
      compromissoId: c.id,
    });
  }

  for (const g of input.gastos) {
    const n = g.parcelas ?? 0;
    if (!isFormaPagamentoParcelado(g.formaPagamento) || n <= 1) continue;
    const parcelas = parcelasFuturasDoGasto(
      {
        dataCompraBR: g.dataCompra,
        totalCents: g.total,
        formaPagamento: g.formaPagamento,
        numeroParcelas: n,
      },
      input.hoje
    );
    const base = tituloGasto(g);
    for (const p of parcelas) {
      const key = monthKeyFromDate(p.dataVencimento);
      push(key, {
        id: `parc:${g.id}:${p.parcela}`,
        dataRef: p.dataVencimento,
        valorCents: p.valorCents,
        titulo: `${base} · Parc. ${p.parcela}/${n}`,
        origem: 'parcelado',
        gastoId: g.id,
      });
    }
  }

  if (input.incluirRealizados) {
    for (const g of input.gastos) {
      const dc = parseDateBR(g.dataCompra);
      if (!dc) continue;
      const y = dc.getFullYear();
      const m = dc.getMonth() + 1;
      if (!mesCalendarioSobrepoeJanela(y, m, hojeSod, fim)) continue;
      const key = monthKeyFromDate(startOfDayLocal(dc));
      push(key, {
        id: `real:${g.id}`,
        dataRef: startOfDayLocal(dc),
        valorCents: g.total,
        titulo: tituloGasto(g),
        origem: 'realizado',
        gastoId: g.id,
      });
    }
  }

  const keysOrdenadas = [...porMes.keys()].sort();

  const meses: MesFuturoGroup[] = keysOrdenadas.map((key) => {
    const [ys, ms] = key.split('-');
    const year = Number(ys);
    const month = Number(ms);
    const itens = (porMes.get(key) || []).sort(sortLinhas);
    const totalCents = itens.reduce((s, x) => s + x.valorCents, 0);
    return {
      key,
      year,
      month,
      label: MONTH_NAMES[month - 1] || String(month),
      itens,
      totalCents,
    };
  });

  const porAno = new Map<number, MesFuturoGroup[]>();
  for (const mes of meses) {
    if (!porAno.has(mes.year)) porAno.set(mes.year, []);
    porAno.get(mes.year)!.push(mes);
  }

  const anosOrd = [...porAno.keys()].sort((a, b) => a - b);
  return anosOrd.map((year) => {
    const months = porAno.get(year)!;
    const totalCents = months.reduce((s, m) => s + m.totalCents, 0);
    return { year, months, totalCents };
  });
}

/** Filtro de busca no título (UI Meus Gastos) — remove meses/anos vazios. */
export function filterAnosFuturosPorBusca(anos: AnoFuturoGroup[], query: string): AnoFuturoGroup[] {
  const q = query.trim().toLowerCase();
  if (!q) return anos;
  const out: AnoFuturoGroup[] = [];
  for (const ano of anos) {
    const months: MesFuturoGroup[] = [];
    for (const mes of ano.months) {
      const itens = mes.itens.filter((i) => i.titulo.toLowerCase().includes(q));
      if (itens.length === 0) continue;
      const totalCents = itens.reduce((s, x) => s + x.valorCents, 0);
      months.push({ ...mes, itens, totalCents });
    }
    if (months.length === 0) continue;
    const totalCents = months.reduce((s, m) => s + m.totalCents, 0);
    out.push({ year: ano.year, months, totalCents });
  }
  return out;
}
