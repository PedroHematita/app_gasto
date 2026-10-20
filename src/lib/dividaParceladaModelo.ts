/**
 * Fatias unificadas da Dívida Parcelada.
 * Agenda de cartão = projeção; compromisso = status real.
 * Não soma valor integral da compra no mesmo eixo das fatias.
 */

import type { CompromissoRecord, CompromissoStatus, GastoRecord } from '../types';
import {
  dataVencimentoParcela,
  distribuirValorParcelas,
  isFormaPagamentoParcelado,
} from './gastosParceladosFuturos';
import { naturezaDeTipoGasto, type NaturezaVisao } from './visaoFinanceiraModelo';
import { monthKeyFromDate } from './visaoFinanceiraConsulta';
import { parseDateBR, startOfDayLocal } from '../utils';

export type OrigemFatiaDivida = 'gasto_agenda' | 'compromisso';

export type SituacaoFatiaDivida = 'projecao' | 'pendente' | 'vencido' | 'quitado';

/** Rótulo usado quando o gasto não tem instituição ou o registro é compromisso. */
export const INSTITUICAO_NAO_INFORMADA = 'Não informado';

/** Normaliza o texto cadastrado; não inventa cartão. */
export function normalizarInstituicaoDivida(raw: string | null | undefined): string {
  const texto = (raw ?? '').trim();
  if (!texto) return INSTITUICAO_NAO_INFORMADA;
  if (texto.toLowerCase() === '(não se aplica)') return INSTITUICAO_NAO_INFORMADA;
  return texto;
}

export interface FatiaDivida {
  id: string;
  origemTipo: OrigemFatiaDivida;
  monthKeyVencimento: string;
  dataVencimento: Date;
  monthKeyCompra: string;
  dataCompra: Date;
  valorCents: number;
  parcela: number;
  totalParcelas: number;
  fornecedor: string;
  natureza: NaturezaVisao;
  situacao: SituacaoFatiaDivida;
  /** Instituição do gasto de origem; compromissos ficam em Não informado. */
  instituicao: string;
  /** Total da compra/compromisso (centavos), quando conhecido. */
  totalCompraCents: number;
  gastoId: string | null;
  compromissoId: string | null;
  origemRotulo: string;
}

export interface CompraParceladaNova {
  id: string;
  origemTipo: OrigemFatiaDivida;
  monthKeyCompra: string;
  dataCompra: Date;
  fornecedor: string;
  natureza: NaturezaVisao;
  instituicao: string;
  totalCents: number;
  totalParcelas: number;
  gastoId: string | null;
  compromissoId: string | null;
}

export interface MontarDividaInput {
  hoje: Date;
  gastos: readonly GastoRecord[];
  tipoGastoPorId: ReadonlyMap<string, string | null | undefined>;
  gastoIdsPerene: ReadonlySet<string>;
  gastoIdsParcela: ReadonlySet<string>;
  compromissosParcelados: readonly CompromissoRecord[];
}

function tituloGasto(g: GastoRecord): string {
  const f = g.fornecedor.trim();
  return f || 'Gasto';
}

function situacaoCompromisso(status: CompromissoStatus, data: Date, hoje: Date): SituacaoFatiaDivida | null {
  if (status === 'cancelado') return null;
  if (status === 'quitado') return 'quitado';
  if (status === 'vencido') return 'vencido';
  if (status === 'pendente') {
    if (startOfDayLocal(data).getTime() < startOfDayLocal(hoje).getTime()) return 'vencido';
    return 'pendente';
  }
  return null;
}

/** Fatia ainda conta no saldo remanescente projetado. */
export function fatiaEmAberto(fatia: FatiaDivida): boolean {
  if (fatia.origemTipo === 'gasto_agenda') return true;
  return fatia.situacao === 'pendente' || fatia.situacao === 'vencido';
}

