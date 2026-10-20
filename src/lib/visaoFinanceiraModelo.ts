/**
 * Agrega gastos, compromissos e perenes para a Visão Financeira.
 * Cada obrigação entra uma vez. Projeção não é tratada como pagamento.
 */

import type { CompromissoRecord, GastoPereneRecord, GastoRecord } from '../types';
import { TIPO_GASTO_NAO_CLASSIFICADO } from '../types';
import {
  dataVencimentoParcela,
  distribuirValorParcelas,
  fimJanelaDozeMeses,
  isFormaPagamentoParcelado,
} from './gastosParceladosFuturos';
import { vencimentosPereneNoIntervalo } from './gastosPerenePeriods';
import { monthKeyFromDate } from './visaoFinanceiraConsulta';
import {
  gastoPereneToPeriodInput,
  isGastoPereneEligibleForForecast,
  parseDateBR,
  startOfDayLocal,
} from '../utils';

export type ModalidadeVisao = 'perene' | 'parcelado' | 'demais';
export type NaturezaVisao = 'pessoal' | 'empresa' | 'nao_classificado';
export type NaturezaFiltroVisao = 'todas' | NaturezaVisao;
export type FaseMesVisao = 'historico' | 'atual' | 'futuro';
export type SituacaoVisao = 'realizado' | 'pendente' | 'vencido' | 'projecao';
export type PeriodoVisao = 'historico' | 'mes_atual' | 'futuro' | 'completa';
export type PerspectivaVisao = 'completa' | 'registrados' | 'comprometimento';

export const CRITERIO_PERSPECTIVA: Record<PerspectivaVisao, string> = {
  completa:
    'Composição do mês: gastos registrados, vencimentos e projeções. Não é só o que foi pago nem só o que está comprometido.',
  registrados: 'Gastos já cadastrados, pelo valor integral, no mês da data registrada.',
  comprometimento:
    'Por vencimento: agenda do cartão, compromissos em aberto e projeção de perenes. Não inclui os gastos à vista já registrados.',
};

export const MODALIDADES_VISAO: ModalidadeVisao[] = ['perene', 'parcelado', 'demais'];

export const ROTULO_MODALIDADE: Record<ModalidadeVisao, string> = {
  perene: 'Gastos perenes',
  parcelado: 'Gastos parcelados',
  demais: 'Demais gastos',
};

export const ROTULO_NATUREZA: Record<NaturezaVisao, string> = {
  pessoal: 'Pessoal',
  empresa: 'Empresa',
  nao_classificado: 'Não classificado',
};

export const ROTULO_SITUACAO: Record<SituacaoVisao, string> = {
  realizado: 'Realizado',
  pendente: 'Pendente',
  vencido: 'Vencido',
  projecao: 'Projeção',
};

const NATUREZA_SEM_CADASTRO =
  'Compromissos e modelos perenes não têm natureza cadastrada.';

export interface LinhaVisao {
  id: string;
  monthKey: string;
  dataRef: Date;
  valorCents: number;
  modalidade: ModalidadeVisao;
  natureza: NaturezaVisao;
  situacao: SituacaoVisao;
  fornecedor: string;
  origem: string;
  naturezaObservacao: string | null;
  /** Textos já gravados no gasto. Nulos quando o registro não tem pagamento. */
  formaPagamento: string | null;
  meioPagamento: string | null;
  instituicaoFinanceira: string | null;
}

export interface MontarVisaoInput {
  hoje: Date;
  gastos: GastoRecord[];
  /** `tipo_gasto` cru, por id do gasto. Ausência = não classificado. */
  tipoGastoPorId: ReadonlyMap<string, string | null | undefined>;
  /** Gastos gerados na quitação de um compromisso perene. */
  gastoIdsPerene: ReadonlySet<string>;
  /** Gastos gerados na quitação de uma parcela. */
  gastoIdsParcela: ReadonlySet<string>;
  compromissos: CompromissoRecord[];
  perenes: GastoPereneRecord[];
  perspectiva: PerspectivaVisao;
}

export interface ResumoVisao {
  totalCents: number;
  porModalidade: Record<ModalidadeVisao, number>;
  participacao: Record<ModalidadeVisao, number | null>;
}

export interface EvolucaoVisao {
  mesReferencia: string;
  mesBase: string;
  atualCents: number;
  anteriorCents: number;
  /** Variação percentual. Nula quando o mês base não tem lançamentos. */
  variacao: number | null;
}

