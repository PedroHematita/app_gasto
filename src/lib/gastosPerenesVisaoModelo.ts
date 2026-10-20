/**
 * Linhas mensais da aba Gastos Perenes.
 * Histórico materializado + projeção de ativos; sem double-count.
 */

import type { CompromissoRecord, GastoPereneRecord, GastoRecord, PeriodicidadePerene } from '../types';
import { fimJanelaDozeMeses } from './gastosParceladosFuturos';
import { vencimentosPereneNoIntervalo } from './gastosPerenePeriods';
import { naturezaDeTipoGasto, type NaturezaVisao, type SituacaoVisao } from './visaoFinanceiraModelo';
import { monthKeyFromDate } from './visaoFinanceiraConsulta';
import {
  gastoPereneToPeriodInput,
  isGastoPereneEligibleForForecast,
  parseDateBR,
  startOfDayLocal,
} from '../utils';

export const ROTULO_PERIODICIDADE_PERENE: Record<PeriodicidadePerene, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
};

export interface LinhaPereneVisao {
  id: string;
  monthKey: string;
  dataRef: Date;
  valorCents: number;
  natureza: NaturezaVisao;
  situacao: SituacaoVisao;
  fornecedor: string;
  periodicidade: PeriodicidadePerene | null;
  gastoPereneId: string | null;
  origem: string;
}

export interface MontarPerenesVisaoInput {
  hoje: Date;
  gastos: readonly GastoRecord[];
  tipoGastoPorId: ReadonlyMap<string, string | null | undefined>;
  gastoIdsPerene: ReadonlySet<string>;
  gastoPereneIdPorGastoId: ReadonlyMap<string, string>;
  compromissos: readonly CompromissoRecord[];
  perenes: readonly GastoPereneRecord[];
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function situacaoAberta(status: string, data: Date, hoje: Date): 'pendente' | 'vencido' | null {
  if (status === 'cancelado' || status === 'quitado') return null;
  if (status !== 'pendente' && status !== 'vencido') return null;
  if (status === 'vencido' || startOfDayLocal(data).getTime() < startOfDayLocal(hoje).getTime()) {
    return 'vencido';
  }
  return 'pendente';
}

function periodicidadeDoModelo(
  pereneId: string | null | undefined,
  perenesPorId: ReadonlyMap<string, GastoPereneRecord>,
): PeriodicidadePerene | null {
  if (!pereneId) return null;
  return perenesPorId.get(pereneId)?.periodicidade ?? null;
}

export function montarLinhasPerenesVisao(input: MontarPerenesVisaoInput): LinhaPereneVisao[] {
  const hoje = startOfDayLocal(input.hoje);
  const fim = fimJanelaDozeMeses(hoje);
  const linhas: LinhaPereneVisao[] = [];
  const perenesPorId = new Map(input.perenes.map((p) => [p.id, p]));
  const compromissoCobrePerene = new Set<string>();

  for (const c of input.compromissos) {
    if (!c.gastoPereneId) continue;
    const prevista = parseDateBR(c.dataPrevistaPagamento);
    if (!prevista) continue;
    compromissoCobrePerene.add(`${c.gastoPereneId}|${isoDate(startOfDayLocal(prevista))}`);
  }

  for (const gasto of input.gastos) {
    if (!input.gastoIdsPerene.has(gasto.id)) continue;
    const compra = parseDateBR(gasto.dataCompra);
    if (!compra) continue;
    const dia = startOfDayLocal(compra);
    const pereneId = input.gastoPereneIdPorGastoId.get(gasto.id) ?? null;
    linhas.push({
      id: `gasto-perene:${gasto.id}`,
      monthKey: monthKeyFromDate(dia),
      dataRef: dia,
      valorCents: gasto.total,
      natureza: naturezaDeTipoGasto(input.tipoGastoPorId.get(gasto.id)),
      situacao: 'realizado',
      fornecedor: gasto.fornecedor.trim() || 'Gasto',
      periodicidade: periodicidadeDoModelo(pereneId, perenesPorId),
      gastoPereneId: pereneId,
      origem: 'Pagamento confirmado (quitação de compromisso perene)',
    });
  }

  for (const c of input.compromissos) {
    if (!c.gastoPereneId) continue;
    if (c.gastoId && input.gastos.some((g) => g.id === c.gastoId)) continue;
    if (c.tipo === 'parcelado') continue;
    const prevista = parseDateBR(c.dataPrevistaPagamento);
    if (!prevista) continue;
    const dia = startOfDayLocal(prevista);
    const situacao = situacaoAberta(c.status, dia, hoje);
    if (!situacao) continue;
    linhas.push({
      id: `comp-perene:${c.id}`,
      monthKey: monthKeyFromDate(dia),
      dataRef: dia,
      valorCents: c.total,
      natureza: 'nao_classificado',
      situacao,
      fornecedor: c.fornecedor.trim() || 'Compromisso',
      periodicidade: periodicidadeDoModelo(c.gastoPereneId, perenesPorId),
      gastoPereneId: c.gastoPereneId,
      origem: 'Compromisso gerado por gasto perene',
    });
  }

  for (const gp of input.perenes) {
    if (!isGastoPereneEligibleForForecast(gp, hoje)) continue;
    const pi = gastoPereneToPeriodInput(gp);
    if (!pi) continue;
    const datas = vencimentosPereneNoIntervalo(pi, hoje, fim);
    for (const due of datas) {
      const dia = startOfDayLocal(due);
      if (dia.getTime() < hoje.getTime()) continue;
      const chave = `${gp.id}|${isoDate(dia)}`;
      if (compromissoCobrePerene.has(chave)) continue;
      linhas.push({
        id: `prev-perene:${gp.id}:${isoDate(dia)}`,
        monthKey: monthKeyFromDate(dia),
        dataRef: dia,
        valorCents: gp.valorPrevistoCents,
        natureza: 'nao_classificado',
        situacao: 'projecao',
        fornecedor: gp.fornecedor.trim() || 'Gasto perene',
        periodicidade: gp.periodicidade,
        gastoPereneId: gp.id,
        origem: 'Previsão de gasto perene, ainda sem compromisso',
      });
    }
  }

  return linhas.sort((a, b) => {
    const t = a.dataRef.getTime() - b.dataRef.getTime();
    if (t !== 0) return t;
    return a.fornecedor.localeCompare(b.fornecedor, 'pt-BR');
  });
}