export function montarFatiasDivida(input: MontarDividaInput): FatiaDivida[] {
  const hoje = startOfDayLocal(input.hoje);
  const fatias: FatiaDivida[] = [];

  for (const g of input.gastos) {
    if (input.gastoIdsPerene.has(g.id) || input.gastoIdsParcela.has(g.id)) continue;
    const n = g.parcelas ?? 0;
    if (!isFormaPagamentoParcelado(g.formaPagamento) || n <= 1) continue;
    const compra = parseDateBR(g.dataCompra);
    if (!compra) continue;
    const dataCompra = startOfDayLocal(compra);
    const natureza = naturezaDeTipoGasto(input.tipoGastoPorId.get(g.id));
    const instituicao = normalizarInstituicaoDivida(g.instituicaoFinanceira);
    const valores = distribuirValorParcelas(g.total, n);
    const fornecedorBase = tituloGasto(g);

    for (let k = 1; k <= n; k += 1) {
      const due = dataVencimentoParcela(g.dataCompra, k);
      if (!due) continue;
      const dataVencimento = startOfDayLocal(due);
      fatias.push({
        id: `agenda:${g.id}:${k}`,
        origemTipo: 'gasto_agenda',
        monthKeyVencimento: monthKeyFromDate(dataVencimento),
        dataVencimento,
        monthKeyCompra: monthKeyFromDate(dataCompra),
        dataCompra,
        valorCents: valores[k - 1] ?? 0,
        parcela: k,
        totalParcelas: n,
        fornecedor: fornecedorBase,
        natureza,
        situacao: 'projecao',
        instituicao,
        totalCompraCents: g.total,
        gastoId: g.id,
        compromissoId: null,
        origemRotulo: 'Agenda do cartão · previsão de calendário',
      });
    }
  }

  for (const c of input.compromissosParcelados) {
    if (c.tipo !== 'parcelado' || c.status === 'cancelado') continue;
    const compra = parseDateBR(c.dataCompra);
    if (!compra) continue;
    const dataCompra = startOfDayLocal(compra);
    const fornecedorBase = c.fornecedor.trim() || 'Compromisso';

    for (const p of c.parcelas ?? []) {
      if (p.status === 'cancelado') continue;
      const venc = parseDateBR(p.dataVencimentoBR);
      if (!venc) continue;
      const dataVencimento = startOfDayLocal(venc);
      const situacao = situacaoCompromisso(p.status, dataVencimento, hoje);
      if (!situacao) continue;
      fatias.push({
        id: `comp-parc:${p.id}`,
        origemTipo: 'compromisso',
        monthKeyVencimento: monthKeyFromDate(dataVencimento),
        dataVencimento,
        monthKeyCompra: monthKeyFromDate(dataCompra),
        dataCompra,
        valorCents: p.valorCentavos,
        parcela: p.numeroParcela,
        totalParcelas: p.totalParcelas,
        fornecedor: fornecedorBase,
        natureza: 'nao_classificado',
        situacao,
        instituicao: INSTITUICAO_NAO_INFORMADA,
        totalCompraCents: c.total,
        gastoId: null,
        compromissoId: c.id,
        origemRotulo: 'Compromisso parcelado',
      });
    }
  }

  return fatias.sort((a, b) => {
    const byVen = a.dataVencimento.getTime() - b.dataVencimento.getTime();
    if (byVen !== 0) return byVen;
    return a.fornecedor.localeCompare(b.fornecedor, 'pt-BR');
  });
}

export function montarComprasNovas(input: MontarDividaInput): CompraParceladaNova[] {
  const compras: CompraParceladaNova[] = [];

  for (const g of input.gastos) {
    if (input.gastoIdsPerene.has(g.id) || input.gastoIdsParcela.has(g.id)) continue;
    const n = g.parcelas ?? 0;
    if (!isFormaPagamentoParcelado(g.formaPagamento) || n <= 1) continue;
    const compra = parseDateBR(g.dataCompra);
    if (!compra) continue;
    const dataCompra = startOfDayLocal(compra);
    compras.push({
      id: `compra-gasto:${g.id}`,
      origemTipo: 'gasto_agenda',
      monthKeyCompra: monthKeyFromDate(dataCompra),
      dataCompra,
      fornecedor: tituloGasto(g),
      natureza: naturezaDeTipoGasto(input.tipoGastoPorId.get(g.id)),
      instituicao: normalizarInstituicaoDivida(g.instituicaoFinanceira),
      totalCents: g.total,
      totalParcelas: n,
      gastoId: g.id,
      compromissoId: null,
    });
  }

  for (const c of input.compromissosParcelados) {
    if (c.tipo !== 'parcelado' || c.status === 'cancelado') continue;
    const compra = parseDateBR(c.dataCompra);
    if (!compra) continue;
    const dataCompra = startOfDayLocal(compra);
    const n = c.parcelas?.length ?? 0;
    compras.push({
      id: `compra-comp:${c.id}`,
      origemTipo: 'compromisso',
      monthKeyCompra: monthKeyFromDate(dataCompra),
      dataCompra,
      fornecedor: c.fornecedor.trim() || 'Compromisso',
      natureza: 'nao_classificado',
      instituicao: INSTITUICAO_NAO_INFORMADA,
      totalCents: c.total,
      totalParcelas: n > 0 ? n : 1,
      gastoId: null,
      compromissoId: c.id,
    });
  }

  return compras.sort((a, b) => a.dataCompra.getTime() - b.dataCompra.getTime());
}