export interface ColunaVisao {
  monthKey: string;
  fase: FaseMesVisao;
  porModalidade: Record<ModalidadeVisao, number>;
  totalCents: number;
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function naturezaDeTipoGasto(tipo: string | null | undefined): NaturezaVisao {
  const t = (tipo ?? '').trim();
  if (!t || t === TIPO_GASTO_NAO_CLASSIFICADO) return 'nao_classificado';
  if (t === 'Pessoal') return 'pessoal';
  if (t === 'Empresarial' || t === 'Empresa') return 'empresa';
  return 'nao_classificado';
}

function tituloGasto(g: GastoRecord): string {
  const f = g.fornecedor.trim();
  if (f) return f;
  return 'Gasto';
}

function situacaoAberta(status: string, data: Date, hoje: Date): 'pendente' | 'vencido' | null {
  if (status === 'cancelado' || status === 'quitado') return null;
  if (status !== 'pendente' && status !== 'vencido') return null;
  if (status === 'vencido' || startOfDayLocal(data).getTime() < startOfDayLocal(hoje).getTime()) {
    return 'vencido';
  }
  return 'pendente';
}

function linha(partial: Omit<LinhaVisao, 'formaPagamento' | 'meioPagamento' | 'instituicaoFinanceira'> & Partial<Pick<LinhaVisao, 'formaPagamento' | 'meioPagamento' | 'instituicaoFinanceira'>>): LinhaVisao {
  return {
    formaPagamento: null,
    meioPagamento: null,
    instituicaoFinanceira: null,
    ...partial,
  };
}

function pagamentoDoGasto(gasto: GastoRecord) {
  return {
    formaPagamento: gasto.formaPagamento.trim() || null,
    meioPagamento: gasto.meioPagamento.trim() || null,
    instituicaoFinanceira: gasto.instituicaoFinanceira.trim() || null,
  };
}

function modalidadeDoGastoRegistrado(input: MontarVisaoInput, gasto: GastoRecord): ModalidadeVisao {
  if (input.gastoIdsPerene.has(gasto.id)) return 'perene';
  const parcelas = gasto.parcelas ?? 0;
  if (input.gastoIdsParcela.has(gasto.id) || (isFormaPagamentoParcelado(gasto.formaPagamento) && parcelas > 1)) {
    return 'parcelado';
  }
  return 'demais';
}

function origemDoGastoRegistrado(input: MontarVisaoInput, gasto: GastoRecord): string {
  if (input.gastoIdsPerene.has(gasto.id)) return 'Gasto da quitação de compromisso perene';
  if (input.gastoIdsParcela.has(gasto.id)) return 'Gasto da quitação de parcela';
  if (isFormaPagamentoParcelado(gasto.formaPagamento) && (gasto.parcelas ?? 0) > 1) {
    return 'Gasto parcelado registrado pelo valor integral na data da compra';
  }
  return 'Gasto registrado na data da compra';
}

function montarRegistrados(input: MontarVisaoInput): LinhaVisao[] {
  const linhas: LinhaVisao[] = [];
  for (const gasto of input.gastos) {
    const compra = parseDateBR(gasto.dataCompra);
    if (!compra) continue;
    const compraDia = startOfDayLocal(compra);
    linhas.push(linha({
      id: `gasto:${gasto.id}`,
      monthKey: monthKeyFromDate(compraDia),
      dataRef: compraDia,
      valorCents: gasto.total,
      modalidade: modalidadeDoGastoRegistrado(input, gasto),
      natureza: naturezaDeTipoGasto(input.tipoGastoPorId.get(gasto.id)),
      situacao: 'realizado',
      fornecedor: tituloGasto(gasto),
      origem: origemDoGastoRegistrado(input, gasto),
      naturezaObservacao: null,
      ...pagamentoDoGasto(gasto),
    }));
  }
  return linhas;
}

function ordenarLinhas(linhas: LinhaVisao[]): LinhaVisao[] {
  return linhas.sort((a, b) => {
    const t = a.dataRef.getTime() - b.dataRef.getTime();
    if (t !== 0) return t;
    return a.fornecedor.localeCompare(b.fornecedor, 'pt-BR');
  });
}

/** Gastos que não vão para a agenda do cartão: à vista, quitação de perene e quitação de parcela. */
function montarGastosForaDaAgenda(input: MontarVisaoInput): LinhaVisao[] {
  const linhas: LinhaVisao[] = [];
  for (const gasto of input.gastos) {
    const compra = parseDateBR(gasto.dataCompra);
    if (!compra) continue;
    const n = gasto.parcelas ?? 0;
    const vaiParaAgenda = isFormaPagamentoParcelado(gasto.formaPagamento)
      && n > 1
      && !input.gastoIdsPerene.has(gasto.id)
      && !input.gastoIdsParcela.has(gasto.id);
    if (vaiParaAgenda) continue;
    const compraDia = startOfDayLocal(compra);
    linhas.push(linha({
      id: `gasto:${gasto.id}`,
      monthKey: monthKeyFromDate(compraDia),
      dataRef: compraDia,
      valorCents: gasto.total,
      modalidade: modalidadeDoGastoRegistrado(input, gasto),
      natureza: naturezaDeTipoGasto(input.tipoGastoPorId.get(gasto.id)),
      situacao: 'realizado',
      fornecedor: tituloGasto(gasto),
      origem: origemDoGastoRegistrado(input, gasto),
      naturezaObservacao: null,
      ...pagamentoDoGasto(gasto),
    }));
  }
  return linhas;
}

function montarComprometimento(input: MontarVisaoInput): LinhaVisao[] {
  const hoje = startOfDayLocal(input.hoje);
  const fim = fimJanelaDozeMeses(hoje);
  const linhas: LinhaVisao[] = [];
  const compromissoCobrePerene = new Set<string>();

  for (const c of input.compromissos) {
    if (!c.gastoPereneId) continue;
    const prevista = parseDateBR(c.dataPrevistaPagamento);
    if (!prevista) continue;
    compromissoCobrePerene.add(`${c.gastoPereneId}|${isoDate(startOfDayLocal(prevista))}`);
  }

  for (const g of input.gastos) {
    const natureza = naturezaDeTipoGasto(input.tipoGastoPorId.get(g.id));
    if (input.gastoIdsPerene.has(g.id) || input.gastoIdsParcela.has(g.id)) continue;

    const n = g.parcelas ?? 0;
    if (!isFormaPagamentoParcelado(g.formaPagamento) || n <= 1) continue;
    const valores = distribuirValorParcelas(g.total, n);
    for (let k = 1; k <= n; k++) {
      const due = dataVencimentoParcela(g.dataCompra, k);
      if (!due) continue;
      const dia = startOfDayLocal(due);
      linhas.push(linha({
        id: `agenda:${g.id}:${k}`,
        monthKey: monthKeyFromDate(dia),
        dataRef: dia,
        valorCents: valores[k - 1] ?? 0,
        modalidade: 'parcelado',
        natureza,
        situacao: 'projecao',
        fornecedor: `${tituloGasto(g)} · Parc. ${k}/${n}`,
        origem: 'Previsto pela agenda do cartão. Não é um pagamento confirmado.',
        naturezaObservacao: null,
        ...pagamentoDoGasto(g),
      }));
    }
  }

  for (const c of input.compromissos) {
    if (c.gastoId && input.gastos.some((g) => g.id === c.gastoId)) continue;

    if (c.tipo === 'parcelado') {
      for (const p of c.parcelas ?? []) {
        const venc = parseDateBR(p.dataVencimentoBR);
        if (!venc) continue;
        const dia = startOfDayLocal(venc);
        const situacao = situacaoAberta(p.status, dia, hoje);
        if (!situacao) continue;
        linhas.push(linha({
          id: `comp-parc:${p.id}`,
          monthKey: monthKeyFromDate(dia),
          dataRef: dia,
          valorCents: p.valorCentavos,
          modalidade: 'parcelado',
          natureza: 'nao_classificado',
          situacao,
          fornecedor: `${c.fornecedor.trim() || 'Compromisso'} · Parc. ${p.numeroParcela}/${p.totalParcelas}`,
          origem: 'Parcela de compromisso a pagar',
          naturezaObservacao: NATUREZA_SEM_CADASTRO,
        }));
      }
      continue;
    }

    const prevista = parseDateBR(c.dataPrevistaPagamento);
    if (!prevista) continue;
    const dia = startOfDayLocal(prevista);
    const situacao = situacaoAberta(c.status, dia, hoje);
    if (!situacao) continue;
    const dePerene = Boolean(c.gastoPereneId);
    linhas.push(linha({
      id: `comp:${c.id}`,
      monthKey: monthKeyFromDate(dia),
      dataRef: dia,
      valorCents: c.total,
      modalidade: dePerene ? 'perene' : 'demais',
      natureza: 'nao_classificado',
      situacao,
      fornecedor: c.fornecedor.trim() || 'Compromisso',
      origem: dePerene ? 'Compromisso gerado por gasto perene' : 'Compromisso a pagar',
      naturezaObservacao: NATUREZA_SEM_CADASTRO,
    }));
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
      linhas.push(linha({
        id: `prev-perene:${gp.id}:${isoDate(dia)}`,
        monthKey: monthKeyFromDate(dia),
        dataRef: dia,
        valorCents: gp.valorPrevistoCents,
        modalidade: 'perene',
        natureza: 'nao_classificado',
        situacao: 'projecao',
        fornecedor: gp.fornecedor.trim() || 'Gasto perene',
        origem: 'Previsão de gasto perene, ainda sem compromisso',
        naturezaObservacao: NATUREZA_SEM_CADASTRO,
      }));
    }
  }

  return linhas;
}

export function montarLinhasVisao(input: MontarVisaoInput): LinhaVisao[] {
  if (input.perspectiva === 'registrados') return ordenarLinhas(montarRegistrados(input));
  const comprometido = montarComprometimento(input);
  if (input.perspectiva === 'comprometimento') return ordenarLinhas(comprometido);
  return ordenarLinhas([...montarGastosForaDaAgenda(input), ...comprometido]);
}

export {
  monthKeyFromDate,
  faseDoMes,
  filtrarLinhasVisao,
  resumirLinhasVisao,
  calcularEvolucao,
  colunasDoGrafico,
  rotuloMesCurto,
  rotuloMesLongo,
} from './visaoFinanceiraConsulta';
